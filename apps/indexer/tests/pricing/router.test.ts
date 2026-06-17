import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";
import { getPrice, withPricingCache } from "../../src/pricing";
import type { ChainConfig, LiquidityHandler, TokenDefinition } from "../../src/snapshot/types";

// Synthetic test fixtures so the cycle / recursion guards can be exercised
// in isolation from any chain's real config. The router lives in
// src/pricing/index.ts (`derivePrice`) and applies three guards:
//
// 1. `currentPool` direct-recursion guard — a handler can't recurse to itself.
// 2. `hasSameTokenSet` cycle guard — two pools whose sorted token sets are
//    equal can't recurse into each other (would otherwise infinite-loop on
//    A → B (via pool1) → A (via pool2) → B (via pool1) → ...).
// 3. Broken-pool fallback — a handler returning null is skipped; the router
//    moves on to the next matching handler.

const CHAIN_ID = 42161;
const TOKEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USDC_ALT_1 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const USDC_ALT_2 = "0xcccccccccccccccccccccccccccccccccccccccc";
const POOL_1 = "0xdddddddddddddddddddddddddddddddddddddddd";
const POOL_2 = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BLOCK = 100_000_000n;

// sqrtPriceX96 corresponding to a 1:1 price between tokens with the same
// decimals — same constant used by src/snapshot/pricing.test.ts.
const ONE_TO_ONE_SQRT_PRICE_X96 = 79_228_162_514_264_337_593_543_950_336n;

const VOLATILE: Pick<TokenDefinition, "category" | "isLiquid" | "isBluechip" | "decimals"> = {
  category: "Volatile",
  isLiquid: true,
  isBluechip: false,
  decimals: 18,
};
const STABLE: Pick<TokenDefinition, "category" | "isLiquid" | "isBluechip" | "decimals"> = {
  category: "Stable",
  isLiquid: true,
  isBluechip: false,
  decimals: 18,
};

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("router cycle tests must not perform RPC reads");
    },
  } as unknown as PublicClient;
}

type Univ3StateRow = { sqrtPriceX96: bigint; liquidity: bigint };

function mockContext(
  univ3States: ReadonlyArray<readonly [string, Univ3StateRow]> = [],
): EvmOnBlockContext {
  const states = new Map(univ3States);
  return {
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async (id: string) => states.get(id) },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    ChainlinkPriceState: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
  } as unknown as EvmOnBlockContext;
}

function buildConfig(
  handlers: LiquidityHandler[],
  tokens: { address: string; spec: typeof VOLATILE | typeof STABLE }[],
): ChainConfig {
  return {
    chainId: CHAIN_ID,
    blockchain: "TestChain",
    startBlock: 0,
    rpcUrls: [],
    tokens: tokens.map((t) => ({ address: t.address, ...t.spec })),
    names: {},
    abbreviations: {},
    protocolAddresses: [],
    circulatingSupplyWallets: [],
    treasuryBlacklist: {},
    basePriceFeeds: {},
    ohmToken: TOKEN_A,
    liquidityHandlers: handlers,
    ownedLiquidityHandlers: [],
  } as unknown as ChainConfig;
}

function univ3PoolStateId(pool: string) {
  return `${CHAIN_ID}-${pool}`;
}

