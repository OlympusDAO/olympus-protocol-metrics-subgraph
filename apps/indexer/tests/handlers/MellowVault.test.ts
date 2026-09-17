import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";
import {
  pushTokenBalanceRecords,
  pushTotalSupply,
  pushTreasuryOhm,
} from "../../src/handlers/BlockHandlers";
import {
  type MellowPosition,
  pushMellowRecords,
  valueMellowPosition,
} from "../../src/handlers/MellowVault";
import { ROBINHOOD, ROBINHOOD_START_BLOCK } from "../../src/snapshot/chains/robinhood";
import { aggregateAcrossChains, computePerChainAggregate } from "../../src/snapshot/global";
import type { SerializedTokenRecord, SerializedTokenSupply } from "../../src/snapshot/types";

// Historical live oracle anchor: Robinhood block 65041639. Balance scenarios
// below are synthetic lifecycle fixtures, not claims that Olympus held shares.
const NOW = 1789615368;
const position = (overrides: Partial<MellowPosition> = {}): MellowPosition => ({
  shares: "1000000000000000000",
  priceD18: "988781355978366146250746960814",
  reportTimestamp: 1789551327,
  suspicious: false,
  maxAge: 86400,
  requests: [],
  ...overrides,
});

describe("Mellow net claim valuation", () => {
  test("inverts the real report with 18/6 decimals", () => {
    const v = valueMellowPosition(position(), 0, NOW);
    expect(v.rate.toNumber()).toBeCloseTo(1.011345929971074, 12);
    expect(v.shares.toString()).toBe("1");
  });
  test("zero holdings do not need a price", () => {
    const v = valueMellowPosition(
      position({ shares: "0", priceD18: "0", reportTimestamp: 0 }),
      0,
      NOW,
    );
    expect(v.shares.plus(v.pendingShares).plus(v.fixedAssets).toString()).toBe("0");
  });
  test.each([
    { priceD18: "0" },
    { suspicious: true },
    { reportTimestamp: NOW + 1 },
    { reportTimestamp: NOW - 86401 },
    { reportTimestamp: 0 },
  ])("rejects unusable NAV instead of silently publishing zero: %o", (override) => {
    expect(() => valueMellowPosition(position(override), 0, NOW)).toThrow(/oracle/);
  });
  test("accepts the freshness boundary", () => {
    expect(() =>
      valueMellowPosition(position({ reportTimestamp: NOW - 86400 }), 0, NOW),
    ).not.toThrow();
  });
  test("locked redemption shares use NAV, with the post-fee share amount exactly once", () => {
    const v = valueMellowPosition(
      position({
        shares: "0",
        requests: [
          { timestamp: 200, shares: "990000000000000000", assets: "0", isClaimable: false },
        ],
      }),
      100,
      NOW,
    );
    expect(v.shares.toString()).toBe("0");
    expect(v.pendingShares.toString()).toBe("0.99");
    expect(v.fixedAssets.toString()).toBe("0");
  });
  test("priced redemption remains fixed even before liquidity is claimable", () => {
    const v = valueMellowPosition(
      position({
        shares: "0",
        priceD18: "0",
        requests: [
          { timestamp: 100, shares: "1000000000000000000", assets: "1005000", isClaimable: false },
        ],
      }),
      100,
      NOW,
    );
    expect(v.pendingShares.toString()).toBe("0");
    expect(v.fixedAssets.toString()).toBe("1.005");
  });
  test("processed zero-asset dust is not resurrected as pending NAV", () => {
    const v = valueMellowPosition(
      position({
        shares: "0",
        requests: [{ timestamp: 100, shares: "1", assets: "0", isClaimable: false }],
      }),
      100,
      NOW,
    );
    expect(v.pendingShares.plus(v.fixedAssets).toString()).toBe("0");
  });
  test("missing queue history fails closed", () => {
    expect(() =>
      valueMellowPosition(
        position({ requests: [{ timestamp: 100, shares: "1", assets: "1", isClaimable: true }] }),
        0,
        NOW,
      ),
    ).toThrow(/history/);
  });
});

