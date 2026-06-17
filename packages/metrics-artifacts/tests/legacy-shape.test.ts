import { describe, expect, test } from "vitest";
import type { OhmSupply, TreasuryAsset } from "../src";
import {
  buildDailyMetric,
  emptyChainValues,
  emptySupplyCategoryValues,
  groupOhmSupplyByChain,
  groupTreasuryAssetsByChain,
} from "../src";

const treasuryAsset: TreasuryAsset = {
  id: "asset-1",
  balance: 100,
  block: 25180800,
  blockchain: "Ethereum",
  category: "Stable",
  date: "2026-05-21",
  isBluechip: false,
  isLiquid: true,
  multiplier: 1,
  rate: 1,
  source: "Treasury MS",
  sourceAddress: "0xsource",
  timestamp: 1779814223,
  token: "USDe",
  tokenAddress: "0xtoken",
  value: 100,
  valueExcludingOhm: 100,
};

const ohmSupply: OhmSupply = {
  id: "supply-1",
  balance: 1000,
  block: 25180800,
  blockchain: "Ethereum",
  date: "2026-05-21",
  pool: null,
  poolAddress: null,
  source: "",
  sourceAddress: "",
  supplyBalance: 1000,
  timestamp: 1779814223,
  token: "OHM",
  tokenAddress: "0xohm",
  type: "Total Supply",
};

describe("legacy-compatible metric shape", () => {
  test("uses exact legacy chain keys and zero defaults", () => {
    expect(emptyChainValues()).toEqual({
      Arbitrum: 0,
      Ethereum: 0,
      Fantom: 0,
      Polygon: 0,
      Base: 0,
      Berachain: 0,
    });
  });

  test("uses exact legacy supply category keys and zero defaults", () => {
    expect(emptySupplyCategoryValues()).toEqual({
      BondsDeposits: 0,
      BondsPreminted: 0,
      BondsVestingDeposits: 0,
      BondsVestingTokens: 0,
      BoostedLiquidityVault: 0,
      LendingMarkets: 0,
      ProtocolOwnedLiquidity: 0,
      MigrationOffset: 0,
      TotalSupply: 0,
      Treasury: 0,
    });
  });

  test("groups treasury assets and OHM supply by legacy chain keys", () => {
    expect(groupTreasuryAssetsByChain([treasuryAsset]).Ethereum).toEqual([treasuryAsset]);
    expect(groupOhmSupplyByChain([ohmSupply]).Ethereum).toEqual([ohmSupply]);
  });

  test("omits metric record fields by default and includes metric-specific records when requested", () => {
    const compact = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      treasuryAssets: [treasuryAsset],
      ohmSupply: [ohmSupply],
      includeRecords: false,
      generatedAt: "2026-06-01T08:15:00.000Z",
    });
    expect(compact.treasuryMarketValueRecords).toBeUndefined();
    expect(compact.ohmTotalSupplyRecords).toBeUndefined();

    const withRecords = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      treasuryAssets: [treasuryAsset],
      ohmSupply: [ohmSupply],
      includeRecords: true,
      generatedAt: "2026-06-01T08:15:00.000Z",
    });
    expect(withRecords.treasuryMarketValueRecords?.Ethereum).toEqual([treasuryAsset]);
    expect(withRecords.ohmTotalSupplyRecords?.Ethereum).toEqual([ohmSupply]);
  });

  test("infers missing chains from available records", () => {
    const metric = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      treasuryAssets: [treasuryAsset],
      ohmSupply: [ohmSupply],
      generatedAt: "2026-06-01T08:15:00.000Z",
    });

    expect(metric.chainsIndexed).toEqual([1]);
    expect(metric.chainsMissing).toEqual([42161, 250, 137, 8453, 80094]);
    expect(metric.crossChainComplete).toBe(false);
    expect(metric._meta?.chainsComplete).toEqual(["Ethereum"]);
    expect(metric._meta?.chainsFailed).toEqual([
      "Arbitrum",
      "Fantom",
      "Polygon",
      "Base",
      "Berachain",
    ]);
  });

  test("marks cross-chain data complete when Arbitrum and Ethereum are indexed", () => {
    const metric = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      chainsIndexed: [42161, 1],
      generatedAt: "2026-06-01T08:15:00.000Z",
    });

    expect(metric.chainsMissing).toEqual([250, 137, 8453, 80094]);
    expect(metric.crossChainComplete).toBe(true);
  });

  test("marks cross-chain data incomplete when either Arbitrum or Ethereum is missing", () => {
    const metric = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      chainsIndexed: [1, 250, 137, 8453, 80094],
      generatedAt: "2026-06-01T08:15:00.000Z",
    });

    expect(metric.chainsMissing).toEqual([42161]);
    expect(metric.crossChainComplete).toBe(false);
  });

  test("handles incomplete chain data without failing", () => {
    const metric = buildDailyMetric({
      date: "2026-05-21",
      chainValues: {},
      chainsIndexed: [1],
      chainsMissing: [42161],
      generatedAt: "2026-06-01T08:15:00.000Z",
      includeRecords: true,
    });

    expect(metric.crossChainComplete).toBe(false);
    expect(metric.treasuryMarketValueComponents.Arbitrum).toBe(0);
    expect(metric.treasuryMarketValueRecords?.Arbitrum).toEqual([]);
    expect(metric._meta?.chainsFailed).toContain("Arbitrum");
  });
});
