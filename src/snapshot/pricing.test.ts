import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";

import { ARBITRUM } from "./chains/arbitrum";
import { BERACHAIN } from "./chains/berachain";
import { getPrice } from "./pricing";
import type { ChainConfig, LiquidityHandler, TokenDefinition } from "./types";

const ARBITRUM_BLOCK = 500_000_000n;
const BERACHAIN_BLOCK = 1_000_000n;
const ONE_TO_ONE_SQRT_PRICE_X96 = 79_228_162_514_264_337_593_543_950_336n;

const ARB = "0x912ce59144191c1204e64559fe8253a0e49e6548";
const FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f";
const MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342";
const USDC_ARBITRUM = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const ARB_WETH_POOL = "0xc6f780497a95e246eb9449f5e4770916dcd6396a";
const MAGIC_WETH_POOL = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9";

const HONEY = "0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce";
const IBERA = "0x9b6761bf2397bb5a6624a856cc84a3a14dcd3fe5";
const IBGT = "0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b";
const LBGT = "0xbaadcc2962417c01af99fb2b7c75706b9bd6babe";
const NATIVE_BERA = "0x0000000000000000000000000000000000000000";
const USDC_BERACHAIN = "0x549943e04f40284185054145c6e4e9568c1d3241";
const WBERA = "0x6969696969696969696969696969696969696969";
const WBERA_HONEY_POOL = "0x1127f801cb3ab7bdf8923272949aa7dba94b5805";
const IBERA_WBERA_POOL_3000 = "0x8dd1c3e5fb96ca0e45fe3c3cc521ad44e12f3e47";
const IBERA_WBERA_POOL_500 = "0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f";
const KODIAK_QUOTER = "0x644c8d6e501f7c994b74f5cea96abe65d0ba662b";
const KODIAK_OHM_HONEY = "0x98bdeede9a45c28d229285d9d6e9139e9f505391";
const WBERA_HONEY_AMOUNT_OUT = 2_318_690_143_565_703_750n;
const IBERA_WBERA_AMOUNT_OUT = 1_022_795_101_522_250_064n;
const WBERA_PRICE = "2.31869014356570375";
const IBERA_PRICE = "2.37154492078692454299068672164254";

type ContractResponseMap = Map<string, unknown>;

function contractResponses(entries: readonly (readonly [string, unknown])[]): ContractResponseMap {
  return new Map(entries);
}

function mockClient(chainId: number, responses: ContractResponseMap) {
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
      if (responses.has(specific)) return responses.get(specific);
      if (responses.has(generic)) return responses.get(generic);
      throw new Error(`Unhandled readContract mock: ${specific}`);
    },
  } as unknown as PublicClient;
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

function feedResponses(config: ChainConfig, tokenAddress: string, price: bigint, decimals = 8) {
  const feed = config.basePriceFeeds[tokenAddress.toLowerCase()];
  if (!feed) throw new Error(`Missing price feed for ${tokenAddress}`);
  return [
    [key(feed.address, "decimals"), decimals],
    [key(feed.address, "latestAnswer"), price],
  ] as const;
}

function erc20Decimals(address: string, decimals = 18) {
  return [key(address, "decimals"), decimals] as const;
}

function erc20Balance(tokenAddress: string, walletAddress: string, balance: bigint) {
  return [key(tokenAddress, "balanceOf", [walletAddress.toLowerCase()]), balance] as const;
}

function quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number,
  amountOut: bigint,
) {
  return [
    key(KODIAK_QUOTER, "quoteExactInputSingle", [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ]),
    [amountOut, 0n, 0, 0n],
  ] as const;
}

function arbitrumWethFeedResponses() {
  return feedResponses(ARBITRUM, WETH, 300_000_000_000n);
}

function arbitrumArbWethResponses() {
  return [
    ...arbitrumWethFeedResponses(),
    [key(ARB_WETH_POOL, "token0"), WETH],
    [key(ARB_WETH_POOL, "token1"), ARB],
    [key(ARB_WETH_POOL, "slot0"), [ONE_TO_ONE_SQRT_PRICE_X96, 0, 0, 0, 0, 0, true]],
    erc20Decimals(ARB),
    erc20Decimals(WETH),
    erc20Balance(WETH, ARB_WETH_POOL, 1_000_000_000_000_000_000_000n),
  ] as const;
}

function arbitrumMagicWethResponses() {
  return [
    ...arbitrumWethFeedResponses(),
    [key(MAGIC_WETH_POOL, "token0"), MAGIC],
    [key(MAGIC_WETH_POOL, "token1"), WETH],
    [
      key(MAGIC_WETH_POOL, "getReserves"),
      [10_000_000_000_000_000_000_000n, 10_000_000_000_000_000_000n, 0],
    ],
    erc20Decimals(MAGIC),
    erc20Decimals(WETH),
  ] as const;
}

function berachainHoneyFeedResponses() {
  return feedResponses(BERACHAIN, HONEY, 100_000_000n);
}

