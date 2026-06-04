import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";

import { getPrice } from "../../src/pricing";
import type { ChainConfig, LiquidityHandler } from "../../src/snapshot/types";

const CHAIN_ID = 42161;
const ETH_USD_FEED = "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612";
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const BLOCK = 100_000_000n;

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("ChainlinkPriceHandler must go through context.effect, not direct RPC");
    },
  } as unknown as PublicClient;
}

// The effect call is the new boundary; we mock it instead of ChainlinkPriceState.
// Returning the answer as a stringified bigint matches the effect's S.string output.
function mockContext(answerByFeed: Record<string, bigint | null> = {}): EvmOnBlockContext {
  return {
    effect: async (_effect: unknown, input: { feedAddress: string }) => {
      const value = answerByFeed[input.feedAddress.toLowerCase()];
      if (value === undefined || value === null) {
        throw new Error(`mockContext.effect: no answer configured for ${input.feedAddress}`);
      }
      return value.toString();
    },
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
  test("returns the RPC latestAnswer with feed decimals applied", async () => {
    const config = buildConfig([
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [WETH], decimals: 8 },
    ]);
    const context = mockContext({ [ETH_USD_FEED]: 200_000_000_000n }); // $2000.00 at 8 decimals
    const result = await getPrice(config, context, mockClient(), WETH, BLOCK, null);
    expect(result.price.eq("2000")).toBe(true);
  });

  test("returns ZERO when the RPC answer is 0 (stale/uninitialised feed)", async () => {
    const config = buildConfig([
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [WETH], decimals: 8 },
    ]);
    const context = mockContext({ [ETH_USD_FEED]: 0n });
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
    // Effect should never be called because isActive guard short-circuits;
    // configuring no answer ensures the test fails loudly if that changes.
    const context = mockContext();
    const result = await getPrice(config, context, mockClient(), WETH, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
