import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";

import type { ChainConfig, LiquidityHandler } from "../../src/snapshot/types";
import { getPrice } from "../../src/pricing";

const CHAIN_ID = 42161;
const ETH_USD_FEED = "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612";
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const BLOCK = 100_000_000n;

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("ChainlinkPriceHandler must not perform RPC reads");
    },
  } as unknown as PublicClient;
}

function mockContext(
  chainlinkStates: ReadonlyArray<readonly [string, unknown]> = [],
): EvmOnBlockContext {
  const map = new Map(chainlinkStates);
  return {
    ChainlinkPriceState: { get: async (id: string) => map.get(id) },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
  } as unknown as EvmOnBlockContext;
}

function buildConfig(handlers: LiquidityHandler[]): ChainConfig {
  return {
    chainId: CHAIN_ID,
    blockchain: "TestChain",
    startBlock: 0,
    rpcUrls: [],
    tokens: [
      {
        address: WETH,
        category: "Volatile",
        isLiquid: true,
        isBluechip: true,
        decimals: 18,
      },
    ],
    names: {},
    abbreviations: {},
    protocolAddresses: [],
    circulatingSupplyWallets: [],
    treasuryBlacklist: {},
    basePriceFeeds: {},
    ohmToken: WETH,
    liquidityHandlers: handlers,
    ownedLiquidityHandlers: [],
  } as unknown as ChainConfig;
}

describe("ChainlinkPriceHandler", () => {
  test("returns the indexed Chainlink answer with feed decimals applied", async () => {
    const config = buildConfig([
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [WETH], decimals: 8 },
    ]);
    const context = mockContext([
      [
        `${CHAIN_ID}-${ETH_USD_FEED.toLowerCase()}`,
        {
          answer: 200_000_000_000n, // $2000.00 at 8 decimals
          decimals: 8,
          roundId: 1n,
          updatedAtBlock: BLOCK,
          updatedAtTimestamp: 1_700_000_000n,
        },
      ],
    ]);
    const result = await getPrice(config, context, mockClient(), WETH, BLOCK, null);
    expect(result.price.eq("2000")).toBe(true);
  });

  test("returns ZERO when no ChainlinkPriceState row exists for the feed", async () => {
    const config = buildConfig([
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [WETH], decimals: 8 },
    ]);
    const context = mockContext();
    const result = await getPrice(config, context, mockClient(), WETH, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });

  test("returns ZERO when the handler is not yet active at this block", async () => {
    const config = buildConfig([
      {
        kind: "chainlink",
        id: ETH_USD_FEED,
        tokens: [WETH],
        decimals: 8,
        startBlock: 200_000_000,
      },
    ]);
    const context = mockContext([
      [
        `${CHAIN_ID}-${ETH_USD_FEED.toLowerCase()}`,
        {
          answer: 200_000_000_000n,
          decimals: 8,
          roundId: 1n,
          updatedAtBlock: BLOCK,
          updatedAtTimestamp: 1_700_000_000n,
        },
      ],
    ]);
    const result = await getPrice(config, context, mockClient(), WETH, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
