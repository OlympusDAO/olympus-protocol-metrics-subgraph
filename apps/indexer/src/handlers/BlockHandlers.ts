import BigNumberCtor, { type default as BigNumber } from "bignumber.js";
import {
  aggregateAcrossChains,
  computeApy,
  computeDerivedRatios,
  computePerChainAggregate,
} from "../snapshot/global";
import {
  BigDecimal,
  type EvmOnBlockContext,
  indexer,
  type NativeBalanceState,
  type TokenRecord,
  type TokenSupply,
} from "envio";
import { getAddress, type PublicClient } from "viem";
import {
  readBlockTimestamp,
  readErc20BalanceOf,
  readNextOhmDistribution,
  readSOhmCirculatingSupply,
} from "../effects";
import {
  getPrice,
  getTotalValue,
  getUnderlyingTokenBalance,
  getUnitPrice,
  withPricingCache,
} from "../pricing";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { withContractReadCache } from "../snapshot/contract-cache";
import { getClient, getNativeBalance } from "../snapshot/rpc-client";
import {
  addr,
  getTokenDecimals,
  isActive,
  matches,
  toBigDecimal,
  toDecimal,
  univ3PositionAmounts,
  ZERO,
} from "../snapshot/math";
import {
  createTokenRecord,
  createTokenSupply,
  getContractName,
  getTokenDefinition,
  getWalletAddressesForContract,
} from "../snapshot/records";
import {
  CHAIN_IDS,
  type ChainConfig,
  type ChainId,
  type LiquidityHandler,
  type SerializedTokenRecord,
  type SerializedTokenSupply,
} from "../snapshot/types";
// Per-protocol handlers extracted per @0xJem on PR #311 (Step 5.3).
import { pushArbitrumLendingSupply } from "./ArbitrumLending";
import { pushArbitrumStakingRecords } from "./ArbitrumStaking";
import { pushBlvSupply } from "./BlvSupply";
import { pushCoolerReceivables } from "./CoolerLoans";
import { pushGnosisAuctionSupply } from "./GnosisAuctions";
import { pushMigrationOffsetSupply } from "./MigrationOffset";
import {
  getLpTokenForHandler,
  readNativeBalance,
  readNonStandardBalance,
  readTokenBalance,
} from "./SnapshotHelpers";
import { pushUniv3NftPol } from "./Univ3NftPol";

const BLOCK_HANDLERS = [
  {
    name: "ArbitrumEightHourSnapshot",
    chain: 42161 as const,
    startBlock: 10950000,
    interval: 115200,
  },
  {
    name: "BerachainEightHourSnapshot",
    chain: 80094 as const,
    startBlock: 799194,
    interval: 14917,
  },
  {
    name: "BaseEightHourSnapshot",
    chain: 8453 as const,
    startBlock: 13204827, // 2024-04-15, OHM deployment block (matches BASE config)
    interval: 14400, // ~8h at Base's ~2s block time
  },
  {
    name: "PolygonEightHourSnapshot",
    chain: 137 as const,
    startBlock: 23000000, // ~2021-09-22, matches POLYGON config
    interval: 14400, // ~8h at Polygon's ~2s block time
  },
  {
    name: "FantomEightHourSnapshot",
    chain: 250 as const,
    startBlock: 37320000, // 2022-05-01, matches FANTOM config (legacy parity)
    interval: 24000, // ~8h at Fantom's ~1.2s block time
  },
  {
    name: "EthereumEightHourSnapshot",
    chain: 1 as const,
    startBlock: 12000000, // ~2021-04-29, matches ETHEREUM config
    interval: 2400, // ~8h at Ethereum's ~12s block time
  },
];

indexer.onBlock(
  {
    name: "EightHourSnapshot",
    where: ({ chain }) => {
      const handler = BLOCK_HANDLERS.find((value) => value.chain === chain.id);
      if (!handler) {
        throw new Error(`Unsupported chain ${chain.id} for EightHourSnapshot block handler`);
      }
      return {
        block: {
          number: {
            _gte: handler.startBlock,
            _every: handler.interval,
          },
        },
      };
    },
  },
  async ({ block, context }) => {
    const handler = BLOCK_HANDLERS.find((value) => value.chain === context.chain.id);
    if (!handler) {
      throw new Error(
        `Unsupported chain ${context.chain.id} for EightHourSnapshot block ${block.number}`,
      );
    }
    await processSnapshot(handler.name, block.number, context.chain.id, context);
  },
);

