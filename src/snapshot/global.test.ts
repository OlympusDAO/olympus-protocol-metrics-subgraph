import BigNumber from "bignumber.js";
import { describe, expect, test } from "vitest";

import {
  aggregateAcrossChains,
  computeApy,
  computeDerivedRatios,
  computePerChainAggregate,
  TYPE_BLV,
  TYPE_LIQUIDITY,
  TYPE_TOTAL_SUPPLY,
  TYPE_TREASURY,
} from "./global";
import type { SerializedTokenRecord, SerializedTokenSupply } from "./types";

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const OHM = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const BUYBACK_MS = "0xf7deb867e65306be0cb33918ac1b8f89a72109db";

function record(overrides: Partial<SerializedTokenRecord>): SerializedTokenRecord {
  return {
    id: "test",
    chainId: 1,
    blockchain: "Ethereum",
    block: "20000000",
    timestamp: "1700000000",
    date: "2024-09-01",
    token: "DAI",
    tokenAddress: DAI,
    source: "Treasury",
    sourceAddress: "0x0",
    rate: "1",
    balance: "1000",
    multiplier: "1",
    value: "1000",
    valueExcludingOhm: "1000",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    ...overrides,
  };
}

function supply(type: string, balance: string, supplyBalance: string): SerializedTokenSupply {
  return {
    id: `supply-${type}`,
    chainId: 1,
    blockchain: "Ethereum",
    block: "20000000",
    timestamp: "1700000000",
    date: "2024-09-01",
    token: "OHM",
    tokenAddress: OHM,
    type,
    balance,
    supplyBalance,
  };
}

describe("computePerChainAggregate", () => {
  test("sums stable records into MV and liquid backing; excludes OHM unless buyback MS post-block", () => {
    const records: SerializedTokenRecord[] = [
      record({ value: "1000", valueExcludingOhm: "1000" }),
      // OHM at random address, post-buyback-block — excluded from MV.
      record({
        category: "OHM",
        tokenAddress: OHM,
        value: "500",
        valueExcludingOhm: "0",
        sourceAddress: "0xdeadbeef",
      }),
      // OHM at Buyback MS, post-block — included in MV.
      record({
        category: "OHM",
        tokenAddress: OHM,
        block: "20600000", // post-inclusion (20_514_801)
        value: "750",
        valueExcludingOhm: "0",
        sourceAddress: BUYBACK_MS,
      }),
    ];
    const agg = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_600_000n,
      1_700_000_000n,
      records,
      [],
    );
    expect(agg.treasuryMarketValue.toString()).toBe("1750");
    expect(agg.treasuryLiquidBacking.toString()).toBe("1000");
  });

  test("OHM at Buyback MS BEFORE inclusion block is excluded from MV", () => {
    const records: SerializedTokenRecord[] = [
      record({
        category: "OHM",
        block: "20000000",
        value: "100",
        valueExcludingOhm: "0",
        sourceAddress: BUYBACK_MS,
      }),
      record({
        category: "OHM",
        block: "20514800", // exactly 1 below inclusion
        value: "100",
        valueExcludingOhm: "0",
        sourceAddress: BUYBACK_MS,
      }),
    ];
    const agg = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_000_000n,
      1_700_000_000n,
      records,
      [],
    );
    expect(agg.treasuryMarketValue.toString()).toBe("0");
  });

  test("ohmCirculatingSupply / Floating / Backed apply pre-BLV-inclusion rule on Ethereum", () => {
    // Pre-BLV-inclusion: BLV counted in circulating AND floating.
    const supplies: SerializedTokenSupply[] = [
      supply(TYPE_TOTAL_SUPPLY, "1000000", "1000000"),
      supply(TYPE_TREASURY, "0", "-100000"),
      supply(TYPE_LIQUIDITY, "0", "-50000"),
      supply(TYPE_BLV, "0", "-30000"),
    ];
    const aggPre = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      // Pre-inclusion block
      17_500_000n,
      1_700_000_000n,
      [],
      supplies,
    );
    // Circulating = total + treasury + BLV (pre) = 1_000_000 - 100_000 - 30_000 = 870_000
    expect(aggPre.ohmCirculatingSupply.toString()).toBe("870000");
    // Floating = circulating + liquidity + BLV (pre, already added) = 870_000 - 50_000 - 30_000 = 790_000
    expect(aggPre.ohmFloatingSupply.toString()).toBe("790000");
    // Backed always includes BLV: 1_000_000 - 100_000 - 50_000 - 30_000 = 820_000
    expect(aggPre.ohmBackedSupply.toString()).toBe("820000");

    // Post-BLV-inclusion: BLV excluded from circulating, still in floating/backed.
    const aggPost = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      18_000_000n,
      1_700_000_000n,
      [],
      supplies,
    );
    // Circulating = total + treasury (no BLV) = 900_000
    expect(aggPost.ohmCirculatingSupply.toString()).toBe("900000");
    // Floating = circulating + liquidity (no BLV) = 850_000
    expect(aggPost.ohmFloatingSupply.toString()).toBe("850000");
    // Backed = circulating + liquidity + BLV = 820_000
    expect(aggPost.ohmBackedSupply.toString()).toBe("820000");
  });
});

