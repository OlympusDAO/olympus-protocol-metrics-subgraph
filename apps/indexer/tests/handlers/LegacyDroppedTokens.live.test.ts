import BigNumber from "bignumber.js";
import { createTestIndexer } from "envio";
import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { describe, expect, it } from "vitest";

import "../../src/handlers/BackfillTokenBalances";
import "../../src/handlers/BalancerPools";
import "../../src/handlers/BlockHandlers";
import "../../src/handlers/BondManager";
import "../../src/handlers/BophadesKernel";
import "../../src/handlers/Erc20Transfers";
import "../../src/handlers/GnosisEasyAuction";
import "../../src/handlers/SOhmV3";
import "../../src/handlers/Univ2Pools";
import "../../src/handlers/Univ3Pools";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";

// Needs HyperSync (ENVIO_API_TOKEN) and an Ethereum archive RPC; skipped
// without them, never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const T = {
  ALCX: addr("0xdbdb4d16eda451d0503b854cf79d55697f90c8df"),
  CRV: addr("0xd533a949740bb3306d119cc777fa900ba034cd52"),
  FDT: addr("0xed1480d12be41d92f36f5f7bdd88212e381a3677"),
  FOX: addr("0xc770eefad204b5180df6a14ee197d99d808ee52d"),
  FPIS: addr("0xc2544a32872a91f4a553b404c6950e89de901fdb"),
  KP3R: addr("0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44"),
  SUSHI: addr("0x6b3595068778dd592e39a122f4f5a5cf09c90fe2"),
  SYN: addr("0x0f2d719407fdbeff09d87557abb7232601fd9f29"),
  THOR: addr("0xa5f2211b9b8170f694421f2046281775e8468044"),
};
const POOL = {
  foxEth: addr("0x470e8de2ebaef52014a47cb5e6af86884947f08c"),
  synWeth: addr("0x4a86c01d67965f8cb3d0aaa2c655705e64097c31"),
  thorWeth: addr("0x3d3f13f2529ec3c84b2940155effbf9b39a8f3ec"),
  fpisFrax: addr("0x8fe536c7dc019455cce34746755c64bbe2aa163b"),
};
const VAULT = "0xba12222222228d8ba445958a75a0704d566bf2c8";
const WETH_FDT = "0x2d344a84bac123660b021eebe4eb6f12ba25fe8600020000000000000000018a";
const FEED = {
  eth: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
  frax: "0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd",
  crv: "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
  fox: "0xccA02FFEFAcE21325befD6616cB4Ba5fCB047480",
  alcxEth: "0x194a9AaF2e0b67c35915cD01101585A33Fe25CAa",
  kp3rEth: "0xe7015CCb7E5F788B8c1010FC22343473EaaC3741",
  sushiEth: "0xe572CeF69f43c2E488b33924AF04BDacE19079cf",
};
const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function getPoolTokens(bytes32) view returns (address[], uint256[], uint256)",
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
  "function latestAnswer() view returns (int256)",
]);
const WALLETS = CHAIN_CONFIGS[1].protocolAddresses;

type Row = Record<string, unknown>;