describe("recursive router guards", () => {
  test("currentPool guard: a handler does not recurse into itself", async () => {
    // The lone handler that matches TOKEN_A is POOL_1. If the router calls
    // getPrice(TOKEN_A, currentPool=POOL_1), the only candidate is filtered
    // out by `handler.getId() === currentPool`, leaving no path to a price.
    const config = buildConfig(
      [
        {
          kind: "univ3",
          id: POOL_1,
          tokens: [TOKEN_A, USDC_ALT_1],
        },
        {
          kind: "stable",
          id: "stable-usd",
          tokens: [USDC_ALT_1],
        },
      ],
      [
        { address: TOKEN_A, spec: VOLATILE },
        { address: USDC_ALT_1, spec: STABLE },
      ],
    );
    const context = mockContext([
      [univ3PoolStateId(POOL_1), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
    ]);

    const result = await getPrice(config, context, mockClient(), TOKEN_A, BLOCK, POOL_1);
    expect(result.price.eq("0")).toBe(true);
  });

  test("hasSameTokenSet guard: parallel pools with the same token set are skipped", async () => {
    // POOL_1 and POOL_2 both have tokens [TOKEN_A, USDC_ALT_1] in their
    // declared `tokens` arrays. If the router is invoked with currentPool=POOL_1,
    // POOL_2 also matches TOKEN_A but is filtered because its sorted token set
    // equals POOL_1's. Without this guard the lookup would oscillate between
    // POOL_1 → POOL_2 → POOL_1 → ... forever (the existing currentPool-only
    // guard wouldn't catch it because POOL_2 has a different id).
    //
    // To prove the guard fires we omit any other handler that could quote
    // TOKEN_A; the only paths are POOL_1 (filtered by currentPool) and POOL_2
    // (filtered by hasSameTokenSet), so the router must return ZERO.
    const config = buildConfig(
      [
        {
          kind: "univ3",
          id: POOL_1,
          tokens: [TOKEN_A, USDC_ALT_1],
        },
        {
          kind: "univ3",
          id: POOL_2,
          tokens: [TOKEN_A, USDC_ALT_1],
        },
        {
          kind: "stable",
          id: "stable-usd",
          tokens: [USDC_ALT_1],
        },
      ],
      [
        { address: TOKEN_A, spec: VOLATILE },
        { address: USDC_ALT_1, spec: STABLE },
      ],
    );
    const context = mockContext([
      [univ3PoolStateId(POOL_1), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
      [univ3PoolStateId(POOL_2), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
    ]);

    const result = await getPrice(config, context, mockClient(), TOKEN_A, BLOCK, POOL_1);
    expect(result.price.eq("0")).toBe(true);
  });

  test("broken pool returns null; router falls through to the next matching handler", async () => {
    // Two UniV3 pools both quote TOKEN_A. POOL_1 has sqrtPriceX96 = 0
    // (handler returns null per src/pricing/univ3.ts:56). POOL_2 has a valid
    // 1:1 sqrtPriceX96 and a live USDC peer.
    //
    // Different secondary tokens (USDC_ALT_1 vs USDC_ALT_2) ensure the two
    // pools have *different* sorted token sets so hasSameTokenSet doesn't
    // fire — this isolates the broken-pool fallback from the cycle guard.
    const config = buildConfig(
      [
        {
          kind: "univ3",
          id: POOL_1,
          tokens: [TOKEN_A, USDC_ALT_1],
        },
        {
          kind: "univ3",
          id: POOL_2,
          tokens: [TOKEN_A, USDC_ALT_2],
        },
        {
          kind: "stable",
          id: "stable-usd",
          tokens: [USDC_ALT_1, USDC_ALT_2],
        },
      ],
      [
        { address: TOKEN_A, spec: VOLATILE },
        { address: USDC_ALT_1, spec: STABLE },
        { address: USDC_ALT_2, spec: STABLE },
      ],
    );
    const context = mockContext([
      [univ3PoolStateId(POOL_1), { sqrtPriceX96: 0n, liquidity: 0n }], // broken
      [univ3PoolStateId(POOL_2), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 42n }],
    ]);

    const result = await getPrice(config, context, mockClient(), TOKEN_A, BLOCK, null);
    // 1:1 sqrtPrice and stable USDC means TOKEN_A prices to $1.
    expect(result.price.eq("1")).toBe(true);
    // And the liquidity reported should come from POOL_2's indexed L,
    // not from the broken pool — so the tiebreaker is meaningful even when
    // some candidates fail.
    expect(result.liquidity.eq("42")).toBe(true);
  });

  test("inFlight cycle guard: 3-pool ring A↔B↔C↔A resolves without deadlocking", async () => {
    // A topology the existing currentPool and hasSameTokenSet guards do NOT
    // catch: three pools forming a ring (A/B, B/C, C/A) with different token
    // sets. Walking through:
    //   getPrice(A, null)            → cached
    //   ↓ POOL_AB asks B (currentPool=POOL_AB)
    //   getPrice(B, POOL_AB)         → cached
    //   ↓ POOL_BC asks C (currentPool=POOL_BC)
    //   getPrice(C, POOL_BC)         → cached
    //   ↓ POOL_CA asks A (currentPool=POOL_CA)
    //   getPrice(A, POOL_CA)         → cached (different key from initial!)
    //   ↓ POOL_AB asks B (currentPool=POOL_AB)
    //   getPrice(B, POOL_AB)         ← THIS KEY IS ALREADY IN FLIGHT — cycle!
    //
    // Without the inFlight guard the cached Promise for (B, POOL_AB) is
    // awaited, which is waiting on (C, POOL_BC), which is waiting on (A,
    // POOL_CA), which is waiting on (B, POOL_AB). Eternal deadlock — the test
    // would hang until vitest's timeout. With the guard the recursive lookup
    // returns ZERO_RESULT and the resolution unwinds.
    const TOKEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const TOKEN_C = "0xcccccccccccccccccccccccccccccccccccccccc";
    const POOL_AB = "0x1111111111111111111111111111111111111111";
    const POOL_BC = "0x2222222222222222222222222222222222222222";
    const POOL_CA = "0x3333333333333333333333333333333333333333";

    const config = buildConfig(
      [
        { kind: "univ3", id: POOL_AB, tokens: [TOKEN_A, TOKEN_B] },
        { kind: "univ3", id: POOL_BC, tokens: [TOKEN_B, TOKEN_C] },
        { kind: "univ3", id: POOL_CA, tokens: [TOKEN_C, TOKEN_A] },
      ],
      [
        { address: TOKEN_A, spec: VOLATILE },
        { address: TOKEN_B, spec: VOLATILE },
        { address: TOKEN_C, spec: VOLATILE },
      ],
    );
    const context = mockContext([
      [univ3PoolStateId(POOL_AB), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
      [univ3PoolStateId(POOL_BC), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
      [univ3PoolStateId(POOL_CA), { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1n }],
    ]);

    // Must wrap in withPricingCache for the inFlight set to exist. Use a
    // tight test-level timeout so a regression manifests as a fast failure
    // instead of vitest's default 5s hang.
    const result = await Promise.race([
      withPricingCache(() => getPrice(config, context, mockClient(), TOKEN_A, BLOCK, null)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("cycle guard failed — getPrice deadlocked")), 1000),
      ),
    ]);

    // No stable/chainlink anchor exists, so the entire ring evaluates to ZERO.
    // The point of this test is liveness, not the numeric answer — if we get
    // here at all, the deadlock is broken.
    expect(result.price.eq("0")).toBe(true);
  });
});
