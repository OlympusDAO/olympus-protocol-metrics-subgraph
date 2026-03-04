import type { Address, PublicClient } from "viem";
import { getChainConfig } from "../../config/chains";
import type { ChainConfig, TokenDefinition } from "../../config/types";
import {
  readERC20Balance,
  readERC20BalancesMulticall,
  readERC20TotalSupply,
  readNativeBalance,
} from "../../lib/contracts";
import { toDateString, findTokenByAddress } from "../../lib/helpers";
import type { PriceHandler, PriceLookupResult } from "../../lib/priceHandlers/types";
import { getUSDRate } from "../../lib/priceHandlers/router";
import { getChainlinkPrice } from "../../lib/priceHandlers/chainlink";

// Re-export supply type constants matching the existing subgraph
const TYPE_TOTAL_SUPPLY = "TotalSupply";
const TYPE_TREASURY = "Treasury";
const TYPE_LIQUIDITY = "Liquidity";
const TYPE_LENDING = "Lending";

// ---- Token Record types ----

interface TokenRecordData {
  token: string;
  tokenAddress: string;
  source: string;
  sourceAddress: string;
  rate: number;
  balance: number;
  multiplier: number;
  value: number;
  valueExcludingOhm: number;
  category: "Stable" | "Volatile" | "ProtocolOwnedLiquidity";
  isLiquid: boolean;
  isBluechip: boolean;
}

interface TokenSupplyData {
  token: string;
  tokenAddress: string;
  pool: string | null;
  poolAddress: string | null;
  source: string | null;
  sourceAddress: string | null;
  type: string;
  balance: number;
  supplyBalance: number;
}

// ---- Price lookup with Chainlink base tokens ----

function createPriceLookup(
  config: ChainConfig,
  handlers: PriceHandler[],
  client: PublicClient,
): (tokenAddress: string, blockNumber: bigint, currentPool: string | null) => Promise<PriceLookupResult | null> {
  return async (tokenAddress: string, blockNumber: bigint, currentPool: string | null) => {
    // Check Chainlink feeds first (base tokens)
    for (const feed of config.chainlinkFeeds) {
      const tokenDef = findTokenByAddress(config.tokenDefinitions, tokenAddress);
      if (tokenDef && tokenDef.name === feed.token) {
        return getChainlinkPrice(client, feed.feedAddress, blockNumber);
      }
    }

    // Fall back to handler-based pricing
    return getUSDRate(tokenAddress, handlers, async (addr, block, pool) => {
      // Recursive: check Chainlink first, then handlers
      for (const feed of config.chainlinkFeeds) {
        const td = findTokenByAddress(config.tokenDefinitions, addr);
        if (td && td.name === feed.token) {
          return getChainlinkPrice(client, feed.feedAddress, block);
        }
      }
      return getUSDRate(addr, handlers, async () => null, block, client, pool);
    }, blockNumber, client, currentPool);
  };
}

// ---- Token Record Generation ----

/**
 * Get token balance records for all tokens in a category across all protocol wallets.
 */
async function getTokenBalances(
  config: ChainConfig,
  category: "Stable" | "Volatile",
  priceLookup: (addr: string, block: bigint, pool: string | null) => Promise<PriceLookupResult | null>,
  blockNumber: bigint,
  client: PublicClient,
): Promise<TokenRecordData[]> {
  const records: TokenRecordData[] = [];
  const tokens = config.tokenDefinitions.filter((t) => t.category === category);

  for (const token of tokens) {
    // Check block guards (e.g., skip LUSD before its start block)
    if (config.blockGuards) {
      const guardKey = `${token.name}_START_BLOCK`;
      const guardBlock = config.blockGuards[guardKey];
      if (guardBlock && blockNumber < guardBlock) continue;
    }

    // Get price
    const priceResult = await priceLookup(token.address, blockNumber, null);
    if (!priceResult) continue;
    const rate = priceResult.price;

    // Get wallets, filtering out blacklisted ones for this token
    const blacklistedWallets = config.treasuryBlacklist.get(token.address.toLowerCase() as Address) || [];
    const wallets = config.protocolAddresses.filter(
      (w) => !blacklistedWallets.some((b) => b.toLowerCase() === w.toLowerCase()),
    );

    // Native token (BERA) balance
    if (token.address === "0x0000000000000000000000000000000000000000") {
      for (const wallet of wallets) {
        const balance = await readNativeBalance(client, wallet, blockNumber);
        if (balance === 0) continue;

        const value = balance * rate;
        const multiplier = token.liquidBackingMultiplier;
        records.push({
          token: token.name,
          tokenAddress: token.address,
          source: wallet,
          sourceAddress: wallet,
          rate,
          balance,
          multiplier,
          value,
          valueExcludingOhm: value * multiplier,
          category: token.category,
          isLiquid: token.isLiquid,
          isBluechip: token.isBluechip,
        });
      }
      continue;
    }

    // ERC20 balances via multicall
    const balances = await readERC20BalancesMulticall(client, token.address, wallets, blockNumber);

    for (const [walletAddr, balance] of balances) {
      if (balance === 0) continue;
      const value = balance * rate;
      const multiplier = token.liquidBackingMultiplier;
      records.push({
        token: token.name,
        tokenAddress: token.address,
        source: walletAddr,
        sourceAddress: walletAddr,
        rate,
        balance,
        multiplier,
        value,
        valueExcludingOhm: value * multiplier,
        category: token.category,
        isLiquid: token.isLiquid,
        isBluechip: token.isBluechip,
      });
    }
  }

  return records;
}

