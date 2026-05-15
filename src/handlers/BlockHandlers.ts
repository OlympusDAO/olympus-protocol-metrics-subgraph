import type BigNumber from "bignumber.js";
import {
  BigDecimal,
  type EvmOnBlockContext,
  indexer,
  type TokenRecord,
  type TokenSupply,
} from "envio";
import {
  getPrice,
  getTotalValue,
  getUnderlyingTokenBalance,
  getUnitPrice,
  withPricingCache,
} from "../pricing";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { OLYMPUS_LENDER, SENTIMENT_LTOKEN, SILO_COLLATERAL } from "../snapshot/chains/arbitrum";
import { getClient, withContractReadCache } from "../snapshot/contracts";
import { addr, getTokenDecimals, isActive, matches, toDecimal, ZERO } from "../snapshot/math";
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

  await withContractReadCache(() =>
    withPricingCache(async () => {
      // TODO(timestamp): use the chain's block timestamp once Envio's onBlock
      // handler surfaces it. For now we use the block number as the timestamp
      // value so the snapshot record IDs stay unique and the field is populated.
      const timestamp = blockNumber;

      await pushTokenBalanceRecords(context, config, client, records, timestamp, blockNumber);
      await pushOwnedLiquidityRecords(context, config, client, records, timestamp, blockNumber);
      if (config.chainId === 42161) {
        await pushArbitrumStakingRecords(context, config, records, timestamp, blockNumber);
      }

      await pushTotalSupply(context, config, supplies, timestamp, blockNumber);
      await pushTreasuryOhm(context, config, supplies, timestamp, blockNumber);
      await pushOwnedLiquiditySupply(context, config, client, supplies, timestamp, blockNumber);
      if (config.chainId === 42161) {
        await pushArbitrumLendingSupply(context, config, supplies, timestamp, blockNumber);
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

  context.log.info(
    `Finished ${name} block ${blockNumberInput} on chain ${chainId} in ${Date.now() - startedAt}ms`,
    { tokenRecords: records.length, tokenSupplies: supplies.length },
  );
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

      if (definition.address === config.nativeToken) {
        // TODO(native-balances): native BERA balance has no Transfer event, so it
        // is not maintained in TokenBalance. Skip for now; revisit by adding a
        // bounded RPC `getBalance` per protocol address at snapshot time.
        continue;
      }

      const rate = (await getPrice(config, context, client, definition.address, blockNumber, null))
        .price;
      if (rate.eq(ZERO)) continue;

      const wallets = getWalletAddressesForContract(config, definition.address);
      const decimals = getTokenDecimals(config.tokens, definition.address);
      for (const wallet of wallets) {
        const balance = await readTokenBalance(
          context,
          config.chainId,
          definition.address,
          wallet,
          decimals,
        );
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

    rate ??= (await getPrice(config, context, client, jonesToken.address, blockNumber, null))
      .price;
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
