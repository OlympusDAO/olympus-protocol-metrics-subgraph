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
import { addr } from "../../src/snapshot/math";

// Needs HyperSync (ENVIO_API_TOKEN) and an Ethereum archive RPC; skipped
// without them, never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const TREASURY_V2 = addr("0x31f8cc382c9898b273eff4e0b7626a6987c846e8");
const ONSEN = addr("0x0316508a1b5abf1CAe42912Dc2C8B9774b682fFC");
const MASTERCHEF = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";
// Pool, label, non-OHM token's Chainlink USD feed, its decimals, Onsen pid.
const POOLS = [
  {
    lp: addr("0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c"),
    label: "SushiSwap OHM V1-DAI Liquidity Pool",
    feed: "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9",
    decimals: 18,
    pid: 185,
  },
  {
    lp: addr("0xfffae4a0f4ac251f4705717cd24cadccc9f33e06"),
    label: "SushiSwap OHM V1-ETH Liquidity Pool",
    feed: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
    decimals: 18,
  },
  {
    lp: addr("0x2dce0dda1c2f98e0f171de8333c3c6fe1bbf4877"),
    label: "Uniswap V2 OHM V1-FRAX Liquidity Pool",
    feed: "0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd",
    decimals: 18,
  },
  {
    lp: addr("0xfdf12d1f85b5082877a6e070524f50f6c84faa6b"),
    label: "SushiSwap OHM V1-LUSD Liquidity Pool",
    feed: "0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0",
    decimals: 18,
    pid: 323,
  },
];
const ABI = parseAbi([
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function latestAnswer() view returns (int256)",
  "function userInfo(uint256, address) view returns (uint256, uint256)",
]);
// The last snapshot before the v2 launch: Treasury V2 holds all four v1 LPs
// and the Onsen allocator has OHM-DAI and OHM-LUSD SLP staked.
const BLOCK = 13_780_800;

type Row = Record<string, unknown>;

describe.skipIf(!canRun)("OHM v1 POL — live, against the pools and holders", () => {
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
    }) as Promise<unknown>;

  it(`values the four v1 pools and their OHM at ${BLOCK}`, async () => {
    // Seed reserves, LP supply and Treasury V2's LP from the block before; the
    // runtime then applies the snapshot block's own events.
    const indexer = createTestIndexer();
    for (const pool of POOLS) {
      const [reserve0, reserve1] = (await read(pool.lp, "getReserves", BLOCK - 1)) as bigint[];
      indexer.Univ2PoolState.set({
        id: `1-${pool.lp}`,
        chainId: 1,
        poolAddress: pool.lp,
        reserve0,
        reserve1,
        updatedAtBlock: BigInt(BLOCK - 1),
      });
      indexer.Erc20Supply.set({
        id: `1-${pool.lp}`,
        chainId: 1,
        tokenAddress: pool.lp,
        totalSupply: (await read(pool.lp, "totalSupply", BLOCK - 1)) as bigint,
        updatedAtBlock: BigInt(BLOCK - 1),
      });
      indexer.TokenBalance.set({
        id: `1-${pool.lp}-${TREASURY_V2}`,
        chainId: 1,
        tokenAddress: pool.lp,
        walletAddress: TREASURY_V2,
        balance: (await read(pool.lp, "balanceOf", BLOCK - 1, [TREASURY_V2])) as bigint,
        updatedAtBlock: BigInt(BLOCK - 1),
      });
    }

    const result = await indexer.process({ chains: { 1: { startBlock: BLOCK, endBlock: BLOCK } } });
    const at = (entity: "TokenRecord" | "TokenSupply") =>
      result.changes
        .filter((change) => change.block === BLOCK)
        .flatMap((change) => (change[entity]?.sets ?? []) as unknown as Row[]);
    const records = at("TokenRecord");
    const supplies = at("TokenSupply");
    expect(records.length).toBeGreaterThan(0);

    for (const pool of POOLS) {
      const [reserve0, reserve1] = (await read(pool.lp, "getReserves", BLOCK)) as bigint[];
      const supply = new BigNumber(
        ((await read(pool.lp, "totalSupply", BLOCK)) as bigint).toString(),
      );
      const nonOhmUsd = new BigNumber(
        ((await read(pool.feed, "latestAnswer", BLOCK)) as bigint).toString(),
      ).div(1e8);
      const ohmReserve = new BigNumber(reserve0.toString()).div(1e9); // OHM v1 is token0 in all four
      const otherReserve = new BigNumber(reserve1.toString()).div(
        new BigNumber(10).pow(pool.decimals),
      );
      const holders: [string, string, bigint][] = [
        [
          TREASURY_V2,
          pool.label,
          (await read(pool.lp, "balanceOf", BLOCK, [TREASURY_V2])) as bigint,
        ],
      ];
      if (pool.pid !== undefined) {
        const [staked] = (await read(MASTERCHEF, "userInfo", BLOCK, [
          BigInt(pool.pid),
          ONSEN,
        ])) as bigint[];
        holders.push([ONSEN, `${pool.label} - Staked in Onsen`, staked]);
      }

      let lpHeld = new BigNumber(0);
      for (const [holder, label, raw] of holders) {
        const balance = new BigNumber(raw.toString()).div(1e18);
        lpHeld = lpHeld.plus(balance);
        const row = records.find((r) => r.sourceAddress === holder && r.token === label);
        expect(row, `${label} at ${holder}`).toBeDefined();
        expect(new BigNumber(String(row?.balance)).toFixed(18)).toBe(balance.toFixed(18));
        // Liquid backing counts only the non-OHM side.
        const expected = otherReserve.times(nonOhmUsd).times(balance).div(supply.div(1e18));
        const indexed = new BigNumber(String(row?.valueExcludingOhm));
        process.stderr.write(
          `${label} @${holder.slice(0, 8)}: lp ${balance.toFixed(4)} valueExcludingOhm ${indexed.toFixed(2)} (chain ${expected.toFixed(2)}) value ${new BigNumber(String(row?.value)).toFixed(2)}\n`,
        );
        expect(indexed.minus(expected).abs().div(expected).toNumber()).toBeLessThan(1e-9);
      }

      // The OHM in the protocol's LP leaves backed and floating supply.
      const liquidity = supplies
        .filter((s) => s.type === "Liquidity" && s.poolAddress === pool.lp)
        .reduce((sum, s) => sum.plus(new BigNumber(String(s.balance))), new BigNumber(0));
      const expectedOhm = ohmReserve.times(lpHeld).div(supply.div(1e18));
      expect(liquidity.minus(expectedOhm).abs().toNumber()).toBeLessThan(1e-6);
    }
  }, 900_000);
});