/**
 * Get owned liquidity balance records for all LP positions.
 */
async function getOwnedLiquidityBalances(
  config: ChainConfig,
  handlers: PriceHandler[],
  priceLookup: (addr: string, block: bigint, pool: string | null) => Promise<PriceLookupResult | null>,
  blockNumber: bigint,
  client: PublicClient,
): Promise<TokenRecordData[]> {
  const records: TokenRecordData[] = [];

  for (const handler of handlers) {
    // Calculate non-OHM multiplier: value(excluding OHM tokens) / totalValue
    const totalValue = await handler.getTotalValue([], priceLookup, blockNumber, client);
    if (!totalValue || totalValue === 0) continue;

    const includedValue = await handler.getTotalValue(
      config.ohmTokens.map((t) => t.toLowerCase()),
      priceLookup,
      blockNumber,
      client,
    );
    if (includedValue === null) continue;
    const multiplier = includedValue / totalValue;

    // Get unit price
    const unitRate = await handler.getUnitPrice(priceLookup, blockNumber, client);
    if (!unitRate) continue;

    // Check balances across all protocol wallets
    for (const wallet of config.protocolAddresses) {
      const balance = await handler.getBalance(wallet, blockNumber, client);
      if (balance === 0) continue;

      const tokenDef = findTokenByAddress(config.tokenDefinitions, handler.getId());
      const value = balance * unitRate;

      records.push({
        token: tokenDef?.name || handler.getId(),
        tokenAddress: handler.getId(),
        source: wallet,
        sourceAddress: wallet,
        rate: unitRate,
        balance,
        multiplier,
        value,
        valueExcludingOhm: value * multiplier,
        category: "ProtocolOwnedLiquidity",
        isLiquid: tokenDef?.isLiquid ?? true,
        isBluechip: false,
      });
    }
  }

  return records;
}

// ---- Token Supply Generation ----

async function getTotalSupply(
  config: ChainConfig,
  blockNumber: bigint,
  client: PublicClient,
): Promise<TokenSupplyData[]> {
  const totalSupply = await readERC20TotalSupply(client, config.ohmAddress, blockNumber);
  if (totalSupply === 0) return [];

  return [{
    token: "OHM",
    tokenAddress: config.ohmAddress,
    pool: null,
    poolAddress: null,
    source: null,
    sourceAddress: null,
    type: TYPE_TOTAL_SUPPLY,
    balance: totalSupply,
    supplyBalance: totalSupply,
  }];
}

async function getTreasuryOHMRecords(
  config: ChainConfig,
  blockNumber: bigint,
  client: PublicClient,
): Promise<TokenSupplyData[]> {
  const records: TokenSupplyData[] = [];

  // Check start block guard
  if (blockNumber < config.startBlock) return records;

  for (const ohmToken of config.ohmTokens) {
    const balances = await readERC20BalancesMulticall(
      client,
      ohmToken,
      config.circulatingSupplyWallets,
      blockNumber,
    );

    for (const [wallet, balance] of balances) {
      if (balance === 0) continue;
      const tokenDef = findTokenByAddress(config.tokenDefinitions, ohmToken);
      records.push({
        token: tokenDef?.name || "OHM",
        tokenAddress: ohmToken,
        pool: null,
        poolAddress: null,
        source: wallet,
        sourceAddress: wallet,
        type: TYPE_TREASURY,
        balance,
        supplyBalance: balance * -1, // Subtract from supply
      });
    }
  }

  return records;
}

async function getProtocolOwnedLiquiditySupplyRecords(
  config: ChainConfig,
  handlers: PriceHandler[],
  blockNumber: bigint,
  client: PublicClient,
): Promise<TokenSupplyData[]> {
  const records: TokenSupplyData[] = [];

  if (blockNumber < config.startBlock) return records;

  for (const handler of handlers) {
    for (const ohmToken of config.ohmTokens) {
      if (!handler.matches(ohmToken)) continue;

      for (const wallet of config.circulatingSupplyWallets) {
        const balance = await handler.getUnderlyingTokenBalance(wallet, ohmToken, blockNumber, client);
        if (balance === 0) continue;

        const tokenDef = findTokenByAddress(config.tokenDefinitions, ohmToken);
        records.push({
          token: tokenDef?.name || "OHM",
          tokenAddress: ohmToken,
          pool: handler.getId(),
          poolAddress: handler.getId(),
          source: wallet,
          sourceAddress: wallet,
          type: TYPE_LIQUIDITY,
          balance,
          supplyBalance: balance * -1,
        });
      }
    }
  }

  return records;
}

// ---- Main Handler ----