async function processSnapshot(
  name: string,
  blockNumberInput: number,
  chainId: number,
  context: EvmOnBlockContext,
): Promise<void> {
  context.log.info(`Processing ${name} block ${blockNumberInput} on chain ${chainId}`);
  const config = CHAIN_CONFIGS[chainId as ChainId];
  if (!config) {
    throw new Error(`Unsupported chain ${chainId}`);
  }

  const startedAt = Date.now();
  const blockNumber = BigInt(blockNumberInput);
  const client = getClient(config);

  const records: SerializedTokenRecord[] = [];
  const supplies: SerializedTokenSupply[] = [];

  // Envio's onBlock callback only passes the block number, so we look up the
  // real block timestamp via RPC (effect is cached + immutable per (chain,
  // block), so each unique snapshot block costs one RPC call ever). Required
  // for snapshot record IDs and the YYYY-MM-DD `date` field to be meaningful.
  const blockTimestamp = await context.effect(readBlockTimestamp, {
    chainId,
    blockNumber: blockNumberInput,
  });
  const timestamp = BigInt(blockTimestamp);

  await withContractReadCache(() =>
    withPricingCache(async () => {
      await pushTokenBalanceRecords(context, config, client, records, timestamp, blockNumber);
      await pushOwnedLiquidityRecords(context, config, client, records, timestamp, blockNumber);
      if (config.chainId === CHAIN_IDS.ARBITRUM) {
        await pushArbitrumStakingRecords(context, config, records, timestamp, blockNumber);
      }
      if (config.coolerClearinghouses && config.coolerClearinghouses.length > 0) {
        await pushCoolerReceivables(context, config, client, records, timestamp, blockNumber);
      }
      if (config.univ3PositionManager) {
        await pushUniv3NftPol(context, config, client, records, supplies, timestamp, blockNumber);
      }

      // Per @0xJem on PR #315: emit TokenSupply rows on every chain, even
      // Polygon/Fantom (legacy declared the entity but never populated it —
      // intentional reversal of Phase 1 decision #1 since the data is
      // useful and the cost is bounded).
      await pushTotalSupply(context, config, supplies, timestamp, blockNumber);
      await pushTreasuryOhm(context, config, supplies, timestamp, blockNumber);
      await pushOwnedLiquiditySupply(context, config, client, supplies, timestamp, blockNumber);
      if (config.chainId === CHAIN_IDS.ARBITRUM) {
        await pushArbitrumLendingSupply(context, config, supplies, timestamp, blockNumber);
      }
      if (config.blvRegistry) {
        await pushBlvSupply(context, config, supplies, timestamp, blockNumber);
      }
      if (config.bondManager) {
        await pushGnosisAuctionSupply(context, config, supplies, timestamp, blockNumber);
      }
      if (config.migrationOffset) {
        await pushMigrationOffsetSupply(context, config, supplies, timestamp, blockNumber);
      }
    }),
  );

  for (const record of records) {
    const entity: TokenRecord = {
      ...record,
      block: BigInt(record.block),
      timestamp: BigInt(record.timestamp),
      rate: new BigDecimal(record.rate),
      balance: new BigDecimal(record.balance),
      multiplier: new BigDecimal(record.multiplier),
      value: new BigDecimal(record.value),
      valueExcludingOhm: new BigDecimal(record.valueExcludingOhm),
    };
    context.TokenRecord.set(entity);
  }

  for (const supply of supplies) {
    const entity: TokenSupply = {
      id: supply.id,
      chainId: supply.chainId,
      blockchain: supply.blockchain,
      block: BigInt(supply.block),
      date: supply.date,
      timestamp: BigInt(supply.timestamp),
      token: supply.token,
      tokenAddress: supply.tokenAddress,
      pool: supply.pool,
      poolAddress: supply.poolAddress,
      source: supply.source,
      sourceAddress: supply.sourceAddress,
      type: supply.type,
      balance: new BigDecimal(supply.balance),
      supplyBalance: new BigDecimal(supply.supplyBalance),
    };
    context.TokenSupply.set(entity);
  }

  // Update the cross-chain GlobalMetricSnapshot for this date. The current
  // chain's per-day aggregate is recomputed in-memory from the records we
  // just produced; other chains' per-day aggregates are read back from the
  // existing ChainMetricValues entities.
  await withContractReadCache(() =>
    withPricingCache(() =>
      updateGlobalMetricSnapshot(
        context,
        config,
        client,
        blockNumber,
        timestamp,
        records,
        supplies,
      ),
    ),
  );

  context.log.info(
    `Finished ${name} block ${blockNumberInput} on chain ${chainId} in ${Date.now() - startedAt}ms`,
    { tokenRecords: records.length, tokenSupplies: supplies.length },
  );
}

