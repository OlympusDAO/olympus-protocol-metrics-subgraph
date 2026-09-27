import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushUniv3NftPol, univ3PoolKey } from "../../src/handlers/Univ3NftPol";
import { ETHEREUM } from "../../src/snapshot/chains/ethereum";
import type { SerializedTokenRecord, SerializedTokenSupply } from "../../src/snapshot/types";

vi.mock("../../src/pricing", () => ({
  getPrice: vi.fn(async () => ({ price: new BigNumber(1) })),
}));

const ohm = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const pool03 = "0x88051b0eea095007d3bef21ab287be961f3d8598";
const pool1 = "0x584ec2562b937c4ac0452184d8d83346382b5d3a";
// Synthetic amounts/prices exercise production routing; not a live NFT valuation.
const position = (fee: number) => ({
  token0: ohm,
  token1: weth,
  fee,
  tickLower: -1000,
  tickUpper: 1000,
  liquidity: "1000000000000000000",
});

async function snapshot(fees: number[]) {
  const get = vi.fn(async (id: string) => ({
    sqrtPriceX96: id.endsWith(pool1) ? (2n ** 96n * 101n) / 100n : 2n ** 96n,
  }));
  const context = {
    effect: vi.fn(async () => ({ positions: fees.map(position) })),
    Univ3PoolState: { get },
  };
  const records: SerializedTokenRecord[] = [];
  const supplies: SerializedTokenSupply[] = [];
  await pushUniv3NftPol(
    context as unknown as EvmOnBlockContext,
    { ...ETHEREUM, protocolAddresses: [ETHEREUM.protocolAddresses[0]] },
    {} as PublicClient,
    records,
    supplies,
    1_790_460_000n,
    26_000_000n,
  );
  return { records, supplies, get };
}

describe("fee-aware UniV3 POL", () => {
  test("normalizes pair order and case without collapsing fee tiers", () => {
    expect(univ3PoolKey([ohm, weth], 3000)).not.toBe(univ3PoolKey([ohm, weth], 10000));
    expect(univ3PoolKey([ohm.toUpperCase(), weth], 10000)).toBe(univ3PoolKey([weth, ohm], 10000));
  });

  test("uses each fee tier's pool state and emits separate POL and supply records", async () => {
    const { records, supplies, get } = await snapshot([3000, 10000]);
    expect(get.mock.calls.map(([id]) => id)).toEqual([`1-${pool03}`, `1-${pool1}`]);
    expect(records.map((record) => record.tokenAddress)).toEqual([pool03, pool1]);
    expect(records.map((record) => record.token)).toEqual([
      "UniswapV3 0.3% WETH-OHM",
      "UniswapV3 1% WETH-OHM",
    ]);
    expect(supplies).toHaveLength(2);
    expect(records[0].value).not.toBe(records[1].value);
  });

  test("does not value an unknown fee tier against another pool for the same pair", async () => {
    const { records, supplies, get } = await snapshot([500]);
    expect(records).toEqual([]);
    expect(supplies).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  test("aggregates multiple NFTs only within their matching pool", async () => {
    const single = await snapshot([10000]);
    const multiple = await snapshot([10000, 10000]);
    expect(multiple.records).toHaveLength(1);
    expect(new BigNumber(multiple.records[0].value).toString()).toBe(
      new BigNumber(single.records[0].value).times(2).toString(),
    );
    expect(multiple.supplies).toHaveLength(1);
  });

  test("the new 1% pool is POL, not a price-oracle candidate", () => {
    expect(ETHEREUM.ownedLiquidityHandlers.some((handler) => handler.id === pool1)).toBe(true);
    expect(ETHEREUM.liquidityHandlers.some((handler) => handler.id === pool1)).toBe(false);
  });
});
