import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";
import { createPriceHandler, getPrice, getTotalValue, withPricingCache } from "../../src/pricing";
import { ARBITRUM } from "../../src/snapshot/chains/arbitrum";
import { BERACHAIN } from "../../src/snapshot/chains/berachain";
import type { ChainConfig, LiquidityHandler, TokenDefinition } from "../../src/snapshot/types";

const ARBITRUM_BLOCK = 500_000_000n;
const BERACHAIN_BLOCK = 1_000_000n;
const ONE_TO_ONE_SQRT_PRICE_X96 = 79_228_162_514_264_337_593_543_950_336n;
const WBERA_HONEY_SQRT_PRICE_X96 = 120_642_670_411_427_278_599_524_957_623n;
const IBERA_WBERA_SQRT_PRICE_X96 = 78_340_306_083_374_187_368_106_177_700n;

const ARB = "0x912ce59144191c1204e64559fe8253a0e49e6548";
const FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f";
const MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342";
const USDC_ARBITRUM = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const WETH_USDC_POOL = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443";
const ARB_WETH_POOL = "0xc6f780497a95e246eb9449f5e4770916dcd6396a";
const MAGIC_WETH_POOL = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9";
const WETH_USDC_SQRT_PRICE_X96 = 4_339_505_179_874_779_489_431_521n;

const HONEY = "0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce";
const IBERA = "0x9b6761bf2397bb5a6624a856cc84a3a14dcd3fe5";
const IBGT = "0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b";
const LBGT = "0xbaadcc2962417c01af99fb2b7c75706b9bd6babe";
const NATIVE_BERA = "0x0000000000000000000000000000000000000000";
const USDC_BERACHAIN = "0x549943e04f40284185054145c6e4e9568c1d3241";
const WBERA = "0x6969696969696969696969696969696969696969";
const WBERA_HONEY_POOL = "0x1127f801cb3ab7bdf8923272949aa7dba94b5805";
const IBERA_WBERA_POOL_3000 = "0x8dd1c3e5fb96ca0e45fe3c3cc521ad44e12f3e47";
const KODIAK_OHM_HONEY = "0x98bdeede9a45c28d229285d9d6e9139e9f505391";
const WBERA_HONEY_AMOUNT_OUT = 2_318_690_143_565_703_750n;
const IBERA_WBERA_AMOUNT_OUT = 1_022_795_101_522_250_064n;
const WBERA_PRICE = decimalFromWei(WBERA_HONEY_AMOUNT_OUT);
const IBERA_PRICE = new BigNumber(WBERA_PRICE)
  .times(decimalFromWei(IBERA_WBERA_AMOUNT_OUT))
  .toFixed();

function mockClient(
  chainId: number,
  responses: Map<string, unknown>,
  onRead?: (key: string) => void,
) {
  return {
    chain: { id: chainId },
    readContract: async ({
      address,
      functionName,
      args,
    }: {
      address: string;
      functionName: string;
      args?: unknown[];
    }) => {
      const specific = key(address, functionName, args);
      const generic = key(address, functionName);
      onRead?.(specific);
      if (responses.has(specific)) return responses.get(specific);
      if (responses.has(generic)) return responses.get(generic);
      throw new Error(`Unhandled readContract mock: ${specific}`);
    },
  } as unknown as PublicClient;
}

function mockContext({
  univ2 = [],
  univ3 = [],
  chainlink = [],
  kodiak = [],
}: {
  univ2?: readonly (readonly [string, unknown])[];
  univ3?: readonly (readonly [string, unknown])[];
  chainlink?: readonly (readonly [string, unknown])[];
  kodiak?: readonly (readonly [string, unknown])[];
} = {}): EvmOnBlockContext {
  const univ2States = new Map(univ2);
  const univ3States = new Map(univ3);
  const chainlinkStates = new Map(chainlink);
  const kodiakPools = new Map(kodiak);
  return {
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async (id: string) => kodiakPools.get(id) },
    Univ2PoolState: { get: async (id: string) => univ2States.get(id) },
    Univ3PoolState: { get: async (id: string) => univ3States.get(id) },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    effect: async (_effectDef: unknown, input: { chainId?: number; feedAddress?: string }) => {
      if (input.feedAddress !== undefined && input.chainId !== undefined) {
        const stateId = `${input.chainId}-${input.feedAddress.toLowerCase()}`;
        const state = chainlinkStates.get(stateId) as { answer?: bigint } | undefined;
        return (state?.answer ?? 0n).toString();
      }
      throw new Error("pricing.test mockContext: unhandled effect call");
    },
  } as unknown as EvmOnBlockContext;
}