// ----- Global metric snapshot (Phase 5) -----

export async function updateGlobalMetricSnapshot(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  blockNumber: bigint,
  timestamp: bigint,
  records: SerializedTokenRecord[],
  supplies: SerializedTokenSupply[],
): Promise<void> {
  // All records share the same date — pull it from the first one. If both
  // arrays are empty we have nothing to aggregate; skip.
  const date = records[0]?.date ?? supplies[0]?.date;
  if (!date) return;

  // Compute this chain's per-day aggregate from the records we just pushed.
  const thisChain = computePerChainAggregate(
    config.chainId,
    config.blockchain,
    date,
    blockNumber,
    timestamp,
    records,
    supplies,
  );

  // Persist the per-chain values entity. ID is "YYYY-MM-DD/{chainId}" per
  // @0xJem PR #311 Step 4 (consistent leading-date prefix across entities),
  // so repeat snapshots for the same UTC date overwrite cleanly.
  const chainValuesId = `${date}/${config.chainId}`;
  const snapshotId = date;
  context.ChainMetricValues.set({
    id: chainValuesId,
    snapshot_id: snapshotId,
    chainId: config.chainId,
    blockchain: config.blockchain,
    date,
    block: blockNumber,
    timestamp,
    ohmTotalSupply: toBigDecimal(thisChain.ohmTotalSupply),
    ohmCirculatingSupply: toBigDecimal(thisChain.ohmCirculatingSupply),
    ohmFloatingSupply: toBigDecimal(thisChain.ohmFloatingSupply),
    ohmBackedSupply: toBigDecimal(thisChain.ohmBackedSupply),
    treasuryMarketValue: toBigDecimal(thisChain.treasuryMarketValue),
    treasuryLiquidBacking: toBigDecimal(thisChain.treasuryLiquidBacking),
  });

  // Pull other chains' values back from the store. We rebuild per-chain
  // PerChainAggregate objects from the stored fields, keeping supplyCategories
  // empty for non-current chains (categories are recomputed cross-chain below
  // from this chain's supplies plus stored category rows).
  const allChainValues = await context.ChainMetricValues.getWhere({
    date: { _eq: date },
  });
  const perChainAggregates = allChainValues.map((entity) => {
    if (entity.chainId === config.chainId) return thisChain;
    return {
      chainId: entity.chainId,
      blockchain: entity.blockchain,
      date: entity.date,
      block: entity.block,
      timestamp: entity.timestamp,
      ohmTotalSupply: new BigNumberCtor(entity.ohmTotalSupply.toString()),
      ohmCirculatingSupply: new BigNumberCtor(entity.ohmCirculatingSupply.toString()),
      ohmFloatingSupply: new BigNumberCtor(entity.ohmFloatingSupply.toString()),
      ohmBackedSupply: new BigNumberCtor(entity.ohmBackedSupply.toString()),
      treasuryMarketValue: new BigNumberCtor(entity.treasuryMarketValue.toString()),
      treasuryLiquidBacking: new BigNumberCtor(entity.treasuryLiquidBacking.toString()),
      supplyCategories: new Map<string, { balance: BigNumber; supplyBalance: BigNumber }>(),
    };
  });
  // Ensure this chain's entry is present (getWhere may have a slight read
  // delay between the set we just performed and the read).
  if (!perChainAggregates.some((agg) => agg.chainId === config.chainId)) {
    perChainAggregates.push(thisChain);
  }

  const aggregate = aggregateAcrossChains(date, perChainAggregates);

  // GlobalMetricSnapshot is keyed by `date` so every chain's snapshot for the
  // same UTC day writes to one shared row. The canonical OHM-protocol fields
  // (ohmIndex / ohmPrice / sOhmCirculatingSupply / ohmApy) are only knowable
  // from Ethereum, so non-Ethereum chains must avoid clobbering them with
  // zeros. We preserve them by reading back what's there before writing.
  const existing = await context.GlobalMetricSnapshot.get(snapshotId);
  const isCanonicalChain = config.chainId === CHAIN_IDS.ETHEREUM;

  // ohmIndex is the only canonical field that can be read cross-chain —
  // OhmIndexState lives in the shared Hasura schema, keyed by Ethereum's
  // chainId. Reading it from any chain's snapshot gives the latest sOHM-V3
  // rebase, so we always populate it (independent of write ordering).
  let ohmIndex = new BigNumberCtor("0");
  const ethereumConfig = CHAIN_CONFIGS[CHAIN_IDS.ETHEREUM];
  const canonicalSOhm = ethereumConfig?.migrationOffset?.sOhmAddress;
  if (canonicalSOhm) {
    const indexState = await context.OhmIndexState.get(`1-${addr(canonicalSOhm)}`);
    if (indexState && indexState.index > 0n) {
      ohmIndex = new BigNumberCtor(indexState.index.toString()).div(
        new BigNumberCtor("1000000000"),
      );
    }
  }

  // ohmPrice / sOhmCirculatingSupply: only Ethereum currently has a complete
  // OHM pricing path (Phase 4 ported the WETH-OHM UniV3 pool) and the
  // sOhmCirculatingSupply RPC. From non-Ethereum chains, preserve the
  // existing values instead of overwriting with zeros.
  let ohmPrice = new BigNumberCtor("0");
  let sOhmCirculatingSupply = new BigNumberCtor("0");
  if (isCanonicalChain) {
    const result = await getPrice(config, context, client, config.ohmToken, blockNumber, null);
    ohmPrice = result.price;
    if (config.migrationOffset?.sOhmAddress) {
      const raw = (await context.effect(readSOhmCirculatingSupply, {
        chainId: config.chainId,
        sOhm: config.migrationOffset.sOhmAddress,
        atBlock: Number(blockNumber),
      })) as string;
      if (raw !== "") {
        // sOHM has 9 decimals (same as OHM).
        sOhmCirculatingSupply = new BigNumberCtor(raw).div(new BigNumberCtor("1000000000"));
      }
    }
  } else if (existing) {
    ohmPrice = new BigNumberCtor(existing.ohmPrice.toString());
    sOhmCirculatingSupply = new BigNumberCtor(existing.sOhmCirculatingSupply.toString());
  }

  // APY: read the next-epoch OHM distribution from active staking contracts,
  // then compute (1 + rebase/100)^(365*3) - 1. Only Ethereum has the staking
  // contracts; preserve from existing on other chains.
  let ohmApy = new BigNumberCtor("0");
  if (isCanonicalChain && config.stakingContracts) {
    const stakingRaw = (await context.effect(readNextOhmDistribution, {
      chainId: config.chainId,
      stakingV1: config.stakingContracts.v1,
      stakingV2: config.stakingContracts.v2,
      stakingV2StartBlock: config.stakingContracts.v2StartBlock,
      stakingV3: config.stakingContracts.v3,
      stakingV3StartBlock: config.stakingContracts.v3StartBlock,
      atBlock: Number(blockNumber),
    })) as string;
    if (stakingRaw !== "" && stakingRaw !== "0") {
      const distributedOhm = new BigNumberCtor(stakingRaw).div(new BigNumberCtor("1000000000"));
      ohmApy = computeApy(distributedOhm, sOhmCirculatingSupply).currentApy;
    }
  } else if (!isCanonicalChain && existing) {
    ohmApy = new BigNumberCtor(existing.ohmApy.toString());
  }

  // Derived fields are recomputed every write — they depend on the
  // freshly-aggregated rollup (ohmCirculatingSupply etc. that may have just
  // changed) combined with the (possibly preserved) canonical canonical inputs.
  const gOhmPrice = ohmPrice.times(ohmIndex);
  const sOhmTotalValueLocked = sOhmCirculatingSupply.times(ohmPrice);
  const ratios = computeDerivedRatios(aggregate, ohmPrice, ohmIndex);

  context.GlobalMetricSnapshot.set({
    id: snapshotId,
    date,
    updatedAtTimestamp: timestamp,
    crossChainComplete: aggregate.crossChainComplete,
    chainsIndexed: aggregate.chainsIndexed,
    chainsMissing: aggregate.chainsMissing,
    ohmTotalSupply: toBigDecimal(aggregate.ohmTotalSupply),
    ohmCirculatingSupply: toBigDecimal(aggregate.ohmCirculatingSupply),
    ohmFloatingSupply: toBigDecimal(aggregate.ohmFloatingSupply),
    ohmBackedSupply: toBigDecimal(aggregate.ohmBackedSupply),
    gOhmBackedSupply: toBigDecimal(ratios.gOhmBackedSupply),
    treasuryMarketValue: toBigDecimal(aggregate.treasuryMarketValue),
    treasuryLiquidBacking: toBigDecimal(aggregate.treasuryLiquidBacking),
    ohmIndex: toBigDecimal(ohmIndex),
    ohmApy: toBigDecimal(ohmApy),
    ohmPrice: toBigDecimal(ohmPrice),
    gOhmPrice: toBigDecimal(gOhmPrice),
    sOhmCirculatingSupply: toBigDecimal(sOhmCirculatingSupply),
    sOhmTotalValueLocked: toBigDecimal(sOhmTotalValueLocked),
    marketCap: toBigDecimal(ratios.marketCap),
    treasuryLiquidBackingPerOhmFloating: toBigDecimal(ratios.treasuryLiquidBackingPerOhmFloating),
    treasuryLiquidBackingPerOhmBacked: toBigDecimal(ratios.treasuryLiquidBackingPerOhmBacked),
    treasuryLiquidBackingPerGOhmBacked: toBigDecimal(ratios.treasuryLiquidBackingPerGOhmBacked),
  });

  // Write ChainSupplyCategory rows from this chain's supplies. Each
  // (date, chainId, category) row carries both `balance` (raw on-chain) and
  // `supplyBalance` (signed contribution to circulating). The category field
  // is mapped from the legacy TYPE_* string ("Total Supply" etc.) to the
  // SupplyCategoryType enum value ("TOTAL_SUPPLY" etc.) per @0xJem PR #311
  // Step 4 — TokenSupply.type stays a string so the wider snapshot pipeline
  // doesn't need to change.
  for (const [type, bucket] of thisChain.supplyCategories) {
    const categoryEnum = CATEGORY_TYPE_TO_ENUM[type];
    if (!categoryEnum) continue; // unknown TYPE_* string; skip rather than corrupt the enum field
    context.ChainSupplyCategory.set({
      id: `${date}/${config.chainId}/${categoryEnum}`,
      snapshot_id: snapshotId,
      chainId: config.chainId,
      date,
      category: categoryEnum,
      balance: toBigDecimal(bucket.balance),
      supplyBalance: toBigDecimal(bucket.supplyBalance),
    });
  }
}