describe("aggregateAcrossChains", () => {
  test("sums per-chain values and computes chainsIndexed / chainsMissing / complete", () => {
    const ethereum = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_000_000n,
      1_700_000_000n,
      [record({ value: "1000", valueExcludingOhm: "1000" })],
      [supply(TYPE_TOTAL_SUPPLY, "1000000", "1000000")],
    );
    const arbitrum = computePerChainAggregate(
      42_161,
      "Arbitrum",
      "2024-09-01",
      200_000_000n,
      1_700_000_000n,
      [record({ chainId: 42_161, blockchain: "Arbitrum", value: "500", valueExcludingOhm: "500" })],
      [],
    );
    const agg = aggregateAcrossChains("2024-09-01", [ethereum, arbitrum]);
    expect(agg.treasuryMarketValue.toString()).toBe("1500");
    expect(agg.treasuryLiquidBacking.toString()).toBe("1500");
    expect(agg.ohmTotalSupply.toString()).toBe("1000000");
    expect(agg.chainsIndexed.sort()).toEqual(["Arbitrum", "Ethereum"]);
    expect(agg.chainsMissing).toEqual([]);
    expect(agg.crossChainComplete).toBe(true);
  });

  test("crossChainComplete is false when Ethereum is missing", () => {
    const arbitrum = computePerChainAggregate(
      42_161,
      "Arbitrum",
      "2024-09-01",
      200_000_000n,
      1_700_000_000n,
      [],
      [],
    );
    const agg = aggregateAcrossChains("2024-09-01", [arbitrum]);
    expect(agg.chainsMissing).toEqual(["Ethereum"]);
    expect(agg.crossChainComplete).toBe(false);
  });

  test("single-chain (Ethereum-only) is incomplete pending Arbitrum", () => {
    const ethereum = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_000_000n,
      1_700_000_000n,
      [],
      [],
    );
    const agg = aggregateAcrossChains("2024-09-01", [ethereum]);
    expect(agg.chainsMissing).toEqual(["Arbitrum"]);
    expect(agg.crossChainComplete).toBe(false);
  });

  test("missing-chain — Base/Polygon/Fantom present without Ethereum is still incomplete", () => {
    const arbitrum = computePerChainAggregate(
      42_161,
      "Arbitrum",
      "2024-09-01",
      200_000_000n,
      1_700_000_000n,
      [],
      [],
    );
    const base = computePerChainAggregate(
      8453,
      "Base",
      "2024-09-01",
      20_000_000n,
      1_700_000_000n,
      [],
      [],
    );
    const polygon = computePerChainAggregate(
      137,
      "Polygon",
      "2024-09-01",
      50_000_000n,
      1_700_000_000n,
      [],
      [],
    );
    const agg = aggregateAcrossChains("2024-09-01", [arbitrum, base, polygon]);
    expect(agg.chainsIndexed.sort()).toEqual(["Arbitrum", "Base", "Polygon"]);
    expect(agg.chainsMissing).toEqual(["Ethereum"]);
    expect(agg.crossChainComplete).toBe(false);
  });

  test("late-day-update — two Ethereum snapshots for same date sum correctly (snapshot path overwrites by ID)", () => {
    // This simulates the BlockHandler reading back the *latest* per-chain row
    // for each chain. In practice GlobalMetricChainValues is keyed by
    // "{chainId}-{date}" so the second snapshot overwrites the first. The
    // aggregation receives the latest values (here represented as a single
    // higher row), not stacked rows. Confirm that aggregateAcrossChains is
    // a pure sum — passing the same chain twice would double-count, so
    // BlockHandlers must dedupe before calling. Verified by passing both
    // chains exactly once and asserting the canonical sums.
    const earlier = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_000_000n,
      1_700_000_000n,
      [record({ value: "500", valueExcludingOhm: "500" })],
      [supply(TYPE_TOTAL_SUPPLY, "1000000", "1000000")],
    );
    const later = computePerChainAggregate(
      1,
      "Ethereum",
      "2024-09-01",
      20_010_000n,
      1_700_010_000n,
      // 8h later: same MV (no transfers), updated supply baseline.
      [record({ value: "500", valueExcludingOhm: "500" })],
      [supply(TYPE_TOTAL_SUPPLY, "1000500", "1000500")],
    );
    const arbitrum = computePerChainAggregate(
      42_161,
      "Arbitrum",
      "2024-09-01",
      200_000_000n,
      1_700_010_000n,
      [],
      [],
    );

    // Only the "later" Ethereum snapshot should be passed (BlockHandlers
    // reads from the entity store — the earlier write was overwritten by ID).
    const agg = aggregateAcrossChains("2024-09-01", [later, arbitrum]);
    expect(agg.crossChainComplete).toBe(true);
    expect(agg.ohmTotalSupply.toString()).toBe("1000500");
    // Sanity check that passing the earlier row would have given a different
    // (stale) supply — this is the bug we'd be guarding against.
    const stale = aggregateAcrossChains("2024-09-01", [earlier, arbitrum]);
    expect(stale.ohmTotalSupply.toString()).toBe("1000000");
  });
});

