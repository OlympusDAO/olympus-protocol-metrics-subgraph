import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";
import { Univ3PriceHandler } from "../../src/pricing/univ3";
import { quoteTwap, validateTwapConfig } from "../../src/pricing/univ3-twap";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";

const observation = { tickDelta: "0", liquidityDelta: "1", sqrtPriceX96: (2n ** 96n).toString() };

describe("TWAP arithmetic and configuration", () => {
  test("rounds negative fractional ticks down and positive ticks toward zero", () => {
    expect(quoteTwap({ ...observation, tickDelta: "-1" }, 3600).raw.toNumber()).toBeCloseTo(
      1 / 1.0001,
      14,
    );
    expect(quoteTwap({ ...observation, tickDelta: "1" }, 3600).raw.toString()).toBe("1");
  });
  test.each([-887272, 887272])("accepts valid boundary tick %s", (tick) => {
    expect(quoteTwap({ ...observation, tickDelta: String(tick * 3600) }, 3600).raw.gt(0)).toBe(
      true,
    );
  });
  test.each([-887273, 887273])("rejects out-of-bounds tick %s", (tick) => {
    expect(() => quoteTwap({ ...observation, tickDelta: String(tick * 3600) }, 3600)).toThrow(
      "observation",
    );
  });
  test.each([0, -1, 0.5, 2 ** 32])("rejects invalid window %s", (seconds) => {
    expect(() => validateTwapConfig(seconds, 1000)).toThrow("configuration");
    expect(() => quoteTwap(observation, seconds)).toThrow("window");
  });
  test.each([0, -1, 10001, 0.5])("rejects invalid diagnostic threshold %s", (bps) => {
    expect(() => validateTwapConfig(3600, bps)).toThrow("configuration");
  });
  test("accepts exact configuration boundaries", () => {
    expect(() => validateTwapConfig(1, 1)).not.toThrow();
    expect(() => validateTwapConfig(0xffffffff, 10000)).not.toThrow();
  });
  test("rejects invalid slot state", () => {
    expect(() => quoteTwap({ ...observation, sqrtPriceX96: "0" }, 3600)).toThrow("observation");
  });
});

describe("TWAP pair routing", () => {
  const token0 = "0x57e114b691db790c35207b2e685d4a43181e6061";
  const token1 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  test.each([
    token0,
    token1,
  ])("normalizes mixed decimals for priced token %s", async (pricedToken) => {
    const config = {
      ...CHAIN_CONFIGS[1],
      tokens: CHAIN_CONFIGS[1].tokens
        .filter((token) => [token0, token1].includes(token.address))
        .map((token) => ({ ...token, decimals: token.address === token0 ? 18 : 6 })),
    };
    const context = {
      effect: vi.fn(async (def: { name: string }) =>
        def.name === "readUniv3Twap" ? observation : "1000000000000000000",
      ),
      log: { warn: vi.fn() },
    } as unknown as EvmOnBlockContext;
    const handler = new Univ3PriceHandler(config, context, {} as PublicClient, {
      kind: "univ3",
      id: "0xc3db44adc1fcdfd5671f555236eae49f4a8eea18",
      tokens: [token1, token0],
      startBlock: 100,
      twap: { pricedToken, seconds: 3600, spotWarningBps: 1000 },
    });
    const lookup = vi.fn(async () => ({ price: new BigNumber(1), liquidity: new BigNumber(1) }));
    expect(handler.matches(pricedToken)).toBe(true);
    expect(handler.matches(pricedToken === token0 ? token1 : token0)).toBe(false);
    expect(await handler.getPrice(pricedToken, lookup, 99n)).toBeNull();
    expect(context.effect).not.toHaveBeenCalled();
    const quote = await handler.getPrice(pricedToken, lookup, 100n);
    expect(quote?.price.toString()).toBe(pricedToken === token0 ? "1000000000000" : "1e-12");
    expect(lookup).toHaveBeenCalledWith(
      pricedToken === token0 ? token1 : token0,
      100n,
      handler.getId(),
    );
  });
});
