import { describe, expect, test } from "vitest";

import { univ3PositionAmounts } from "./math";

// sqrtPriceX96 for an in-range position. Constructed so the math is easy to
// reason about: sqrtPriceX96 / 2^96 ≈ 1.0 (price ratio of 1 between tokens).
const SQRT_PRICE_X96_AT_1 = 2n ** 96n;

describe("univ3PositionAmounts", () => {
  test("in-range position splits liquidity between both tokens", () => {
    // Symmetric range around tick 0 with sqrtPrice=1 → roughly equal amounts.
    const result = univ3PositionAmounts(1_000_000n, SQRT_PRICE_X96_AT_1, -10, 10);
    expect(result.amount0).toBeGreaterThan(0n);
    expect(result.amount1).toBeGreaterThan(0n);
    // The "1.0001^tick" approximation around tick 0 with bounds ±10 produces
    // roughly L * 0.0005 on each side. Loose bounds to allow Math.pow drift.
    expect(Number(result.amount0)).toBeGreaterThan(400);
    expect(Number(result.amount0)).toBeLessThan(600);
    expect(Number(result.amount1)).toBeGreaterThan(400);
    expect(Number(result.amount1)).toBeLessThan(600);
  });

  test("out-of-range LOW position is 100% token0", () => {
    // sqrtPriceX96 well below the position range → all liquidity in token0.
    const sqrtLow = (SQRT_PRICE_X96_AT_1 * 9n) / 10n;
    const result = univ3PositionAmounts(1_000_000n, sqrtLow, 100, 200);
    expect(result.amount0).toBeGreaterThan(0n);
    expect(result.amount1).toBe(0n);
  });

  test("out-of-range HIGH position is 100% token1", () => {
    const sqrtHigh = (SQRT_PRICE_X96_AT_1 * 11n) / 10n;
    const result = univ3PositionAmounts(1_000_000n, sqrtHigh, -200, -100);
    expect(result.amount0).toBe(0n);
    expect(result.amount1).toBeGreaterThan(0n);
  });

  test("zero liquidity returns zero amounts", () => {
    const result = univ3PositionAmounts(0n, SQRT_PRICE_X96_AT_1, -10, 10);
    expect(result.amount0).toBe(0n);
    expect(result.amount1).toBe(0n);
  });
});