// Maps the legacy TYPE_* string values (kept as strings in TokenSupply.type
// for snapshot-pipeline simplicity) to the SupplyCategoryType GraphQL enum
// members. If a TYPE_* string is missing from this map, the writer above
// skips the row rather than emit a value the GraphQL enum would reject.
const CATEGORY_TYPE_TO_ENUM: Record<string, "TOTAL_SUPPLY" | "TREASURY" | "OHM_MIGRATION_OFFSET" | "BONDS_PREMINTED" | "BONDS_VESTING_DEPOSITS" | "BONDS_VESTING_TOKENS" | "BONDS_DEPOSITS" | "LIQUIDITY" | "BOOSTED_LIQUIDITY_VAULT" | "LENDING"> = {
  "Total Supply": "TOTAL_SUPPLY",
  Treasury: "TREASURY",
  "OHM Migration Offset": "OHM_MIGRATION_OFFSET",
  "Bonds (Pre-Minted)": "BONDS_PREMINTED",
  "Bonds (Vesting Deposits)": "BONDS_VESTING_DEPOSITS",
  "Bonds (Vesting Tokens)": "BONDS_VESTING_TOKENS",
  "Bonds (Deposits)": "BONDS_DEPOSITS",
  Liquidity: "LIQUIDITY",
  "Boosted Liquidity Vault": "BOOSTED_LIQUIDITY_VAULT",
  Lending: "LENDING",
};

