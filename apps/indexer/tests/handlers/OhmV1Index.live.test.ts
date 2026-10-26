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

// Needs HyperSync (ENVIO_API_TOKEN) and an Ethereum archive RPC; skipped
// without them, never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const SOHM_V1 = "0x31932e6e45012476ba3a3a4953cba62aee77fbbe";
const SOHM_V2 = "0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f";
const STAKING_V1 = "0x0822f3c03dcc24d200aff33493dc08d0e1f274a2";
const STAKING_V2 = "0xfd31c7d00ca47653c6ce64af53c1571f9c36566a";
const ABI = parseAbi([
  "function index() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function circulatingSupply() view returns (uint256)",
  "function ohmToDistributeNextEpoch() view returns (uint256)",
  "function epoch() view returns (uint256, uint256, uint256, uint256)",
]);

// Snapshot blocks (12,000,000 + k × 2,400): before sOHM v2 rebased, its
// first days (v1 and v2 both staked), mid-era, and just before the v2 launch.
const SAMPLES = [12_600_000, 12_640_800, 13_000_800, 13_780_800];

describe.skipIf(!canRun)("index and staked OHM before sOHM v3 — live", () => {
  // Built on first use: the describe body runs even when skipped.
  let rpc: ReturnType<typeof createPublicClient> | undefined;
  const client = () => {
    rpc ??= createPublicClient({ transport: http(RPC_URL) });
    return rpc;
  };
  async function read(address: string, functionName: string, block: number): Promise<unknown> {
    try {
      return await client().readContract({
        address: getAddress(address),
        abi: ABI,
        functionName: functionName as never,
        blockNumber: BigInt(block),
      });
    } catch {
      return 0n;
    }
  }

  for (const block of SAMPLES) {
    it(`matches the sOHM contracts at ${block}`, async () => {
      const v2Index = (await read(SOHM_V2, "index", block)) as bigint;
      const v1Circ = (await read(SOHM_V1, "circulatingSupply", block)) as bigint;
      const expectedIndex =
        v2Index > 0n ? v2Index : ((await read(SOHM_V1, "totalSupply", block)) as bigint) / 500_000n;
      const expectedStaked =
        v2Index > 0n
          ? v1Circ + ((await read(SOHM_V2, "circulatingSupply", block)) as bigint)
          : v1Circ;
      const d1 = (await read(STAKING_V1, "ohmToDistributeNextEpoch", block)) as bigint;
      const epoch = (await read(STAKING_V2, "epoch", block)) as readonly bigint[] | bigint;
      const d2 = block > 12_622_679 && Array.isArray(epoch) ? (epoch[3] as bigint) : 0n;

      const result = await createTestIndexer().process({
        chains: { 1: { startBlock: block, endBlock: block } },
      });
      const rows = result.changes
        .filter((change) => change.block === block)
        .flatMap(
          (change) =>
            (change.GlobalMetricSnapshot?.sets ?? []) as unknown as Array<Record<string, unknown>>,
        );
      expect(rows).toHaveLength(1);
      const row = rows[0];
      const index = new BigNumber(String(row.ohmIndex));
      const staked = new BigNumber(String(row.sOhmCirculatingSupply));
      const apy = new BigNumber(String(row.ohmApy));
      process.stderr.write(
        `block ${block}: index ${index.toFixed()} staked ${staked.toFixed()} apy ${apy.toFixed(0)}%\n`,
      );

      expect(index.toFixed(9)).toBe(new BigNumber(expectedIndex.toString()).div(1e9).toFixed(9));
      expect(staked.toFixed(9)).toBe(new BigNumber(expectedStaked.toString()).div(1e9).toFixed(9));
      expect(index.gt(1)).toBe(true);
      const rebase = Number(d1 + d2) / Number(expectedStaked);
      expect(apy.toNumber()).toBeCloseTo(((1 + rebase) ** 1095 - 1) * 100, -2);
    }, 900_000);
  }
});
