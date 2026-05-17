import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";
import { getPrice, withPricingCache } from "../../src/pricing";
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
}: {
  univ2?: readonly (readonly [string, unknown])[];
  univ3?: readonly (readonly [string, unknown])[];
  chainlink?: readonly (readonly [string, unknown])[];
} = {}): EvmOnBlockContext {
  const univ2States = new Map(univ2);
  const univ3States = new Map(univ3);
  const chainlinkStates = new Map(chainlink);
  return {
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
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
});