describe.skipIf(!canRun)("tokens legacy tracked — live, against the price sources", () => {
  let rpc: ReturnType<typeof createPublicClient> | undefined;
  const client = () => {
    rpc ??= createPublicClient({ transport: http(RPC_URL) });
    return rpc;
  };
  const read = (address: string, functionName: string, block: number, args: unknown[] = []) =>
    client().readContract({
      address: getAddress(address),
      abi: ABI,
      functionName: functionName as never,
      args: args as never,
      blockNumber: BigInt(block),
    }) as Promise<never>;
  const decimal = (raw: bigint, decimals: number) =>
    new BigNumber(raw.toString()).div(new BigNumber(10).pow(decimals));
  const feed = async (address: string, decimals: number, block: number) =>
    decimal(await read(address, "latestAnswer", block), decimals);
  // Price of `token` in the other token of a UniV2 pair.
  const v2Rate = async (pool: string, token: string, block: number) => {
    const [r0, r1] = (await read(pool, "getReserves", block)) as bigint[];
    const token0 = addr(await read(pool, "token0", block));
    return token0 === token
      ? decimal(r1, 18).div(decimal(r0, 18))
      : decimal(r0, 18).div(decimal(r1, 18));
  };

  async function snapshot(block: number, tokens: string[]) {
    const indexer = createTestIndexer();
    const held: [string, string, bigint][] = [];
    for (const token of tokens) {
      for (const wallet of WALLETS) {
        const balance = (await read(token, "balanceOf", block - 1, [wallet])) as bigint;
        if (balance === 0n) continue;
        held.push([token, addr(wallet), balance]);
        indexer.TokenBalance.set({
          id: `1-${token}-${addr(wallet)}`,
          chainId: 1,
          tokenAddress: token,
          walletAddress: addr(wallet),
          balance,
          updatedAtBlock: BigInt(block - 1),
        });
      }
    }
    for (const pool of [POOL.foxEth, POOL.synWeth, POOL.thorWeth]) {
      const [reserve0, reserve1] = (await read(pool, "getReserves", block - 1)) as bigint[];
      indexer.Univ2PoolState.set({
        id: `1-${pool}`,
        chainId: 1,
        poolAddress: pool,
        reserve0,
        reserve1,
        updatedAtBlock: BigInt(block - 1),
      });
    }
    if (block >= 14_528_660) {
      const [poolTokens, balances] = (await read(VAULT, "getPoolTokens", block - 1, [
        WETH_FDT,
      ])) as [string[], bigint[]];
      indexer.BalancerPoolState.set({
        id: `1-${WETH_FDT}`,
        chainId: 1,
        poolId: WETH_FDT,
        tokens: poolTokens.map(addr),
        balances,
        updatedAtBlock: BigInt(block - 1),
      });
    }
    if (block >= 14_546_561) {
      const [sqrtPriceX96, tick] = (await read(POOL.fpisFrax, "slot0", block - 1)) as [
        bigint,
        number,
      ];
      indexer.Univ3PoolState.set({
        id: `1-${POOL.fpisFrax}`,
        chainId: 1,
        poolAddress: POOL.fpisFrax,
        sqrtPriceX96,
        tick: BigInt(tick),
        liquidity: (await read(POOL.fpisFrax, "liquidity", block - 1)) as bigint,
        updatedAtBlock: BigInt(block - 1),
      });
    }
    const result = await indexer.process({ chains: { 1: { startBlock: block, endBlock: block } } });
    const records = result.changes
      .filter((change) => change.block === block)
      .flatMap((change) => (change.TokenRecord?.sets ?? []) as unknown as Row[]);
    return { held, records };
  }

  function expectRecords(
    held: [string, string, bigint][],
    records: Row[],
    expected: Record<string, BigNumber>,
  ) {
    for (const [token, wallet, balance] of held) {
      const row = records.find((r) => r.tokenAddress === token && r.sourceAddress === wallet);
      expect(row, `${token} @ ${wallet}`).toBeDefined();
      const rate = new BigNumber(String(row?.rate));
      process.stderr.write(
        `${String(row?.token)} @ ${wallet}: ${decimal(balance, 18).toFixed(2)} × ${rate.toPrecision(6)} = $${new BigNumber(String(row?.value)).toFixed(0)} (liquid ${String(row?.isLiquid)})\n`,
      );
      expect(new BigNumber(String(row?.balance)).toFixed(18)).toBe(
        decimal(balance, 18).toFixed(18),
      );
      expect(row?.isLiquid).toBe(true);
      expect(rate.minus(expected[token]).abs().div(expected[token]).toNumber(), token).toBeLessThan(
        1e-9,
      );
    }
  }

  // 2022-11-18: all nine held (FDT in Treasury V2, the rest mostly Treasury V3).
  const BLOCK = 16_000_800;

  it(`values all nine at ${BLOCK} from Chainlink and the pools`, async () => {
    const { held, records } = await snapshot(BLOCK, Object.values(T));
    expect(new Set(held.map(([token]) => token)).size).toBe(9);

    const eth = await feed(FEED.eth, 8, BLOCK);
    const [, balances] = (await read(VAULT, "getPoolTokens", BLOCK, [WETH_FDT])) as [
      string[],
      bigint[],
    ];
    const [sqrtPriceX96] = (await read(POOL.fpisFrax, "slot0", BLOCK)) as [bigint];
    // FRAX is token0: sqrtPrice² is FPIS per FRAX.
    const fpisPerFrax = new BigNumber(sqrtPriceX96.toString()).div(new BigNumber(2).pow(96)).pow(2);
    expectRecords(held, records, {
      [T.CRV]: await feed(FEED.crv, 8, BLOCK),
      [T.FOX]: await feed(FEED.fox, 8, BLOCK),
      [T.ALCX]: (await feed(FEED.alcxEth, 18, BLOCK)).times(eth),
      [T.KP3R]: (await feed(FEED.kp3rEth, 18, BLOCK)).times(eth),
      [T.SUSHI]: (await feed(FEED.sushiEth, 18, BLOCK)).times(eth),
      [T.SYN]: (await v2Rate(POOL.synWeth, T.SYN, BLOCK)).times(eth),
      [T.THOR]: (await v2Rate(POOL.thorWeth, T.THOR, BLOCK)).times(eth),
      // WETH-FDT 20/80 weighted pool spot price.
      [T.FDT]: decimal(balances[0], 18).div(0.2).div(decimal(balances[1], 18).div(0.8)).times(eth),
      [T.FPIS]: new BigNumber(1).div(fpisPerFrax).times(await feed(FEED.frax, 8, BLOCK)),
    });
  }, 900_000);

  // Before FOX/USD's first answer (13,810,120), FOX prices from FOX-ETH.
  const BEFORE_FOX_FEED = 13_780_800;

  it(`values FOX from the FOX-ETH pair at ${BEFORE_FOX_FEED}`, async () => {
    const { held, records } = await snapshot(BEFORE_FOX_FEED, [T.FOX]);
    expect(held.length).toBeGreaterThan(0);
    const eth = await feed(FEED.eth, 8, BEFORE_FOX_FEED);
    expectRecords(held, records, {
      [T.FOX]: (await v2Rate(POOL.foxEth, T.FOX, BEFORE_FOX_FEED)).times(eth),
    });
  }, 900_000);
});
