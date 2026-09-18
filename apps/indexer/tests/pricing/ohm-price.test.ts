import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test } from "vitest";

import { getPrice } from "../../src/pricing";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr, matches } from "../../src/snapshot/math";

const ETHEREUM = CHAIN_CONFIGS[1];
const OHM = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
const WETH = addr("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const SUSHI_OHM_DAI = addr("0x055475920a8c93cffb64d039a8205f7acc7722d3");
const UNIV3_WETH_OHM = addr("0x88051b0eea095007d3bef21ab287be961f3d8598");

// 2022-05-08. SushiSwap OHM-DAI held 953,699.55 OHM against 19.56M DAI (OHM
// ≈ $20.50). The Uniswap V3 WETH-OHM pool was thin; here it quotes OHM at $27
// with only 100 WETH on the WETH side. Legacy priced OHM from the deepest pool.
const BLOCK = 14_733_600n;
const ETH_USD = 2_800;
const SUSHI_RESERVES = {
  reserve0: 953_699_545_842_375n, // OHM, 9 decimals
  reserve1: 19_555_934_706_675_190_473_282_844n, // DAI, 18 decimals
};

// token0 = OHM (9 decimals), token1 = WETH (18). Raw WETH per raw OHM for a
// $27 OHM is (27 / 2800) * 1e9.
function sqrtPriceX96For(ohmUsd: number): bigint {
  const rawRatio = (ohmUsd / ETH_USD) * 1e9;
  const scale = 1_000_000_000n;
  return (BigInt(Math.round(Math.sqrt(rawRatio) * Number(scale))) * 2n ** 96n) / scale;
}

function wethFeed(): string {
  const feed = ETHEREUM.liquidityHandlers.find(
    (handler) => handler.kind === "chainlink" && matches(handler, WETH),
  );
  if (!feed) throw new Error("no Chainlink WETH feed in Ethereum config");
  return feed.id.toLowerCase();
}

function buildContext(): EvmOnBlockContext {
  const ethFeed = wethFeed();
  return {
    Univ2PoolState: {
      get: async (id: string) => (id === `1-${SUSHI_OHM_DAI}` ? SUSHI_RESERVES : undefined),
    },
    Univ3PoolState: {
      get: async (id: string) =>
        id === `1-${UNIV3_WETH_OHM}`
          ? { sqrtPriceX96: sqrtPriceX96For(27), liquidity: 10n ** 21n }
          : undefined,
    },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    OhmIndexState: { get: async () => undefined },
    effect: async (
      _effectDef: unknown,
      input: { feedAddress?: string; walletAddress?: string; tokenAddress?: string },
    ) => {
      if (input.feedAddress !== undefined) {
        return (input.feedAddress.toLowerCase() === ethFeed ? ETH_USD * 1e8 : 1e8).toString();
      }
      if (input.walletAddress !== undefined) {
        // WETH held by the V3 pool; other pools read zero.
        return addr(input.walletAddress) === UNIV3_WETH_OHM &&
          addr(input.tokenAddress ?? "") === WETH
          ? (100n * 10n ** 18n).toString()
          : "0";
      }
      return "";
    },
  } as unknown as EvmOnBlockContext;
}

describe("Ethereum OHM price selection", () => {
  test("prices OHM from the deepest pool (SushiSwap OHM-DAI) over a thin Uniswap V3 pool", async () => {
    const client = {
      chain: { id: 1 },
      readContract: async () => {
        throw new Error("OHM price must come from indexed pool state and cached effects");
      },
    } as unknown as PublicClient;

    const result = await getPrice(ETHEREUM, buildContext(), client, OHM, BLOCK, null);

    // 19,555,934.71 DAI / 953,699.55 OHM at $1 DAI.
    expect(result.price.toNumber()).toBeCloseTo(20.5053, 3);
    expect(result.liquidity.toNumber()).toBeCloseTo(19_555_934.7, 0);
  });
});
