import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";
import { getPrice } from "../../src/pricing";
import type { ChainConfig, LiquidityHandler } from "../../src/snapshot/types";

const CHAIN_ID = 1;
const SOHM_V3 = "0x04906695d6d12cf5459975d7c3c03356e4ccd460";
const OHM = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const GOHM = "0x0ab87046fbb341d058f17cbc4c1133f25a20a52f";
const ETH_USD_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const BLOCK = 20_000_000n;

function mockClient(): PublicClient {
  return {
    chain: { id: CHAIN_ID },
    readContract: async () => {
      throw new Error("GohmPriceHandler must not perform RPC reads");
    },
  } as unknown as PublicClient;
}

function mockContext(
  chainlinkStates: ReadonlyArray<readonly [string, unknown]> = [],
  ohmIndexStates: ReadonlyArray<readonly [string, unknown]> = [],
): EvmOnBlockContext {
  const chainlinkMap = new Map(chainlinkStates);
  const ohmIndexMap = new Map(ohmIndexStates);
  return {
    OhmIndexState: { get: async (id: string) => ohmIndexMap.get(id) },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    effect: async (_effectDef: unknown, input: { chainId?: number; feedAddress?: string }) => {
      if (input.feedAddress !== undefined && input.chainId !== undefined) {
        const stateId = `${input.chainId}-${input.feedAddress.toLowerCase()}`;
        const state = chainlinkMap.get(stateId) as { answer?: bigint } | undefined;
        return (state?.answer ?? 0n).toString();
      }
      throw new Error("gohm mockContext: unhandled effect call");
    },
  } as unknown as EvmOnBlockContext;
}

function buildConfig(handlers: LiquidityHandler[]): ChainConfig {
  return {
    chainId: CHAIN_ID,
    blockchain: "Ethereum",
    startBlock: 0,
    rpcUrls: [],
    tokens: [
      { address: WETH, category: "Volatile", isLiquid: true, isBluechip: true, decimals: 18 },
      { address: OHM, category: "Volatile", isLiquid: true, isBluechip: false, decimals: 9 },
      { address: GOHM, category: "Volatile", isLiquid: true, isBluechip: false, decimals: 18 },
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

describe("GohmPriceHandler", () => {
  test("prices gOHM as OHM × index/1e9", async () => {
    // Construct a synthetic config where OHM resolves through a chainlink
    // feed (so the recursive lookup is fully deterministic). The "OHM-USD"
    // feed below isn't a real Chainlink mainnet feed; using it keeps the
    // test self-contained.
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [OHM], decimals: 8 },
      { kind: "gohm", id: SOHM_V3, tokens: [GOHM], ohmToken: OHM },
    ];
    const config = buildConfig(handlers);
    const context = mockContext(
      [
        [
          `${CHAIN_ID}-${ETH_USD_FEED.toLowerCase()}`,
          {
            answer: 1_500_000_000n, // OHM @ $15.00 (8-decimal feed)
            decimals: 8,
            roundId: 1n,
            updatedAtBlock: BLOCK,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
      [
        [
          `${CHAIN_ID}-${SOHM_V3.toLowerCase()}`,
          {
            index: 131_283_291_432n, // 131.283291432 at 9 decimals
            epoch: 1_234n,
            updatedAtBlock: BLOCK,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
    );
    const result = await getPrice(config, context, mockClient(), GOHM, BLOCK, null);
    // $15 × 131.283291432 = $1969.249371480
    const expected = new BigNumber("15").times(new BigNumber("131.283291432"));
    expect(result.price.toFixed(9)).toBe(expected.toFixed(9));
  });

  test("returns ZERO when OhmIndexState is missing", async () => {
    const handlers: LiquidityHandler[] = [
      { kind: "chainlink", id: ETH_USD_FEED, tokens: [OHM], decimals: 8 },
      { kind: "gohm", id: SOHM_V3, tokens: [GOHM], ohmToken: OHM },
    ];
    const config = buildConfig(handlers);
    const context = mockContext([
      [
        `${CHAIN_ID}-${ETH_USD_FEED.toLowerCase()}`,
        {
          answer: 1_500_000_000n,
          decimals: 8,
          roundId: 1n,
          updatedAtBlock: BLOCK,
          updatedAtTimestamp: 1_700_000_000n,
        },
      ],
    ]);
    const result = await getPrice(config, context, mockClient(), GOHM, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });

  test("returns ZERO when the OHM lookup yields zero (no underlying handler)", async () => {
    const handlers: LiquidityHandler[] = [
      { kind: "gohm", id: SOHM_V3, tokens: [GOHM], ohmToken: OHM },
    ];
    const config = buildConfig(handlers);
    const context = mockContext(
      [],
      [
        [
          `${CHAIN_ID}-${SOHM_V3.toLowerCase()}`,
          {
            index: 131_283_291_432n,
            epoch: 1_234n,
            updatedAtBlock: BLOCK,
            updatedAtTimestamp: 1_700_000_000n,
          },
        ],
      ],
    );
    const result = await getPrice(config, context, mockClient(), GOHM, BLOCK, null);
    expect(result.price.eq("0")).toBe(true);
  });
});
