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
  readBondManagerState,
  readCoolerPrincipalReceivables,
  readMonoCoolerTotalDebt,
  readNextOhmDistribution,
  readSOhmCirculatingSupply,
  snapshotBlvRegistry,
  snapshotUniv3NftPositions,
} from "../effects";
import {
  getPrice,
  getTotalValue,
  getUnderlyingTokenBalance,
  getUnitPrice,
  withPricingCache,
} from "../pricing";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { OLYMPUS_LENDER, SENTIMENT_LTOKEN, SILO_COLLATERAL } from "../snapshot/chains/arbitrum";
import { getClient, getNativeBalance, withContractReadCache } from "../snapshot/contracts";
import {
  addr,
  getTokenDecimals,
  isActive,
  matches,
  toDecimal,
  univ3PositionAmounts,
  ZERO,
} from "../snapshot/math";
import {
  createTokenRecord,
  createTokenSupply,
  getContractName,
  getWalletAddressesForContract,
} from "../snapshot/records";
import type {
  ChainConfig,
  ChainId,
  LiquidityHandler,
  SerializedTokenRecord,
  SerializedTokenSupply,
} from "../snapshot/types";

const SENTIMENT_LTOKEN_START_BLOCK = 100875583n;
const SILO_COLLATERAL_START_BLOCK = 99067079n;
const ARBITRUM_DYNAMIC_LENDING_START_BLOCK = 130482707n;
const JONES_STAKED_POOL_ID = 0n;
const JONES_WRITE_OFF_BLOCK = 130_482_707n;
const TREASURE_STAKED_LP_DECIMALS = 18;

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

  // TODO(timestamp): use the chain's block timestamp once Envio's onBlock
  // handler surfaces it. For now we use the block number as the timestamp
  // value so the snapshot record IDs stay unique and the field is populated.
  const timestamp = blockNumber;

  await withContractReadCache(() =>
    withPricingCache(async () => {
      await pushTokenBalanceRecords(context, config, client, records, timestamp, blockNumber);
      await pushOwnedLiquidityRecords(context, config, client, records, timestamp, blockNumber);
      if (config.chainId === 42161) {
        await pushArbitrumStakingRecords(context, config, records, timestamp, blockNumber);
      }
      if (config.coolerClearinghouses && config.coolerClearinghouses.length > 0) {
        await pushCoolerReceivables(context, config, client, records, timestamp, blockNumber);
      }
      if (config.univ3PositionManager) {
        await pushUniv3NftPol(context, config, client, records, timestamp, blockNumber);
      }

      // Polygon and Fantom legacy subgraphs declared the TokenSupply entity
      // but never emitted any rows (Phase 1 decision #1 — match legacy).
      if (config.emitsTokenSupply !== false) {
        await pushTotalSupply(context, config, supplies, timestamp, blockNumber);
        await pushTreasuryOhm(context, config, supplies, timestamp, blockNumber);
        await pushOwnedLiquiditySupply(context, config, client, supplies, timestamp, blockNumber);
        if (config.chainId === 42161) {
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
  // existing GlobalMetricChainValues entities.
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

async function updateGlobalMetricSnapshot(
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

  // Persist the per-chain values entity. ID is "{chainId}-YYYY-MM-DD" so
  // repeat snapshots for the same UTC date overwrite cleanly.
  const chainValuesId = `${config.chainId}-${date}`;
  const snapshotId = date;
  context.GlobalMetricChainValues.set({
    id: chainValuesId,
    snapshot_id: snapshotId,
    chainId: config.chainId,
    blockchain: config.blockchain,
    date,
    block: blockNumber,
    timestamp,
    ohmTotalSupply: new BigDecimal(thisChain.ohmTotalSupply.toString(10)),
    ohmCirculatingSupply: new BigDecimal(thisChain.ohmCirculatingSupply.toString(10)),
    ohmFloatingSupply: new BigDecimal(thisChain.ohmFloatingSupply.toString(10)),
    ohmBackedSupply: new BigDecimal(thisChain.ohmBackedSupply.toString(10)),
    treasuryMarketValue: new BigDecimal(thisChain.treasuryMarketValue.toString(10)),
    treasuryLiquidBacking: new BigDecimal(thisChain.treasuryLiquidBacking.toString(10)),
  });

  // Pull other chains' values back from the store. We rebuild per-chain
  // PerChainAggregate objects from the stored fields, keeping supplyCategories
  // empty for non-current chains (categories are recomputed cross-chain below
  // from this chain's supplies plus stored category rows).
  const allChainValues = await context.GlobalMetricChainValues.getWhere({
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

  // Canonical (Ethereum-only) fields. ohmIndex sourced from OhmIndexState
  // (event-driven). ohmPrice resolved through the recursive pricing router.
  // ohmApy / sOhmCirculatingSupply / sOhmTotalValueLocked stay at 0 — they
  // need additional indexing (sOHM `LogRebase.rebase` for APY; sOHM
  // `Transfer` from/to-zero for circulating supply). Tracked in todo.md.
  let ohmIndex = new BigNumberCtor("0");
  if (config.migrationOffset?.sOhmAddress) {
    const indexState = await context.OhmIndexState.get(
      `${config.chainId}-${addr(config.migrationOffset.sOhmAddress)}`,
    );
    if (indexState && indexState.index > 0n) {
      ohmIndex = new BigNumberCtor(indexState.index.toString()).div(
        new BigNumberCtor("1000000000"),
      );
    }
  }
  // ohmPrice: only Ethereum currently has a complete OHM pricing path
  // (Phase 4 ported the WETH-OHM UniV3 pool there). Skip on other chains;
  // their entries will source from the canonical Ethereum snapshot once
  // the parity harness reads the aggregate.
  let ohmPrice = new BigNumberCtor("0");
  let sOhmCirculatingSupply = new BigNumberCtor("0");
  if (config.chainId === 1) {
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
  }
  const gOhmPrice = ohmPrice.times(ohmIndex);
  const sOhmTotalValueLocked = sOhmCirculatingSupply.times(ohmPrice);
  const ratios = computeDerivedRatios(aggregate, ohmPrice, ohmIndex);

  // APY: read the next-epoch OHM distribution from active staking contracts,
  // then compute (1 + rebase/100)^(365*3) - 1.
  let ohmApy = new BigNumberCtor("0");
  if (config.chainId === 1 && config.stakingContracts) {
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
  }

  context.GlobalMetricSnapshot.set({
    id: snapshotId,
    date,
    updatedAtTimestamp: timestamp,
    crossChainComplete: aggregate.crossChainComplete,
    chainsIndexed: aggregate.chainsIndexed,
    chainsMissing: aggregate.chainsMissing,
    ohmTotalSupply: new BigDecimal(aggregate.ohmTotalSupply.toString(10)),
    ohmCirculatingSupply: new BigDecimal(aggregate.ohmCirculatingSupply.toString(10)),
    ohmFloatingSupply: new BigDecimal(aggregate.ohmFloatingSupply.toString(10)),
    ohmBackedSupply: new BigDecimal(aggregate.ohmBackedSupply.toString(10)),
    gOhmBackedSupply: new BigDecimal(ratios.gOhmBackedSupply.toString(10)),
    treasuryMarketValue: new BigDecimal(aggregate.treasuryMarketValue.toString(10)),
    treasuryLiquidBacking: new BigDecimal(aggregate.treasuryLiquidBacking.toString(10)),
    ohmIndex: new BigDecimal(ohmIndex.toString(10)),
    ohmApy: new BigDecimal(ohmApy.toString(10)),
    ohmPrice: new BigDecimal(ohmPrice.toString(10)),
    gOhmPrice: new BigDecimal(gOhmPrice.toString(10)),
    sOhmCirculatingSupply: new BigDecimal(sOhmCirculatingSupply.toString(10)),
    sOhmTotalValueLocked: new BigDecimal(sOhmTotalValueLocked.toString(10)),
    marketCap: new BigDecimal(ratios.marketCap.toString(10)),
    treasuryLiquidBackingPerOhmFloating: new BigDecimal(
      ratios.treasuryLiquidBackingPerOhmFloating.toString(10),
    ),
    treasuryLiquidBackingPerOhmBacked: new BigDecimal(
      ratios.treasuryLiquidBackingPerOhmBacked.toString(10),
    ),
    treasuryLiquidBackingPerGOhmBacked: new BigDecimal(
      ratios.treasuryLiquidBackingPerGOhmBacked.toString(10),
    ),
  });

  // Write GlobalMetricSupplyCategory rows from this chain's supplies. Each
  // (date, category) row carries both `balance` (raw on-chain) and
  // `supplyBalance` (signed contribution to circulating). Cross-chain
  // aggregation across multiple chains' category rows is a follow-up.
  for (const [type, bucket] of thisChain.supplyCategories) {
    context.GlobalMetricSupplyCategory.set({
      id: `${date}-${type}-${config.chainId}`,
      snapshot_id: snapshotId,
      date,
      category: type,
      balance: new BigDecimal(bucket.balance.toString(10)),
      supplyBalance: new BigDecimal(bucket.supplyBalance.toString(10)),
    });
  }
}

// ----- Token records (treasury balances) -----

async function pushTokenBalanceRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: ReturnType<typeof getClient>,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  for (const category of ["Stable", "Volatile"] as const) {
    for (const definition of config.tokens.filter((value) => value.category === category)) {
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
}

// Bounded snapshot-time getBalance per protocol wallet. Closes inherited
// TODO(native-balances) — native assets emit no Transfer event so they
// can't be event-driven. Persists to NativeBalanceState so consumers can
// query the running native balance per chain/wallet.
async function readNativeBalance(
  context: EvmOnBlockContext,
  client: ReturnType<typeof getClient>,
  chainId: number,
  wallet: string,
  decimals: number,
  blockNumber: bigint,
): Promise<BigNumber> {
  const rawBalance = await getNativeBalance(client, getAddress(wallet), blockNumber);
  context.NativeBalanceState.set({
    id: `${chainId}-${addr(wallet)}`,
    chainId,
    walletAddress: addr(wallet),
    balance: rawBalance,
    updatedAtBlock: blockNumber,
  } satisfies NativeBalanceState);
  return toDecimal(rawBalance, decimals);
}

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
    for (const wallet of config.protocolAddresses) {
      const balance = await readTokenBalance(context, config.chainId, lpToken, wallet, lpDecimals);
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

// ----- Arbitrum staking (Jones + Treasure) from entities -----

async function pushArbitrumStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  await pushJonesStakingRecords(context, config, records, timestamp, blockNumber);
  await pushTreasureStakingRecords(context, config, records, timestamp, blockNumber);
}

async function pushJonesStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const jonesToken = config.tokens.find(
    (token) => token.address === addr("0x10393c20975cf177a3513071bc110f7962cd67da"),
  );
  if (!jonesToken || !isActive(jonesToken, blockNumber)) return;

  const client = getClient(config);
  let rate: BigNumber | null = null;
  for (const wallet of config.protocolAddresses) {
    const id = `${config.chainId}-${JONES_STAKED_POOL_ID.toString()}-${addr(wallet)}`;
    const entity = await context.JonesStakingPosition.get(id);
    if (!entity || entity.amount === 0n) continue;

    rate ??= (await getPrice(config, context, client, jonesToken.address, blockNumber, null)).price;
    if (rate.eq(ZERO)) continue;

    const balance = toDecimal(entity.amount, 18); // JONES is 18 decimals
    const record = createTokenRecord(
      config,
      timestamp,
      `${getContractName(config, jonesToken.address)} - Staked`,
      jonesToken.address,
      getContractName(config, wallet),
      wallet,
      rate,
      balance,
      blockNumber,
    );
    if (blockNumber >= JONES_WRITE_OFF_BLOCK) {
      record.multiplier = "0";
      record.valueExcludingOhm = "0";
    }
    records.push(record);
  }
}

async function pushTreasureStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const magicToken = config.tokens.find(
    (token) => token.address === addr("0x539bde0d7dbd336b79148aa742883198bbf60342"),
  );
  if (!magicToken || !isActive(magicToken, blockNumber)) return;

  const client = getClient(config);
  let rate: BigNumber | null = null;
  for (const wallet of config.protocolAddresses) {
    const deposits = await context.TreasureDeposit.getWhere({
      walletAddress: { _eq: addr(wallet) },
    });
    for (const deposit of deposits) {
      if (deposit.chainId !== config.chainId) continue;
      if (deposit.amount === 0n) continue;

      rate ??= (await getPrice(config, context, client, magicToken.address, blockNumber, null))
        .price;
      if (rate.eq(ZERO)) break;

      const balance = toDecimal(deposit.amount, TREASURE_STAKED_LP_DECIMALS);
      const record = createTokenRecord(
        config,
        timestamp,
        `${getContractName(config, magicToken.address)} - Staked (veMAGIC)`,
        magicToken.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      );
      record.isLiquid = false;
      records.push(record);
    }
  }
}

// ----- UniV3 NFT POL (Ethereum) -----

async function pushUniv3NftPol(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const manager = config.univ3PositionManager;
  if (!manager) return;
  if (blockNumber < BigInt(manager.startBlock)) return;

  // Build a token-pair → pool lookup from this chain's univ3 handlers so we
  // can match each NFT position to a pool we know about (and have indexed
  // sqrtPriceX96 for).
  const univ3Pools = new Map<string, { id: string; tokens: string[] }>();
  for (const handler of config.liquidityHandlers) {
    if (handler.kind !== "univ3") continue;
    const sorted = [handler.tokens[0]?.toLowerCase(), handler.tokens[1]?.toLowerCase()]
      .filter(Boolean)
      .sort()
      .join("/");
    univ3Pools.set(sorted, { id: handler.id, tokens: handler.tokens });
  }
  if (univ3Pools.size === 0) return;

  for (const wallet of config.protocolAddresses) {
    const result = (await context.effect(snapshotUniv3NftPositions, {
      chainId: config.chainId,
      positionManager: manager.address,
      wallet,
      atBlock: Number(blockNumber),
    })) as {
      positions: Array<{
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
      }>;
    };
    if (result.positions.length === 0) continue;

    for (const position of result.positions) {
      const pairKey = [position.token0, position.token1].sort().join("/");
      const pool = univ3Pools.get(pairKey);
      if (!pool) continue;

      // sqrtPriceX96 sourced from indexed Univ3PoolState (no RPC).
      const state = await context.Univ3PoolState.get(`${config.chainId}-${addr(pool.id)}`);
      if (!state || state.sqrtPriceX96 === 0n) continue;

      const amounts = univ3PositionAmounts(
        BigInt(position.liquidity),
        state.sqrtPriceX96,
        position.tickLower,
        position.tickUpper,
      );

      const decimals0 = getTokenDecimals(config.tokens, position.token0);
      const decimals1 = getTokenDecimals(config.tokens, position.token1);
      const balance0 = toDecimal(amounts.amount0, decimals0);
      const balance1 = toDecimal(amounts.amount1, decimals1);

      // Emit one TokenRecord per token in the position. Skip dust.
      if (!balance0.eq(ZERO)) {
        const rate0 = (await getPrice(config, context, client, position.token0, blockNumber, null))
          .price;
        records.push(
          createTokenRecord(
            config,
            timestamp,
            `${getContractName(config, position.token0)} - UniV3 POL (${getContractName(config, pool.id)})`,
            position.token0,
            getContractName(config, wallet),
            wallet,
            rate0,
            balance0,
            blockNumber,
          ),
        );
      }
      if (!balance1.eq(ZERO)) {
        const rate1 = (await getPrice(config, context, client, position.token1, blockNumber, null))
          .price;
        records.push(
          createTokenRecord(
            config,
            timestamp,
            `${getContractName(config, position.token1)} - UniV3 POL (${getContractName(config, pool.id)})`,
            position.token1,
            getContractName(config, wallet),
            wallet,
            rate1,
            balance1,
            blockNumber,
          ),
        );
      }
    }
  }
}

// ----- Cooler Loans receivables (Ethereum) -----

async function pushCoolerReceivables(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const clearinghouses = config.coolerClearinghouses ?? [];
  if (clearinghouses.length === 0) return;

  for (const clearinghouse of clearinghouses) {
    if (clearinghouse.startBlock && blockNumber < BigInt(clearinghouse.startBlock)) continue;

    const raw =
      clearinghouse.kind === "monocooler"
        ? ((await context.effect(readMonoCoolerTotalDebt, {
            chainId: config.chainId,
            monoCooler: clearinghouse.address,
            atBlock: Number(blockNumber),
          })) as string)
        : ((await context.effect(readCoolerPrincipalReceivables, {
            chainId: config.chainId,
            clearinghouse: clearinghouse.address,
            atBlock: Number(blockNumber),
          })) as string);
    if (raw === "") continue;

    const receivable = toDecimal(BigInt(raw), 18);
    if (receivable.eq(ZERO)) continue;

    const priceLookupToken = clearinghouse.priceToken ?? clearinghouse.receivableToken;
    const rate = (await getPrice(config, context, client, priceLookupToken, blockNumber, null))
      .price;
    if (rate.eq(ZERO)) continue;

    const receivableTokenLabel = `${getContractName(config, clearinghouse.receivableToken)} - Borrowed Through ${clearinghouse.name}`;
    records.push(
      createTokenRecord(
        config,
        timestamp,
        receivableTokenLabel,
        clearinghouse.receivableToken,
        clearinghouse.name,
        clearinghouse.address,
        rate,
        receivable,
        blockNumber,
      ),
    );
  }
}

// ----- Boosted Liquidity Vault supplies (Ethereum) -----

const BLV_OHM_DECIMALS = 9;

async function pushBlvSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const registry = config.blvRegistry;
  if (!registry) return;
  if (blockNumber < BigInt(registry.startBlock)) return;

  const snapshot = (await context.effect(snapshotBlvRegistry, {
    chainId: config.chainId,
    registry: registry.address,
    atBlock: Number(blockNumber),
  })) as { vaults: string[]; ohmShares: string[] };

  for (let i = 0; i < snapshot.vaults.length; i++) {
    const raw = snapshot.ohmShares[i];
    if (!raw || raw === "0") continue;
    const balance = toDecimal(BigInt(raw), BLV_OHM_DECIMALS);
    if (balance.eq(ZERO)) continue;
    const vault = snapshot.vaults[i];
    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        vault,
        vault,
        "Boosted Liquidity Vault",
        balance,
        blockNumber,
        -1,
      ),
    );
  }
}

// ----- Migration offset supply (Ethereum) -----

const SOHM_INDEX_DECIMALS = 9;
const TYPE_OFFSET = "OHM Migration Offset";

async function pushMigrationOffsetSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const offset = config.migrationOffset;
  if (!offset) return;
  if (blockNumber < BigInt(offset.startBlock)) return;
  if (blockNumber >= BigInt(offset.endBlock)) return;

  const indexState = await context.OhmIndexState.get(
    `${config.chainId}-${addr(offset.sOhmAddress)}`,
  );
  if (!indexState || indexState.index === 0n) return;

  const index = toDecimal(indexState.index, SOHM_INDEX_DECIMALS);
  const offsetOhm = new BigNumberCtor(offset.offsetOhm);
  const offsetAmount = offsetOhm.times(index);
  if (offsetAmount.eq(ZERO)) return;

  supplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      getContractName(config, offset.migrationContract),
      offset.migrationContract,
      TYPE_OFFSET,
      offsetAmount,
      blockNumber,
      -1,
    ),
  );
}