export interface BlockContext {
  chainId: number;
  blockNumber: bigint;
  timestamp: number;
  client: PublicClient;
  db: any; // Ponder context.db
}

/**
 * Unified L2 block handler.
 * Generates TokenRecords, TokenSupply, DailyTreasurySnapshot, and ChainSyncStatus
 * for any L2 chain, parameterized by ChainConfig.
 */
export async function handleBlock(ctx: BlockContext): Promise<void> {
  const config = getChainConfig(ctx.chainId);
  const date = toDateString(ctx.timestamp);

  // Build price handlers from config
  // TODO: Instantiate actual PriceHandler objects from config.priceHandlers
  // For now this is a placeholder — each handler type needs to be constructed
  const handlers: PriceHandler[] = [];

  const priceLookup = createPriceLookup(config, handlers, ctx.client);

  // Generate TokenRecords
  const stableRecords = await getTokenBalances(config, "Stable", priceLookup, ctx.blockNumber, ctx.client);
  const volatileRecords = await getTokenBalances(config, "Volatile", priceLookup, ctx.blockNumber, ctx.client);
  const polRecords = await getOwnedLiquidityBalances(config, handlers, priceLookup, ctx.blockNumber, ctx.client);
  const allRecords = [...stableRecords, ...volatileRecords, ...polRecords];

  // Write TokenRecords to DB
  for (const record of allRecords) {
    await ctx.db.insert("tokenRecord").values({
      id: `${config.chainId}/${date}/${ctx.blockNumber}/${record.source}/${record.token}`,
      chainId: config.chainId,
      blockchain: config.blockchain,
      block: ctx.blockNumber,
      timestamp: ctx.timestamp,
      date,
      ...record,
    });
  }

  // Generate TokenSupply records
  const supplyRecords: TokenSupplyData[] = [];
  supplyRecords.push(...await getTotalSupply(config, ctx.blockNumber, ctx.client));
  supplyRecords.push(...await getTreasuryOHMRecords(config, ctx.blockNumber, ctx.client));
  supplyRecords.push(...await getProtocolOwnedLiquiditySupplyRecords(config, handlers, ctx.blockNumber, ctx.client));
  // TODO: Lending market supply records (Arbitrum-specific)

  for (const record of supplyRecords) {
    await ctx.db.insert("tokenSupply").values({
      id: `${config.chainId}/${date}/${ctx.blockNumber}/${record.token}/${record.type}/${record.source || ""}`,
      chainId: config.chainId,
      blockchain: config.blockchain,
      block: ctx.blockNumber,
      timestamp: ctx.timestamp,
      date,
      ...record,
    });
  }

  // Compute daily aggregate
  const marketValue = allRecords.reduce((sum, r) => sum + r.value, 0);
  const liquidBacking = allRecords
    .filter((r) => r.isLiquid)
    .reduce((sum, r) => sum + r.valueExcludingOhm, 0);
  const stableValue = allRecords
    .filter((r) => r.category === "Stable")
    .reduce((sum, r) => sum + r.value, 0);
  const volatileValue = allRecords
    .filter((r) => r.category === "Volatile")
    .reduce((sum, r) => sum + r.value, 0);
  const polValue = allRecords
    .filter((r) => r.category === "ProtocolOwnedLiquidity")
    .reduce((sum, r) => sum + r.value, 0);
  const stableLiquidValue = allRecords
    .filter((r) => r.category === "Stable" && r.isLiquid)
    .reduce((sum, r) => sum + r.valueExcludingOhm, 0);
  const volatileLiquidValue = allRecords
    .filter((r) => r.category === "Volatile" && r.isLiquid)
    .reduce((sum, r) => sum + r.valueExcludingOhm, 0);
  const polLiquidValue = allRecords
    .filter((r) => r.category === "ProtocolOwnedLiquidity" && r.isLiquid)
    .reduce((sum, r) => sum + r.valueExcludingOhm, 0);

  await ctx.db
    .insert("dailyTreasurySnapshot")
    .values({
      id: `${config.chainId}/${date}`,
      chainId: config.chainId,
      blockchain: config.blockchain,
      date,
      timestamp: ctx.timestamp,
      block: ctx.blockNumber,
      marketValue,
      liquidBacking,
      stableValue,
      volatileValue,
      polValue,
      stableLiquidValue,
      volatileLiquidValue,
      polLiquidValue,
    })
    .onConflictDoUpdate({
      timestamp: ctx.timestamp,
      block: ctx.blockNumber,
      marketValue,
      liquidBacking,
      stableValue,
      volatileValue,
      polValue,
      stableLiquidValue,
      volatileLiquidValue,
      polLiquidValue,
    });

  // Update chain sync status
  await ctx.db
    .insert("chainSyncStatus")
    .values({
      id: config.chainId,
      blockchain: config.blockchain,
      latestDate: date,
      latestBlock: ctx.blockNumber,
      latestTimestamp: ctx.timestamp,
    })
    .onConflictDoUpdate({
      latestDate: date,
      latestBlock: ctx.blockNumber,
      latestTimestamp: ctx.timestamp,
    });
}
