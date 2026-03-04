import { onchainTable, onchainEnum, index } from "ponder";

export const tokenCategory = onchainEnum("token_category", [
  "Stable",
  "Volatile",
  "ProtocolOwnedLiquidity",
]);

export const supplyType = onchainEnum("supply_type", [
  "TotalSupply",
  "Treasury",
  "Liquidity",
  "Lending",
  "BondsDeposits",
  "BondsPreminted",
  "BondsVestingDeposits",
  "BondsVestingTokens",
  "BoostedLiquidityVault",
  "ManualOffset",
]);

/**
 * Per-token per-wallet treasury holding snapshot.
 * Immutable per block — later blocks for the same day overwrite via upsert on dailyTreasurySnapshot.
 */
export const tokenRecord = onchainTable(
  "token_record",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    blockchain: t.text().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    date: t.text().notNull(),
    token: t.text().notNull(),
    tokenAddress: t.text().notNull(),
    source: t.text().notNull(),
    sourceAddress: t.text().notNull(),
    rate: t.real().notNull(),
    balance: t.real().notNull(),
    multiplier: t.real().notNull(),
    value: t.real().notNull(),
    valueExcludingOhm: t.real().notNull(),
    category: tokenCategory("category").notNull(),
    isLiquid: t.boolean().notNull(),
    isBluechip: t.boolean().notNull(),
  }),
  (table) => ({
    dateIdx: index().on(table.date),
    chainDateIdx: index().on(table.chainId, table.date),
    blockchainIdx: index().on(table.blockchain),
  }),
);

/**
 * OHM supply component snapshot.
 * Each record represents a supply source (treasury, liquidity, bonds, etc.).
 * supplyBalance may be negative (supply-reducing entries).
 */
export const tokenSupply = onchainTable(
  "token_supply",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    blockchain: t.text().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    date: t.text().notNull(),
    token: t.text().notNull(),
    tokenAddress: t.text().notNull(),
    pool: t.text(),
    poolAddress: t.text(),
    source: t.text(),
    sourceAddress: t.text(),
    type: supplyType("type").notNull(),
    balance: t.real().notNull(),
    supplyBalance: t.real().notNull(),
  }),
  (table) => ({
    dateIdx: index().on(table.date),
    chainDateIdx: index().on(table.chainId, table.date),
  }),
);

/**
 * Server-side daily aggregate per chain.
 * Replaces frontend's getDateTokenRecordSummary() computation.
 * Upserted on each block — latest block per day wins.
 */
export const dailyTreasurySnapshot = onchainTable(
  "daily_treasury_snapshot",
  (t) => ({
    id: t.text().primaryKey(), // "{chainId}/{date}"
    chainId: t.integer().notNull(),
    blockchain: t.text().notNull(),
    date: t.text().notNull(),
    timestamp: t.integer().notNull(),
    block: t.bigint().notNull(),
    marketValue: t.real().notNull(),
    liquidBacking: t.real().notNull(),
    stableValue: t.real().notNull(),
    volatileValue: t.real().notNull(),
    polValue: t.real().notNull(),
    stableLiquidValue: t.real().notNull(),
    volatileLiquidValue: t.real().notNull(),
    polLiquidValue: t.real().notNull(),
  }),
  (table) => ({
    dateIdx: index().on(table.date),
    chainDateIdx: index().on(table.chainId, table.date),
  }),
);

/**
 * Tracks the latest indexed date per chain.
 * Used for cross-chain completeness checks (replaces middleware logic).
 */
export const chainSyncStatus = onchainTable("chain_sync_status", (t) => ({
  id: t.integer().primaryKey(), // chainId
  blockchain: t.text().notNull(),
  latestDate: t.text().notNull(),
  latestBlock: t.bigint().notNull(),
  latestTimestamp: t.integer().notNull(),
}));