// ----- GnosisAuction bond supplies (Ethereum) -----

const BOND_OHM_DECIMALS = 9;
const TYPE_BONDS_PREMINTED = "Bonds (Pre-Minted)";
const TYPE_BONDS_VESTING_DEPOSITS = "Bonds (Vesting Deposits)";
const TYPE_BONDS_VESTING_TOKENS = "Bonds (Vesting Tokens)";
const TYPE_BONDS_DEPOSITS = "Bonds (Deposits)";

async function pushGnosisAuctionSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const bondManager = config.bondManager;
  if (!bondManager) return;
  if (blockNumber < BigInt(bondManager.startBlock)) return;

  const state = (await context.effect(readBondManagerState, {
    chainId: config.chainId,
    bondManager: bondManager.address,
    atBlock: Number(blockNumber),
  })) as { isActive: boolean; teller: string };
  if (!state.isActive) return;
  const tellerAddress = addr(state.teller);

  // Fetch all GnosisAuction rows for this chain.
  const auctions = await context.GnosisAuction.getWhere({
    chainId: { _eq: config.chainId },
  });
  if (auctions.length === 0) return;

  // BondManager OHM balance at this block — for adjusting fully-vested
  // entries to account for partial burns.
  const balanceEntity = await context.TokenBalance.get(
    `${config.chainId}-${addr(config.ohmToken)}-${addr(bondManager.address)}`,
  );
  const bondManagerOhmBalanceRaw = balanceEntity?.balance ?? 0n;
  const bondManagerOhmBalance = toDecimal(bondManagerOhmBalanceRaw, BOND_OHM_DECIMALS);

  // First pass: compute totalBurnableOhm = sum of bidQuantity for auctions
  // whose expiry has passed; and bondManagerOhmBalanceUnallocated = balance
  // minus bidQuantity for closed-but-vesting auctions.
  let totalBurnableOhm = ZERO;
  let bondManagerOhmBalanceUnallocated = bondManagerOhmBalance;
  for (const auction of auctions) {
    if (auction.bidQuantity === undefined || auction.bidQuantity === null) continue;
    if (auction.auctionCloseTimestamp === undefined || auction.auctionCloseTimestamp === null) {
      continue;
    }
    const bidQuantity = bigDecimalToBigNumber(auction.bidQuantity);
    const expiry = auction.auctionCloseTimestamp + auction.termSeconds;
    if (timestamp < expiry) {
      bondManagerOhmBalanceUnallocated = bondManagerOhmBalanceUnallocated.minus(bidQuantity);
    } else {
      totalBurnableOhm = totalBurnableOhm.plus(bidQuantity);
    }
  }
  const cappedBondManagerOhm = bondManagerOhmBalanceUnallocated.gt(totalBurnableOhm)
    ? totalBurnableOhm
    : bondManagerOhmBalanceUnallocated;

  // Second pass: emit per-auction TokenSupply rows.
  for (const auction of auctions) {
    const auctionLabel = auction.marketId.toString();
    const ohmName = getContractName(config, config.ohmToken);

    if (auction.bidQuantity === undefined || auction.bidQuantity === null) {
      // Open auction: capacity is pre-minted at the teller.
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, tellerAddress),
          tellerAddress,
          TYPE_BONDS_PREMINTED,
          bigDecimalToBigNumber(auction.payoutCapacity),
          blockNumber,
          -1,
        ),
      );
      continue;
    }

    const closeTimestamp = auction.auctionCloseTimestamp;
    if (closeTimestamp === undefined || closeTimestamp === null) continue;
    const expiry = closeTimestamp + auction.termSeconds;
    const bidQuantity = bigDecimalToBigNumber(auction.bidQuantity);

    if (timestamp < expiry) {
      // Closed but vesting: deposits at BondManager, tokens at teller.
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, bondManager.address),
          bondManager.address,
          TYPE_BONDS_VESTING_DEPOSITS,
          bidQuantity,
          blockNumber,
          -1,
        ),
      );
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, tellerAddress),
          tellerAddress,
          TYPE_BONDS_VESTING_TOKENS,
          bigDecimalToBigNumber(auction.payoutCapacity),
          blockNumber,
          -1,
        ),
      );
      continue;
    }

    // Fully vested: adjusted deposits at BondManager.
    if (totalBurnableOhm.eq(ZERO)) continue;
    const adjustedBidQuantity = bidQuantity.times(cappedBondManagerOhm).div(totalBurnableOhm);
    if (adjustedBidQuantity.eq(ZERO)) continue;
    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        ohmName,
        config.ohmToken,
        auctionLabel,
        undefined,
        getContractName(config, bondManager.address),
        bondManager.address,
        TYPE_BONDS_DEPOSITS,
        adjustedBidQuantity,
        blockNumber,
        -1,
      ),
    );
  }
}

