import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";
import { getPrice } from "../../src/pricing";
import type { ChainConfig, LiquidityHandler } from "../../src/snapshot/types";

const CHAIN_ID = 1;
const SDAI = "0x83f20f44975d03b1b09e64809b757c47f942beea";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const DAI_USD_FEED = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9";
const BLOCK = 20_000_000n;

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("Erc4626PriceHandler must not perform RPC reads directly");
    },
  } as unknown as PublicClient;
}

function mockContext(
  chainlinkStates: ReadonlyArray<readonly [string, unknown]>,
  vaultRate: string | null,
): EvmOnBlockContext {
  const chainlinkMap = new Map(chainlinkStates);
  const effect = vi.fn(
    async (_effectDef: unknown, input: { chainId?: number; feedAddress?: string }) => {
      if (input.feedAddress !== undefined && input.chainId !== undefined) {
        const stateId = `${input.chainId}-${input.feedAddress.toLowerCase()}`;
        const state = chainlinkMap.get(stateId) as { answer?: bigint } | undefined;
        return (state?.answer ?? 0n).toString();
      }
      return vaultRate ?? "";
    },
  );
  return {
    OhmIndexState: { get: async () => undefined },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    effect,
  } as unknown as EvmOnBlockContext;
}

function buildConfig(handlers: LiquidityHandler[]): ChainConfig {
  return {
    chainId: CHAIN_ID,
    blockchain: "Ethereum",
    startBlock: 0,
    rpcUrls: [],
    tokens: [
      { address: DAI, category: "Stable", isLiquid: true, isBluechip: false, decimals: 18 },
      { address: SDAI, category: "Stable", isLiquid: true, isBluechip: false, decimals: 18 },
    ],
    names: {},
    abbreviations: {},
    protocolAddresses: [],
    circulatingSupplyWallets: [],
    treasuryBlacklist: {},
    basePriceFeeds: {},
    ohmToken: DAI,
    liquidityHandlers: handlers,
    ownedLiquidityHandlers: [],
  } as unknown as ChainConfig;
}

describe("Erc4626PriceHandler", () => {
  test("prices sDAI as DAI × convertToAssets ratio", async () => {
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: DAI_USD_FEED, tokens: [DAI], decimals: 8 },
      {
        kind: "erc4626",
        id: SDAI,
        tokens: [SDAI],
        underlying: DAI,
        decimals: 18,
        underlyingDecimals: 18,
      },
    ];
    const config = buildConfig(handlers);
    const context = mockContext(
      [
        [
          `${CHAIN_ID}-${DAI_USD_FEED.toLowerCase()}`,
          {
            answer: 100_010_000n, // $1.0001 at 8-decimal feed
            decimals: 8,
            roundId: 1n,
            updatedAtBlock: BLOCK,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
      // convertToAssets(1e18) = 1.05e18 → 1.05 DAI per share
      "1050000000000000000",
    );
    const result = await getPrice(config, context, mockClient(), SDAI, BLOCK, null);
    const expected = new BigNumber("1.0001").times(new BigNumber("1.05"));
    expect(result.price.toFixed(9)).toBe(expected.toFixed(9));
  });

  test("returns ZERO when the vault rate read returns empty (revert)", async () => {
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: DAI_USD_FEED, tokens: [DAI], decimals: 8 },
      {
        kind: "erc4626",
        id: SDAI,
        tokens: [SDAI],
        underlying: DAI,
        decimals: 18,
        underlyingDecimals: 18,
      },
    ];
    const config = buildConfig(handlers);
    const context = mockContext(
      [
        [
          `${CHAIN_ID}-${DAI_USD_FEED.toLowerCase()}`,
          {
            answer: 100_010_000n,
            decimals: 8,
            roundId: 1n,
            updatedAtBlock: BLOCK,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
      null,
    );
    const result = await getPrice(config, context, mockClient(), SDAI, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