// ----- Token records (treasury balances) -----

export async function pushTokenBalanceRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: ReturnType<typeof getClient>,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  // Single pass over config.tokens, skipping non-Stable/Volatile (Protocol-Owned
  // Liquidity tokens are emitted via pushOwnedLiquidityRecords). Per @0xJem on
  // PR #311 — avoids the nested-loop + per-category .filter() allocation.
  for (const definition of config.tokens) {
    if (definition.category !== "Stable" && definition.category !== "Volatile") continue;
    if (!isActive(definition, blockNumber)) continue;

    const rate = (await getPrice(config, context, client, definition.address, blockNumber, null))
      .price;
    if (rate.eq(ZERO)) continue;

    const wallets = getWalletAddressesForContract(config, definition.address);
    const decimals = getTokenDecimals(config.tokens, definition.address);
    const isNative = definition.address === config.nativeToken;
    for (const wallet of wallets) {
      const balance = isNative
        ? await readNativeBalance(context, client, config.chainId, wallet, decimals, blockNumber)
        : definition.nonStandardBalance
          ? await readNonStandardBalance(
              context,
              config.chainId,
              definition.address,
              wallet,
              decimals,
              blockNumber,
            )
          : await readTokenBalance(context, config.chainId, definition.address, wallet, decimals);
      if (balance.eq(ZERO)) continue;
      records.push(
        createTokenRecord(
          config,
          timestamp,
          getContractName(config, definition.address),
          definition.address,
          getContractName(config, wallet),
          wallet,
          rate,
          balance,
          blockNumber,
        ),
      );
    }
  }
}