function bigDecimalToBigNumber(value: BigDecimal | string | null | undefined): BigNumber {
  if (value === null || value === undefined) return ZERO;
  return new BigNumberCtor(typeof value === "string" ? value : value.toString());
}

// ----- Token supplies (OHM total / treasury / liquidity / lending) -----

async function pushTotalSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (config.ohmStartBlock && blockNumber < BigInt(config.ohmStartBlock)) return;

  const entity = await context.Erc20Supply.get(`${config.chainId}-${addr(config.ohmToken)}`);
  if (!entity) return;

  const balance = toDecimal(entity.totalSupply, 9); // OHM is 9 decimals on Arbitrum and Berachain
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

async function pushTreasuryOhm(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (config.ohmStartBlock && blockNumber < BigInt(config.ohmStartBlock)) return;

  for (const wallet of config.circulatingSupplyWallets) {
    const balance = await readTokenBalance(context, config.chainId, config.ohmToken, wallet, 9);
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
  for (const handler of config.ownedLiquidityHandlers) {
    if (!isActive(handler, blockNumber)) continue;
    if (!matches(handler, config.ohmToken)) continue;

    for (const wallet of config.circulatingSupplyWallets) {
      const balance = await getUnderlyingTokenBalance(
        config,
        context,
        client,
        handler,
        wallet,
        config.ohmToken,
        blockNumber,
      );
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

async function pushArbitrumLendingSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (blockNumber >= ARBITRUM_DYNAMIC_LENDING_START_BLOCK) {
    // deployedOhm is now maintained by Erc20Transfers.ts from OHM mints/burns
    // involving each AMO. Just read the entity and emit supply records.
    const activeAmos = await context.LenderAmo.getWhere({ active: { _eq: true } });
    for (const amo of activeAmos) {
      if (amo.chainId !== config.chainId) continue;
      if (amo.deployedOhm === 0n) continue;
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          undefined,
          undefined,
          `${getContractName(config, OLYMPUS_LENDER)} - ${addr(amo.amoAddress)}`,
          addr(amo.amoAddress),
          "Lending",
          toDecimal(amo.deployedOhm, 9),
          blockNumber,
          -1,
        ),
      );
    }
  }

  for (const market of [
    {
      name: getContractName(config, SILO_COLLATERAL),
      address: SILO_COLLATERAL,
      startBlock: SILO_COLLATERAL_START_BLOCK,
      decimals: 9,
    },
    {
      name: getContractName(config, SENTIMENT_LTOKEN),
      address: SENTIMENT_LTOKEN,
      startBlock: SENTIMENT_LTOKEN_START_BLOCK,
      decimals: 9,
    },
  ]) {
    if (blockNumber < market.startBlock) continue;
    const wallets = getWalletAddressesForContract(config, market.address);
    for (const wallet of wallets) {
      const balance = await readTokenBalance(
        context,
        config.chainId,
        market.address,
        wallet,
        market.decimals,
      );
      if (balance.eq(ZERO)) continue;
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          market.name,
          market.address,
          getContractName(config, wallet),
          wallet,
          "Lending",
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}

// ----- Helpers -----

async function readTokenBalance(
  context: EvmOnBlockContext,
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  decimals: number,
): Promise<BigNumber> {
  const id = `${chainId}-${addr(tokenAddress)}-${addr(walletAddress)}`;
  const entity = await context.TokenBalance.get(id);
  if (!entity || entity.balance === 0n) return ZERO;
  return toDecimal(entity.balance, decimals);
}

function getLpTokenForHandler(handler: LiquidityHandler): string | null {
  if (handler.kind === "univ2") return addr(handler.id);
  if (handler.kind === "balancer") {
    // Balancer V2 poolId encodes the pool token address in the first 20 bytes.
    return `0x${handler.id.slice(2, 42)}`;
  }
  if (handler.kind === "kodiak") return addr(handler.rewardVault ?? handler.pool);
  // Univ3 LP positions are NFT-based; no fungible LP balance to track.
  // Stable / remap have no LP token.
  return null;
}