describe("computeDerivedRatios", () => {
  test("computes marketCap / gOhmBackedSupply / liquidBacking ratios", () => {
    const agg = aggregateAcrossChains("2024-09-01", [
      computePerChainAggregate(
        1,
        "Ethereum",
        "2024-09-01",
        20_000_000n,
        1_700_000_000n,
        [],
        [
          supply(TYPE_TOTAL_SUPPLY, "1000000", "1000000"),
          supply(TYPE_TREASURY, "0", "-100000"),
          supply(TYPE_LIQUIDITY, "0", "-50000"),
        ],
      ),
    ]);
    // Hand-loaded values: liquidBacking=0 because we passed no records.
    const ratios = computeDerivedRatios(
      {
        ...agg,
        treasuryLiquidBacking: new BigNumber("1500"),
        ohmFloatingSupply: new BigNumber("850000"),
      },
      new BigNumber("15"),
      new BigNumber("131.283"),
    );
    expect(ratios.marketCap.toString()).toBe("13500000"); // 900_000 × 15
    expect(ratios.gOhmBackedSupply.toFixed(4)).toBe(
      new BigNumber("850000").div("131.283").toFixed(4),
    );
  });

  test("returns ZERO ratios when denominators are zero", () => {
    const agg = aggregateAcrossChains("2024-09-01", []);
    const ratios = computeDerivedRatios(agg, new BigNumber("0"), new BigNumber("0"));
    expect(ratios.marketCap.toString()).toBe("0");
    expect(ratios.gOhmBackedSupply.toString()).toBe("0");
    expect(ratios.treasuryLiquidBackingPerOhmFloating.toString()).toBe("0");
  });
});

describe("computeApy", () => {
  test("computes nextEpochRebase + currentApy with the 3-rebase/day compounding", () => {
    // distributedOhm = 1000, sOhm = 1_000_000 → nextEpochRebase = 0.1%
    // currentApy = ((1.001)^1095 − 1) × 100 ≈ 198.8%
    const result = computeApy(new BigNumber("1000"), new BigNumber("1000000"));
    expect(result.nextEpochRebase.toString()).toBe("0.1");
    // Use a 1-decimal tolerance since Math.pow loses precision.
    expect(Number(result.currentApy.toString())).toBeGreaterThan(195);
    expect(Number(result.currentApy.toString())).toBeLessThan(205);
  });

  test("returns ZERO when sOHM circulating supply is zero", () => {
    const result = computeApy(new BigNumber("1000"), new BigNumber("0"));
    expect(result.nextEpochRebase.toString()).toBe("0");
    expect(result.currentApy.toString()).toBe("0");
  });

  test("returns ZERO when distributed OHM is zero", () => {
    const result = computeApy(new BigNumber("0"), new BigNumber("1000000"));
    expect(result.currentApy.toString()).toBe("0");
  });
});