// Bounded snapshot-time getBalance per protocol wallet. Closes inherited
// TODO(native-balances) — native assets emit no Transfer event so they
// can't be event-driven. Persists to NativeBalanceState so consumers can
// query the running native balance per chain/wallet.

// ----- Owned-liquidity records (LP balances from entities, prices via RPC) -----

async function pushOwnedLiquidityRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: ReturnType<typeof getClient>,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  for (const handler of config.ownedLiquidityHandlers) {
    if (!isActive(handler, blockNumber)) continue;
    const lpToken = getLpTokenForHandler(handler);
    if (!lpToken) continue;

    const totalValue = await getTotalValue(config, context, client, handler, [], blockNumber);
    if (!totalValue || totalValue.eq(ZERO)) continue;
    const includedValue = await getTotalValue(
      config,
      context,
      client,
      handler,
      [config.ohmToken],
      blockNumber,
    );
    if (!includedValue) continue;
    const multiplier = includedValue.div(totalValue);
    const unitRate = await getUnitPrice(config, context, client, handler, blockNumber);
    if (!unitRate) continue;

    const lpDecimals = getTokenDecimals(config.tokens, lpToken);
    // Some POL LPs (e.g. Beradrome reward vault stake tokens on Berachain)
    // mint without emitting Transfer — `stake()` updates internal storage
    // only. Their token definition carries `nonStandardBalance: true`; route
    // through readErc20BalanceOf so the snapshot sees the real position.
    const lpTokenDef = getTokenDefinition(config, lpToken);
    const useOnChainBalance = lpTokenDef?.nonStandardBalance === true;
    for (const wallet of config.protocolAddresses) {
      const balance = useOnChainBalance
        ? await readNonStandardBalance(
            context,
            config.chainId,
            lpToken,
            wallet,
            lpDecimals,
            blockNumber,
          )
        : await readTokenBalance(context, config.chainId, lpToken, wallet, lpDecimals);
      if (balance.eq(ZERO)) continue;
      records.push(
        createTokenRecord(
          config,
          timestamp,
          getContractName(config, handler.id),
          handler.id,
          getContractName(config, wallet),
          wallet,
          unitRate,
          balance,
          blockNumber,
          multiplier,
          "Protocol-Owned Liquidity",
        ),
      );
    }
  }
}



