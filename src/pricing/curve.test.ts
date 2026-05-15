import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import type { ChainConfig, LiquidityHandler } from "../snapshot/types";
import { getPrice } from ".";

const CHAIN_ID = 1;
const POOL = "0xfc1e8bf3e81383ef07be24c3fd146745719de48d";
const OHM = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const FRAX = "0x853d955acef822db058eb8505911ed77f175b99e";
const FRAX_USD_FEED = "0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd";

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("CurvePriceHandler must not perform RPC reads directly");
    },
  } as unknown as PublicClient;
}

function mockContext(
  chainlinkStates: ReadonlyArray<readonly [string, unknown]>,
  curveSnapshot: { balances: string[]; totalSupply: string } | null,
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
    effect: vi.fn(async () => curveSnapshot ?? { balances: [], totalSupply: "0" }),
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

describe("CurvePriceHandler", () => {
  test("prices LP as Σ(balance × price) / totalSupply", async () => {
    // Pool: 1000 OHM + 15000 FRAX. OHM not priceable in this test (no
    // handler) so the OHM contribution is 0. LP supply = 1000 (18-dec).
    // FRAX @ $1 → poolValue = 15000 → LP price = 15000 / 1000 = $15.
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: FRAX_USD_FEED, tokens: [FRAX], decimals: 8 },
      {
        kind: "curve",
        id: POOL,
        tokens: [POOL],
        lpToken: POOL,
        coins: [OHM, FRAX],
        coinDecimals: [9, 18],
      },
    ];
    const config = buildConfig(handlers);
    const snapshot = {
      // 1000 OHM at 9 decimals + 15000 FRAX at 18 decimals
      balances: ["1000000000000", "15000000000000000000000"],
      // 1000 LP at 18 decimals
      totalSupply: "1000000000000000000000",
    };
    const context = mockContext(
      [
        [
          `${CHAIN_ID}-${FRAX_USD_FEED.toLowerCase()}`,
          {
            answer: 100_000_000n, // $1 at 8-decimal feed
            decimals: 8,
            roundId: 1n,
            updatedAtBlock: 1_000_000n,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
      snapshot,
    );
    const result = await getPrice(config, context, mockClient(), POOL, 1_000_000n, null);
    expect(result.price.toFixed(0)).toBe("15");
  });

  test("returns ZERO when totalSupply is zero", async () => {
    const handlers: LiquidityHandler[] = [
      {
        kind: "curve",
        id: POOL,
        tokens: [POOL],
        lpToken: POOL,
        coins: [OHM, FRAX],
        coinDecimals: [9, 18],
      },
    ];
    const config = buildConfig(handlers);
    const context = mockContext([], { balances: ["1", "1"], totalSupply: "0" });
    const result = await getPrice(config, context, mockClient(), POOL, 1_000_000n, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