describe("Robinhood snapshot integration", () => {
  const block = BigInt(ROBINHOOD_START_BLOCK);
  const client = {} as PublicClient;
  function context(p: MellowPosition) {
    return {
      effect: vi.fn(async () => p),
      MellowQueueState: { get: vi.fn(async () => undefined) },
    };
  }
  test("pre-start makes no contract/effect calls", async () => {
    const ctx = context(position());
    const records: SerializedTokenRecord[] = [];
    await pushMellowRecords(
      ctx as unknown as EvmOnBlockContext,
      ROBINHOOD,
      client,
      records,
      BigInt(NOW),
      block - 1n,
    );
    expect(ctx.effect).not.toHaveBeenCalled();
    expect(records).toEqual([]);
  });
  test("empty baseline emits no phantom records", async () => {
    const ctx = context(position({ shares: "0" }));
    const records: SerializedTokenRecord[] = [];
    await pushMellowRecords(
      ctx as unknown as EvmOnBlockContext,
      ROBINHOOD,
      client,
      records,
      BigInt(NOW),
      block,
    );
    expect(records).toEqual([]);
  });
  test("ordinary token path skips rUSDG, custom path reaches global totals once", async () => {
    const records: SerializedTokenRecord[] = [];
    const ctx = context(position());
    const sharesOnly = {
      ...ROBINHOOD,
      tokens: ROBINHOOD.tokens.filter((t) => t.address === ROBINHOOD.mellowVault?.shares),
    };
    await pushTokenBalanceRecords(
      ctx as unknown as EvmOnBlockContext,
      sharesOnly,
      client,
      records,
      BigInt(NOW),
      block,
    );
    expect(ctx.effect).not.toHaveBeenCalled();
    await pushMellowRecords(
      ctx as unknown as EvmOnBlockContext,
      ROBINHOOD,
      client,
      records,
      BigInt(NOW),
      block,
    );
    expect(records).toHaveLength(1);
    const chain = computePerChainAggregate(
      4663,
      "Robinhood",
      "2026-09-17",
      block,
      BigInt(NOW),
      records,
      [],
    );
    const total = aggregateAcrossChains("2026-09-17", [chain]);
    expect(total.treasuryMarketValue.toNumber()).toBeCloseTo(1.011345929971074, 12);
    expect(total.treasuryLiquidBacking.toString()).toBe("0");
    expect(records[0].isLiquid).toBe(false);
    expect(records[0].sourceAddress).toBe(ROBINHOOD.protocolAddresses[0]);
    expect(Number(records[0].value)).toBeCloseTo(1.011345929971074, 12);
  });
  test("a treasury-only chain never invents OHM supply", async () => {
    const supplies: SerializedTokenSupply[] = [];
    await pushTotalSupply({} as EvmOnBlockContext, ROBINHOOD, supplies, BigInt(NOW), block);
    await pushTreasuryOhm({} as EvmOnBlockContext, ROBINHOOD, supplies, BigInt(NOW), block);
    expect(supplies).toEqual([]);
  });
  test("completed redemption is idle USDG with no residual claim", async () => {
    const records: SerializedTokenRecord[] = [];
    const idleContext = { effect: vi.fn(async () => "1005000") };
    await pushTokenBalanceRecords(
      idleContext as unknown as EvmOnBlockContext,
      ROBINHOOD,
      client,
      records,
      BigInt(NOW),
      block,
    );
    await pushMellowRecords(
      context(position({ shares: "0", requests: [] })) as unknown as EvmOnBlockContext,
      ROBINHOOD,
      client,
      records,
      BigInt(NOW),
      block,
    );
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe("1.005");
    expect(records[0].isLiquid).toBe(true);
  });
  test("coverage requires Robinhood only from its baseline date", () => {
    expect(aggregateAcrossChains("2026-09-16", []).chainsMissing).not.toContain(4663);
    expect(aggregateAcrossChains("2026-09-17", []).chainsMissing).toContain(4663);
  });
});