// ----- Token supplies (OHM total / treasury / liquidity / lending) -----

const SOHM_INDEX_DECIMALS = 9;

// Returns the multiplier needed to convert `config.ohmToken` amounts into
// OHM-equivalent units before they flow into the cross-chain supply rollup.
// OHM-native chains (Ethereum, Arbitrum, Base, Berachain) return 1. On chains
// where `ohmToken` is gOHM (Fantom, Polygon) we multiply by the current sOHM
// V3 rebase index — read from Ethereum's OhmIndexState as the single source —
// so 1 gOHM contributes its OHM-backed equivalent. Returns null when the
// index isn't available yet; callers must skip emission (rather than emit
// gOHM units that would poison the OHM-denominated rollup).
async function getOhmEquivalentMultiplier(
  context: EvmOnBlockContext,
  config: ChainConfig,
): Promise<BigNumber | null> {
  const decimals = getTokenDecimals(config.tokens, config.ohmToken);
  if (decimals === 9) return new BigNumberCtor(1);
  return getSOhmV3Index(context);
}

// Reads the canonical sOHM V3 rebase index regardless of which chain the
// caller is on. Needed for treasuryOhmEquivalents on OHM-native chains
// (Ethereum) where `getOhmEquivalentMultiplier` returns 1 because
// `config.ohmToken` is OHM-not-gOHM, but a separate `convertVia:
// "gohm-index"` entry (gOHM held by protocol wallets) still needs the
// rebase index to map gOHM units → OHM-equivalent.
async function getSOhmV3Index(context: EvmOnBlockContext): Promise<BigNumber | null> {
  const ethereum = CHAIN_CONFIGS[CHAIN_IDS.ETHEREUM];
  const sOhm = ethereum?.migrationOffset?.sOhmAddress;
  if (!sOhm) return null;
  const indexState = await context.OhmIndexState.get(`1-${addr(sOhm)}`);
  if (!indexState || indexState.index === 0n) return null;
  return toDecimal(indexState.index, SOHM_INDEX_DECIMALS);
}

export async function pushTotalSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (config.ohmStartBlock && blockNumber < BigInt(config.ohmStartBlock)) return;

  const entity = await context.Erc20Supply.get(`${config.chainId}-${addr(config.ohmToken)}`);
  if (!entity) return;

  const decimals = getTokenDecimals(config.tokens, config.ohmToken);
  const multiplier = await getOhmEquivalentMultiplier(context, config);
  if (!multiplier) return;

  const balance = toDecimal(entity.totalSupply, decimals).times(multiplier);
  if (balance.eq(ZERO)) return;
  supplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      undefined,
      undefined,
      "Total Supply",
      balance,
      blockNumber,
    ),
  );
}