function berachainWberaHoneyResponses() {
  return [
    ...berachainHoneyFeedResponses(),
    [key(WBERA_HONEY_POOL, "token0"), WBERA],
    [key(WBERA_HONEY_POOL, "token1"), HONEY],
    [key(WBERA_HONEY_POOL, "fee"), 3000],
    [key(WBERA_HONEY_POOL, "liquidity"), 1_000_000n],
    [key(IBERA_WBERA_POOL_3000, "token0"), WBERA],
    [key(IBERA_WBERA_POOL_3000, "token1"), IBERA],
    [key(IBERA_WBERA_POOL_3000, "fee"), 3000],
    [key(IBERA_WBERA_POOL_3000, "liquidity"), 0n],
    [key(IBERA_WBERA_POOL_500, "token0"), WBERA],
    [key(IBERA_WBERA_POOL_500, "token1"), IBERA],
    [key(IBERA_WBERA_POOL_500, "fee"), 500],
    [key(IBERA_WBERA_POOL_500, "liquidity"), 0n],
    erc20Decimals(WBERA),
    erc20Decimals(HONEY),
    quote(WBERA, HONEY, 1_000_000_000_000_000_000n, 3000, WBERA_HONEY_AMOUNT_OUT),
    erc20Balance(HONEY, WBERA_HONEY_POOL, 2_000_000_000_000_000_000_000n),
  ] as const;
}

function berachainIberaWberaResponses() {
  return [
    ...berachainHoneyFeedResponses(),
    [key(WBERA_HONEY_POOL, "token0"), WBERA],
    [key(WBERA_HONEY_POOL, "token1"), HONEY],
    [key(WBERA_HONEY_POOL, "fee"), 3000],
    [key(WBERA_HONEY_POOL, "liquidity"), 1_000_000n],
    quote(WBERA, HONEY, 1_000_000_000_000_000_000n, 3000, WBERA_HONEY_AMOUNT_OUT),
    erc20Balance(HONEY, WBERA_HONEY_POOL, 2_000_000_000_000_000_000_000n),
    [key(IBERA_WBERA_POOL_3000, "token0"), WBERA],
    [key(IBERA_WBERA_POOL_3000, "token1"), IBERA],
    [key(IBERA_WBERA_POOL_3000, "fee"), 3000],
    [key(IBERA_WBERA_POOL_3000, "liquidity"), 1_000_000n],
    quote(IBERA, WBERA, 1_000_000_000_000_000_000n, 3000, IBERA_WBERA_AMOUNT_OUT),
    erc20Balance(WBERA, IBERA_WBERA_POOL_3000, 5_000_000_000_000_000_000_000n),
    [key(IBERA_WBERA_POOL_500, "token0"), WBERA],
    [key(IBERA_WBERA_POOL_500, "token1"), IBERA],
    [key(IBERA_WBERA_POOL_500, "fee"), 500],
    [key(IBERA_WBERA_POOL_500, "liquidity"), 0n],
    erc20Decimals(WBERA),
    erc20Decimals(HONEY),
    erc20Decimals(IBERA),
  ] as const;
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
    await expect(getPrice(ARBITRUM, client, FRAX, ARBITRUM_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq("1"),
    );
  });

  test("derives WETH through the Chainlink base-price feed", async () => {
    const client = mockClient(ARBITRUM.chainId, contractResponses(arbitrumWethFeedResponses()));
    await expect(getPrice(ARBITRUM, client, WETH, ARBITRUM_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq("3000"),
    );
  });

  test("derives ARB through the ARB-WETH Uniswap V3 handler", async () => {
    const client = mockClient(ARBITRUM.chainId, contractResponses(arbitrumArbWethResponses()));
    await expect(getPrice(ARBITRUM, client, ARB, ARBITRUM_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq("3000"),
    );
  });

  test("derives MAGIC through the MAGIC-WETH Uniswap V2 handler", async () => {
    const client = mockClient(ARBITRUM.chainId, contractResponses(arbitrumMagicWethResponses()));
    await expect(getPrice(ARBITRUM, client, MAGIC, ARBITRUM_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq("3"),
    );
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

  test("derives HONEY through the Chainlink base-price feed", async () => {
    const client = mockClient(BERACHAIN.chainId, contractResponses(berachainHoneyFeedResponses()));
    await expect(getPrice(BERACHAIN, client, HONEY, BERACHAIN_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq("1"),
    );
  });

  test("derives USDC.e through the Chainlink base-price feed", async () => {
    const client = mockClient(BERACHAIN.chainId, contractResponses(berachainHoneyFeedResponses()));
    await expect(
      getPrice(BERACHAIN, client, USDC_BERACHAIN, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((price) => price.eq("1"));
  });

  test("derives WBERA through the WBERA-HONEY quoter handler", async () => {
    const client = mockClient(BERACHAIN.chainId, contractResponses(berachainWberaHoneyResponses()));
    await expect(getPrice(BERACHAIN, client, WBERA, BERACHAIN_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq(WBERA_PRICE),
    );
  });

  test("keeps native BERA remapped to WBERA instead of pricing it at one dollar", async () => {
    const client = mockClient(BERACHAIN.chainId, contractResponses(berachainWberaHoneyResponses()));
    await expect(
      getPrice(BERACHAIN, client, NATIVE_BERA, BERACHAIN_BLOCK, null),
    ).resolves.toSatisfy((price) => price.eq(WBERA_PRICE));
  });

  test("uses the highest-liquidity IBERA-WBERA handler and recurses through WBERA-HONEY", async () => {
    const client = mockClient(BERACHAIN.chainId, contractResponses(berachainIberaWberaResponses()));

    await expect(getPrice(BERACHAIN, client, IBERA, BERACHAIN_BLOCK, null)).resolves.toSatisfy(
      (price) => price.eq(IBERA_PRICE),
    );

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