function poolStateId(config: ChainConfig, poolAddress: string) {
  return `${config.chainId}-${poolAddress.toLowerCase()}`;
}

function decimalFromWei(amount: bigint): string {
  const scale = 1_000_000_000_000_000_000n;
  const whole = amount / scale;
  const fraction = amount % scale;
  return `${whole}.${fraction.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

function key(address: string, functionName: string, args: unknown[] = []) {
  return JSON.stringify([address.toLowerCase(), functionName, normalize(args)]);
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map((entry) => normalize(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryKey, entryValue]) => [entryKey, normalize(entryValue)]),
  );
}

function token(config: ChainConfig, address: string): TokenDefinition {
  const definition = config.tokens.find((entry) => entry.address === address.toLowerCase());
  if (!definition) throw new Error(`Missing token definition for ${address}`);
  return definition;
}

function handler(config: ChainConfig, id: string): LiquidityHandler {
  const definition = config.liquidityHandlers.find((entry) => entry.id === id.toLowerCase());
  if (!definition) throw new Error(`Missing liquidity handler for ${id}`);
  return definition;
}

describe("Arbitrum Envio snapshot parity", () => {
  test("recognizes the Graph-era asset categories and liquidity flags", () => {
    expect(token(ARBITRUM, FRAX)).toMatchObject({ category: "Stable", isLiquid: true });
    expect(token(ARBITRUM, USDC_ARBITRUM)).toMatchObject({ category: "Stable", isLiquid: true });
    expect(token(ARBITRUM, WETH)).toMatchObject({
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
    });
    expect(token(ARBITRUM, MAGIC)).toMatchObject({ category: "Volatile", isLiquid: true });
    expect(token(ARBITRUM, "0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c")).toMatchObject({
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
    });
  });

  test("derives FRAX through the stablecoin handler", async () => {
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>());
    await expect(
      getPrice(ARBITRUM, mockContext(), client, FRAX, ARBITRUM_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq("1"));
  });

  test("derives WETH through the WETH-USDC Uniswap V3 pool state", async () => {
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(ARBITRUM, WETH_USDC_POOL),
          { sqrtPriceX96: WETH_USDC_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
    await expect(
      getPrice(ARBITRUM, context, client, WETH, ARBITRUM_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq("3000"));
  });

  test("passes the current Univ2 pool id while valuing underlying tokens", async () => {
    const pool = handler(ARBITRUM, MAGIC_WETH_POOL);
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ2: [
        [
          poolStateId(ARBITRUM, MAGIC_WETH_POOL),
          {
            reserve0: 100_000_000_000_000_000_000n,
            reserve1: 200_000_000_000_000_000_000n,
          },
        ],
      ],
    });
    const currentPools: Array<string | null> = [];

    const totalValue = await createPriceHandler(ARBITRUM, context, client, pool).getTotalValue(
      [],
      async (_tokenAddress, _blockNumber, currentPool) => {
        currentPools.push(currentPool);
        return { price: new BigNumber(1), liquidity: new BigNumber(1) };
      },
      ARBITRUM_BLOCK,
    );

    expect(totalValue?.toString()).toBe("300");
    expect(currentPools).toEqual([MAGIC_WETH_POOL, MAGIC_WETH_POOL]);
  });

  test("caches repeated price derivations within a snapshot", async () => {
    let reads = 0;
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>(), () => {
      reads++;
    });
    const context = mockContext({
      univ3: [
        [
          poolStateId(ARBITRUM, WETH_USDC_POOL),
          { sqrtPriceX96: WETH_USDC_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });

    await withPricingCache(async () => {
      await expect(
        getPrice(ARBITRUM, context, client, WETH, ARBITRUM_BLOCK, null),
      ).resolves.toSatisfy((result) => result.price.eq("3000"));
      const readsAfterFirstLookup = reads;
      await expect(
        getPrice(ARBITRUM, context, client, WETH, ARBITRUM_BLOCK, null),
      ).resolves.toSatisfy((result) => result.price.eq("3000"));
      expect(reads).toBe(readsAfterFirstLookup);
    });

    expect(reads).toBe(0);
  });

  test("derives ARB through the ARB-WETH Uniswap V3 handler", async () => {
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(ARBITRUM, WETH_USDC_POOL),
          { sqrtPriceX96: WETH_USDC_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
        [
          poolStateId(ARBITRUM, ARB_WETH_POOL),
          { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
    await expect(getPrice(ARBITRUM, context, client, ARB, ARBITRUM_BLOCK, null)).resolves.toSatisfy(
      (result) => result.price.eq("3000"),
    );
  });

  test("derives MAGIC through the MAGIC-WETH Uniswap V2 handler", async () => {
    const client = mockClient(ARBITRUM.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(ARBITRUM, WETH_USDC_POOL),
          { sqrtPriceX96: WETH_USDC_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
      univ2: [
        [
          poolStateId(ARBITRUM, MAGIC_WETH_POOL),
          {
            reserve0: 10_000_000_000_000_000_000_000n,
            reserve1: 10_000_000_000_000_000_000n,
          },
        ],
      ],
    });
    await expect(
      getPrice(ARBITRUM, context, client, MAGIC, ARBITRUM_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq("3"));
  });
});

describe("Berachain Envio snapshot parity", () => {
  test("recognizes the Graph-era asset categories and liquidity flags", () => {
    expect(token(BERACHAIN, IBERA)).toMatchObject({ category: "Volatile", isLiquid: false });
    expect(token(BERACHAIN, IBGT)).toMatchObject({ category: "Volatile", isLiquid: false });
    expect(token(BERACHAIN, LBGT)).toMatchObject({ category: "Volatile", isLiquid: false });
    expect(token(BERACHAIN, HONEY)).toMatchObject({ category: "Stable", isLiquid: true });
    expect(token(BERACHAIN, USDC_BERACHAIN)).toMatchObject({ category: "Stable", isLiquid: true });
    expect(token(BERACHAIN, WBERA)).toMatchObject({
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
    });
    expect(token(BERACHAIN, NATIVE_BERA)).toMatchObject({
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
    });
    expect(token(BERACHAIN, KODIAK_OHM_HONEY)).toMatchObject({
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
    });
  });

  test("derives HONEY through the stablecoin handler", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    await expect(
      getPrice(BERACHAIN, mockContext(), client, HONEY, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq("1"));
  });

  test("derives USDC.e through the stablecoin handler", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    await expect(
      getPrice(BERACHAIN, mockContext(), client, USDC_BERACHAIN, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq("1"));
  });

  test("derives WBERA through the WBERA-HONEY Uniswap V3 pool state", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(BERACHAIN, WBERA_HONEY_POOL),
          { sqrtPriceX96: WBERA_HONEY_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
    await expect(
      getPrice(BERACHAIN, context, client, WBERA, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq(WBERA_PRICE));
  });

  test("keeps native BERA remapped to WBERA instead of pricing it at one dollar", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(BERACHAIN, WBERA_HONEY_POOL),
          { sqrtPriceX96: WBERA_HONEY_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
    await expect(
      getPrice(BERACHAIN, context, client, NATIVE_BERA, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq(WBERA_PRICE));
  });

  test("uses the highest-liquidity IBERA-WBERA handler and recurses through WBERA-HONEY", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    const context = mockContext({
      univ3: [
        [
          poolStateId(BERACHAIN, WBERA_HONEY_POOL),
          { sqrtPriceX96: WBERA_HONEY_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
        [
          poolStateId(BERACHAIN, IBERA_WBERA_POOL_3000),
          { sqrtPriceX96: IBERA_WBERA_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });

    await expect(
      getPrice(BERACHAIN, context, client, IBERA, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.eq(IBERA_PRICE));

    expect(handler(BERACHAIN, IBERA_WBERA_POOL_3000)).toMatchObject({
      kind: "univ3-quoter",
      tokens: [IBERA, WBERA],
    });
    expect(handler(BERACHAIN, NATIVE_BERA)).toMatchObject({
      kind: "remap",
      target: WBERA,
    });
  });

  // Regression for the Beradrome/Infrared/BeraHub OHM-HONEY POL TVL bug.
  // All these reward-vault handlers wrap the SAME underlying Kodiak pool
  // (LP_KODIAK_OHM_HONEY) and declare the same [HONEY, OHM] token set. When
  // one of them computes its POL value it must price OHM — which can only
  // come from the OHM-HONEY pool. The old `hasSameTokenSet` skip removed
  // every OHM-HONEY handler from the router whenever the caller was a
  // sibling, so OHM resolved to $0 and the OHM side of the pool's TVL
  // silently vanished (treasuryMarketValue under-reported ~6x). The fix
  // only skips same-token siblings that are a *different* underlying pool.
  const OHM_BERACHAIN = "0x18878df23e2a36f81e820e4b47b4a40576d3159c";
  const BERADROME_OHM_HONEY = "0x555bad9ec18db19ded0057d2517242399d1c5d87";
  const KODIAK_OHM_HONEY_UNDERLYING = "0x1111111111111111111111111111111111111111";

  function ohmHoneyContext() {
    return mockContext({
      kodiak: [
        [
          poolStateId(BERACHAIN, KODIAK_OHM_HONEY),
          { underlyingPoolAddress: KODIAK_OHM_HONEY_UNDERLYING },
        ],
      ],
      univ3: [
        [
          poolStateId(BERACHAIN, KODIAK_OHM_HONEY_UNDERLYING),
          { sqrtPriceX96: ONE_TO_ONE_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
        // Production also has the WBERA-HONEY pool, which prices HONEY with
        // positive liquidity (the stable handler returns liquidity:0). This
        // replicates the real Berachain handler set so the recursion path
        // matches production.
        [
          poolStateId(BERACHAIN, WBERA_HONEY_POOL),
          { sqrtPriceX96: WBERA_HONEY_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
  }

  test("prices OHM via the base Kodiak pool (currentPool = null)", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    await expect(
      getPrice(BERACHAIN, ohmHoneyContext(), client, OHM_BERACHAIN, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((result) => result.price.gt(0));
  });

  // Regression for the Kodiak decimal/inversion bug. With a realistic (non
  // 1:1) sqrtPrice, OHM (9 dec) priced in HONEY (18 dec) must come out around
  // its real ~$19, NOT ~5e-20. The previous applyDecimalAdjustment multiplied
  // by 1/raw for token0 instead of raw; that only canceled when raw==1 (the
  // ONE_TO_ONE_SQRT_PRICE_X96 used elsewhere), so it slipped past every
  // contrived test while zeroing OHM on the real chain.
  test("prices OHM at a realistic magnitude with a non-1:1 sqrtPrice", async () => {
    // Real OHM-HONEY underlying sqrtPriceX96 sampled from chain. raw =
    // sqrtPriceX96^2 / 2^192 ≈ 1.86e10 (HONEY_wei/OHM_wei); OHM price =
    // raw × 10^(9-18) × HONEY($1) ≈ $18.6.
    const REAL_SQRT_PRICE_X96 = 10820000112521596930084939133752873n;
    const KODIAK_OHM_HONEY_UNDERLYING = "0x1111111111111111111111111111111111111111";
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    const ctx = mockContext({
      kodiak: [
        [
          poolStateId(BERACHAIN, KODIAK_OHM_HONEY),
          { underlyingPoolAddress: KODIAK_OHM_HONEY_UNDERLYING },
        ],
      ],
      univ3: [
        [
          poolStateId(BERACHAIN, KODIAK_OHM_HONEY_UNDERLYING),
          { sqrtPriceX96: REAL_SQRT_PRICE_X96, liquidity: 1_000_000n },
        ],
      ],
    });
    const result = await getPrice(BERACHAIN, ctx, client, OHM_BERACHAIN, BERACHAIN_BLOCK, null);
    // Real OHM was ~$15–25 in this period; assert a sane band (the bug gave ~5e-20).
    expect(result.price.gt(5)).toBe(true);
    expect(result.price.lt(60)).toBe(true);
  });

  test("prices OHM when called from a sibling OHM-HONEY POL handler (Beradrome)", async () => {
    const client = mockClient(BERACHAIN.chainId, new Map<string, unknown>());
    // currentPool = Beradrome reward-vault handler id. Pre-fix this returned
    // ZERO_RESULT because every OHM-HONEY handler shared Beradrome's token
    // set and got skipped; post-fix the base Kodiak (same underlying pool)
    // is allowed through and prices OHM.
    const fromSibling = await getPrice(
      BERACHAIN,
      ohmHoneyContext(),
      client,
      OHM_BERACHAIN,
      BERACHAIN_BLOCK,
      BERADROME_OHM_HONEY,
    );
    expect(fromSibling.price.gt(0)).toBe(true);

    // And it matches the base-case price — the sibling caller doesn't change
    // the answer, it just no longer suppresses it.
    const baseline = await getPrice(
      BERACHAIN,
      ohmHoneyContext(),
      client,
      OHM_BERACHAIN,
      BERACHAIN_BLOCK,
      null,
    );
    expect(fromSibling.price.toFixed()).toBe(baseline.price.toFixed());
  });

  // Exercises the exact production path: pushOwnedLiquidityRecords computes
  // multiplier = getTotalValue([OHM]) / getTotalValue([]) for a Beradrome
  // POL row. Pre-fix, getTotalValue([]) returned HONEY-only (OHM priced 0)
  // so multiplier == 1 and treasuryMarketValue under-reported ~6x. Post-fix
  // OHM is priced, so 0 < multiplier < 1.
  test("Beradrome getTotalValue includes the OHM side (multiplier < 1)", async () => {
    // Reserves: token0=OHM (9 dec), token1=HONEY (18 dec) per address sort.
    const OHM_RESERVE = 2_000n * 10n ** 9n; // 2000 OHM
    const HONEY_RESERVE = 40_000n * 10n ** 18n; // 40000 HONEY
    const responses = new Map<string, unknown>([
      [key(KODIAK_OHM_HONEY, "getUnderlyingBalances"), [OHM_RESERVE, HONEY_RESERVE]],
    ]);
    const client = mockClient(BERACHAIN.chainId, responses);
    const beradrome = handler(BERACHAIN, BERADROME_OHM_HONEY);
    // Beradrome V1 reward vault is created at block 1,052,333; use a later
    // block so the handler is active.
    const block = 2_000_000n;

    await withPricingCache(async () => {
      const ctx = ohmHoneyContext();
      const totalValue = await getTotalValue(BERACHAIN, ctx, client, beradrome, [], block);
      const includedValue = await getTotalValue(
        BERACHAIN,
        ctx,
        client,
        beradrome,
        [OHM_BERACHAIN],
        block,
      );
      if (totalValue === null || includedValue === null) {
        throw new Error("Expected Beradrome total values to resolve");
      }
      const multiplier = includedValue.div(totalValue);
      // OHM contributes real value → strictly between 0 and 1.
      expect(multiplier.gt(0)).toBe(true);
      expect(multiplier.lt(1)).toBe(true);
      // totalValue must exceed the HONEY-only included value.
      expect(totalValue.gt(includedValue)).toBe(true);
    });
  });

  // Reproduces the PRODUCTION snapshot ordering: every POL handler shares one
  // pricing cache (withPricingCache wraps the whole snapshot), and the base
  // Kodiak handler runs FIRST (it's first in ownedLiquidityHandlers). If its
  // OHM/HONEY lookups poison the shared cache, the later Beradrome
  // getTotalValue could reuse a degenerate cached price and collapse to
  // multiplier=1. This guards against the cache-ordering sensitivity the
  // isolated test above doesn't exercise.
  test("Beradrome multiplier stays < 1 after base-Kodiak primes the shared cache", async () => {
    const OHM_RESERVE = 2_000n * 10n ** 9n;
    const HONEY_RESERVE = 40_000n * 10n ** 18n;
    const responses = new Map<string, unknown>([
      [key(KODIAK_OHM_HONEY, "getUnderlyingBalances"), [OHM_RESERVE, HONEY_RESERVE]],
    ]);
    const client = mockClient(BERACHAIN.chainId, responses);
    const baseKodiak = handler(BERACHAIN, KODIAK_OHM_HONEY);
    const beradrome = handler(BERACHAIN, BERADROME_OHM_HONEY);
    const block = 2_000_000n;

    await withPricingCache(async () => {
      const ctx = ohmHoneyContext();
      // Production order: base Kodiak getTotalValue first (primes the cache
      // with OHM/HONEY price entries), then the Beradrome wrapper.
      await getTotalValue(BERACHAIN, ctx, client, baseKodiak, [], block);
      await getTotalValue(BERACHAIN, ctx, client, baseKodiak, [OHM_BERACHAIN], block);

      const totalValue = await getTotalValue(BERACHAIN, ctx, client, beradrome, [], block);
      const includedValue = await getTotalValue(
        BERACHAIN,
        ctx,
        client,
        beradrome,
        [OHM_BERACHAIN],
        block,
      );
      if (totalValue === null || includedValue === null) {
        throw new Error(
          "Expected Beradrome total values to resolve after base Kodiak cache priming",
        );
      }
      const multiplier = includedValue.div(totalValue);
      expect(multiplier.lt(1)).toBe(true);
      expect(multiplier.gt(0)).toBe(true);
    });
  });
});