export async function pushTreasuryOhm(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (config.ohmStartBlock && blockNumber < BigInt(config.ohmStartBlock)) return;

  const decimals = getTokenDecimals(config.tokens, config.ohmToken);
  const multiplier = await getOhmEquivalentMultiplier(context, config);
  if (!multiplier) return;

  // Bridged gOHM on Fantom/Polygon mints without a standard Transfer event,
  // so the event-driven TokenBalance ledger drifts negative for protocol
  // wallets. When the token definition is flagged `nonStandardBalance`, fall
  // back to a snapshot-time balanceOf RPC (cached per (chain, token, wallet,
  // block) via the readErc20BalanceOf effect).
  const ohmTokenDef = getTokenDefinition(config, config.ohmToken);
  const useOnChainBalance = ohmTokenDef?.nonStandardBalance === true;

  for (const wallet of config.circulatingSupplyWallets) {
    const rawBalance = useOnChainBalance
      ? await readNonStandardBalance(
          context,
          config.chainId,
          config.ohmToken,
          wallet,
          decimals,
          blockNumber,
        )
      : await readTokenBalance(context, config.chainId, config.ohmToken, wallet, decimals);
    if (rawBalance.eq(ZERO)) continue;
    const balance = rawBalance.times(multiplier);
    if (balance.eq(ZERO)) continue;
    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        getContractName(config, wallet),
        wallet,
        "Treasury",
        balance,
        blockNumber,
        -1,
      ),
    );
  }

  // Additional OHM-equivalent tokens (gOHM / sOHM V3 / sOHM V2 on
  // Ethereum). The legacy treasury subgraph includes these in TREASURY
  // supply alongside bare OHM — without them, historical
  // `ohmBackedSupply` overstates by ~12% on 2024-10-01 because the
  // protocol held ~9.4K gOHM (~2.0M OHM-equivalent) at that time. See
  // ChainConfig.treasuryOhmEquivalents commentary for conversion rules
  // and start-block gates.
  if (config.treasuryOhmEquivalents) {
    // gOHM-style entries need the sOHM V3 rebase index. On Ethereum the
    // `multiplier` above is 1 (ohmToken is OHM, not gOHM) so we can't
    // reuse it — fetch the index directly. Cache it so we don't hit
    // OhmIndexState once per (entry × wallet).
    let gohmIndex: BigNumber | null | undefined;
    for (const entry of config.treasuryOhmEquivalents) {
      if (blockNumber < BigInt(entry.startBlock)) continue;
      let entryMultiplier: BigNumber;
      if (entry.convertVia === "gohm-index") {
        if (gohmIndex === undefined) gohmIndex = await getSOhmV3Index(context);
        if (!gohmIndex) continue;
        entryMultiplier = gohmIndex;
      } else {
        entryMultiplier = new BigNumberCtor("1");
      }
      for (const wallet of config.circulatingSupplyWallets) {
        const rawBalance = await readTokenBalance(
          context,
          config.chainId,
          entry.tokenAddress,
          wallet,
          entry.decimals,
        );
        if (rawBalance.eq(ZERO)) continue;
        const balance = rawBalance.times(entryMultiplier);
        if (balance.eq(ZERO)) continue;
        supplies.push(
          createTokenSupply(
            config,
            timestamp,
            getContractName(config, entry.tokenAddress),
            entry.tokenAddress,
            undefined,
            undefined,
            getContractName(config, wallet),
            wallet,
            "Treasury",
            balance,
            blockNumber,
            -1,
          ),
        );
      }
    }
  }
}

async function pushOwnedLiquiditySupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: ReturnType<typeof getClient>,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  // Univ2 / Kodiak resolve the pool ratio from event-sourced state. Balancer /
  // Kodiak underlying pool calls still hit cached RPC until Phase 2B replaces
  // Balancer with event-driven pool state.
  const multiplier = await getOhmEquivalentMultiplier(context, config);
  if (!multiplier) return;

  for (const handler of config.ownedLiquidityHandlers) {
    if (!isActive(handler, blockNumber)) continue;
    if (!matches(handler, config.ohmToken)) continue;

    for (const wallet of config.circulatingSupplyWallets) {
      const rawBalance = await getUnderlyingTokenBalance(
        config,
        context,
        client,
        handler,
        wallet,
        config.ohmToken,
        blockNumber,
      );
      if (rawBalance.eq(ZERO)) continue;
      const balance = rawBalance.times(multiplier);
      if (balance.eq(ZERO)) continue;
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          getContractName(config, handler.id),
          handler.id,
          getContractName(config, wallet),
          wallet,
          "Liquidity",
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}


