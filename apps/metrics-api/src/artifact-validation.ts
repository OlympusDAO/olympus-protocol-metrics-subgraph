import { z } from "zod";
import {
  CHAIN_NAMES,
  type DailyMetric,
  type Manifest,
  type OhmSupply,
  type TreasuryAsset,
} from "../../../packages/metrics-artifacts/src/index.js";

function perChain<T extends z.ZodType>(value: T) {
  return z.object({
    Arbitrum: value,
    Ethereum: value,
    Fantom: value,
    Polygon: value,
    Base: value,
    Berachain: value,
    Robinhood: value,
  });
}

const date = z.iso.date();
const amount = z.number();
// Older shards can predate a chain. Preserve the zero-state semantics.
const chainValues = perChain(amount.default(0));
const treasuryAsset = z.object({
  id: z.string(),
  balance: amount,
  block: z.number().int().nonnegative(),
  blockchain: z.string(),
  category: z.string(),
  date,
  isBluechip: z.boolean(),
  isLiquid: z.boolean(),
  multiplier: amount,
  rate: amount,
  source: z.string(),
  sourceAddress: z.string(),
  timestamp: amount,
  token: z.string(),
  tokenAddress: z.string(),
  value: amount,
  valueExcludingOhm: amount,
}) satisfies z.ZodType<TreasuryAsset>;
const ohmSupply = z.object({
  id: z.string(),
  balance: amount,
  block: z.number().int().nonnegative(),
  blockchain: z.string(),
  date,
  pool: z.string().nullable().optional(),
  poolAddress: z.string().nullable().optional(),
  source: z.string(),
  sourceAddress: z.string(),
  supplyBalance: amount,
  timestamp: amount,
  token: z.string(),
  tokenAddress: z.string(),
  type: z.string(),
}) satisfies z.ZodType<OhmSupply>;
const treasuryRecords = perChain(z.array(treasuryAsset).default(() => []));
const supplyRecords = perChain(z.array(ohmSupply).default(() => []));

const dailyMetric = z.object({
  date,
  blocks: chainValues,
  timestamps: chainValues,
  ohmIndex: amount,
  ohmApy: amount,
  ohmTotalSupply: amount,
  ohmTotalSupplyComponents: chainValues,
  ohmCirculatingSupply: amount,
  ohmCirculatingSupplyComponents: chainValues,
  ohmFloatingSupply: amount,
  ohmFloatingSupplyComponents: chainValues,
  ohmBackedSupply: amount,
  gOhmBackedSupply: amount,
  ohmBackedSupplyComponents: chainValues,
  ohmSupplyCategories: z.object({
    BondsDeposits: amount,
    BondsPreminted: amount,
    BondsVestingDeposits: amount,
    BondsVestingTokens: amount,
    BoostedLiquidityVault: amount,
    LendingMarkets: amount,
    ProtocolOwnedLiquidity: amount,
    MigrationOffset: amount,
    TotalSupply: amount,
    Treasury: amount,
  }),
  ohmPrice: amount,
  gOhmPrice: amount,
  marketCap: amount,
  sOhmCirculatingSupply: amount,
  sOhmTotalValueLocked: amount,
  treasuryMarketValue: amount,
  treasuryMarketValueComponents: chainValues,
  treasuryLiquidBacking: amount,
  treasuryLiquidBackingComponents: chainValues,
  treasuryLiquidBackingPerOhmFloating: amount,
  treasuryLiquidBackingPerOhmBacked: amount,
  treasuryLiquidBackingPerGOhmBacked: amount,
  ohmTotalSupplyRecords: supplyRecords.optional(),
  ohmCirculatingSupplyRecords: supplyRecords.optional(),
  ohmFloatingSupplyRecords: supplyRecords.optional(),
  ohmBackedSupplyRecords: supplyRecords.optional(),
  treasuryMarketValueRecords: treasuryRecords.optional(),
  treasuryLiquidBackingRecords: treasuryRecords.optional(),
  _meta: z.object({
    chainsComplete: z.array(z.string()),
    chainsFailed: z.array(z.string()),
    timestamp: z.string(),
  }),
  crossChainComplete: z.boolean(),
  chainsIndexed: z.array(z.number().int()),
  chainsMissing: z.array(z.number().int()),
}) satisfies z.ZodType<DailyMetric>;

export const manifestSchema = z
  .object({
    schemaVersion: z.string().min(1),
    generatedAt: z.iso.datetime(),
    earliestDate: date,
    latestDate: date,
    indexerDeploymentId: z.string().optional(),
    indexingProgress: z
      .object({
        chains: z.partialRecord(
          z.enum(CHAIN_NAMES),
          z.object({
            block: z.number().int().nonnegative(),
            date,
            timestamp: z.number().int().nonnegative(),
          }),
        ),
      })
      .optional(),
    artifacts: z
      .record(
        z.string(),
        z.object({
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          byteLength: z.number().int().nonnegative(),
          rowCount: z.number().int().nonnegative(),
        }),
      )
      .optional(),
  })
  .refine(
    (value) => value.earliestDate <= value.latestDate,
    "Invalid manifest date bounds",
  ) satisfies z.ZodType<Manifest>;

export const dailyMetricsSchema = z.array(dailyMetric);
export const treasuryAssetsSchema = z.array(treasuryAsset);
export const ohmSuppliesSchema = z.array(ohmSupply);
