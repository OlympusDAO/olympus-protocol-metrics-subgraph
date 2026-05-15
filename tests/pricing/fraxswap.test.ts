import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import type { ChainConfig, LiquidityHandler } from "../../src/snapshot/types";
import { getPrice } from "../../src/pricing";

const CHAIN_ID = 1;
const POOL = "0x38633ed142bcc8128b45ab04a2e4a6e53774699f";
const OHM = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const FRAX = "0x853d955acef822db058eb8505911ed77f175b99e";
const FRAX_USD_FEED = "0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd";

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("FraxSwapPriceHandler must not perform RPC reads directly");
    },
  } as unknown as PublicClient;
}

function mockContext(
  chainlinkStates: ReadonlyArray<readonly [string, unknown]>,
  snapshot: { reserve0: string; reserve1: string; totalSupply: string } | null,
): EvmOnBlockContext {
  const map = new Map(chainlinkStates);
  return {
    ChainlinkPriceState: { get: async (id: string) => map.get(id) },
    OhmIndexState: { get: async () => undefined },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    effect: vi.fn(async () => snapshot ?? { reserve0: "0", reserve1: "0", totalSupply: "0" }),
  } as unknown as EvmOnBlockContext;
}

function buildConfig(handlers: LiquidityHandler[]): ChainConfig {
  return {
    chainId: CHAIN_ID,
    blockchain: "Ethereum",
    startBlock: 0,
    rpcUrls: [],
    tokens: [
      { address: FRAX, category: "Stable", isLiquid: true, isBluechip: false, decimals: 18 },
      { address: POOL, category: "LP", isLiquid: true, isBluechip: false, decimals: 18 },
      { address: OHM, category: "OHM", isLiquid: true, isBluechip: false, decimals: 9 },
    ],
    names: {},
    abbreviations: {},
    protocolAddresses: [],
    circulatingSupplyWallets: [],
    treasuryBlacklist: {},
    basePriceFeeds: {},
    ohmToken: OHM,
    liquidityHandlers: handlers,
    ownedLiquidityHandlers: [],
  } as unknown as ChainConfig;
}

describe("FraxSwapPriceHandler", () => {
  test("prices LP as (reserve0 × p0 + reserve1 × p1) / totalSupply", async () => {
    // OHM not priceable in this test; FRAX @ $1.
    // reserve0 = 1000 OHM, reserve1 = 20000 FRAX, totalSupply = 100 LP.
    // poolValue = 0 + 20000 = 20000. price = 20000 / 100 = $200.
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: FRAX_USD_FEED, tokens: [FRAX], decimals: 8 },
      {
        kind: "fraxswap",
        id: POOL,
        tokens: [POOL],
        token0: OHM,
        token1: FRAX,
        decimals0: 9,
        decimals1: 18,
      },
    ];
    const config = buildConfig(handlers);
    const context = mockContext(
      [
        [
          `${CHAIN_ID}-${FRAX_USD_FEED.toLowerCase()}`,
          {
            answer: 100_000_000n,
            decimals: 8,
            roundId: 1n,
            updatedAtBlock: 1_000_000n,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
      {
        reserve0: "1000000000000",
        reserve1: "20000000000000000000000",
        totalSupply: "100000000000000000000",
      },
    );
    const result = await getPrice(config, context, mockClient(), POOL, 1_000_000n, null);
    expect(result.price.toFixed(0)).toBe("200");
  });

  test("returns ZERO when totalSupply is zero", async () => {
    const handlers: LiquidityHandler[] = [
      {
        kind: "fraxswap",
        id: POOL,
        tokens: [POOL],
        token0: OHM,
        token1: FRAX,
        decimals0: 9,
        decimals1: 18,
      },
    ];
    const config = buildConfig(handlers);
    const context = mockContext([], { reserve0: "1", reserve1: "1", totalSupply: "0" });
    const result = await getPrice(config, context, mockClient(), POOL, 1_000_000n, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
