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

// Needs HyperSync (ENVIO_API_TOKEN) for the runtime and an Ethereum archive
// RPC for the snapshot reads and the oracle. Without either it is skipped,
// never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
// The v1 CirculatingSupply oracle, deployed at 12,235,926.
const ORACLE = "0x0EFFf9199Aa1Ac3C3E34E957567C1BE8bF295034";
const ORACLE_BLOCK = 12_235_926;
const ORACLE_ABI = parseAbi([
  "function OHMCirculatingSupply() view returns (uint256)",
  "function nonCirculatingOHMAddresses(uint256) view returns (address)",
]);
const ERC20_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

// Ethereum snapshots run every 2,400 blocks from 12,000,000. Samples span the
// v1 era: before the oracle existed, its first weeks, Staking Distributor V1's
// peak, the v1 staking migration, mid-era, and the last snapshot before the
// first OHM v2 mint (13,805,112).
const SAMPLES = [12_098_400, 12_240_000, 12_398_400, 12_640_800, 13_200_000, 13_804_800];

describe.skipIf(!canRun)("OHM v1 circulating supply — live, against the v1 oracle", () => {
  const client = createPublicClient({ transport: http(RPC_URL) });
  const read = (
    address: string,
    abi: typeof ERC20_ABI | typeof ORACLE_ABI,
    fn: string,
    block: number,
    args: unknown[] = [],
  ) =>
    client.readContract({
      address: getAddress(address),
      abi,
      functionName: fn as never,
      args: args as never,
      blockNumber: BigInt(block),
    }) as Promise<bigint>;

  async function oracleList(block: number): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; ; i++) {
      try {
        out.push(
          addr(
            (await read(ORACLE, ORACLE_ABI, "nonCirculatingOHMAddresses", block, [
              BigInt(i),
            ])) as unknown as string,
          ),
        );
      } catch {
        return out;
      }
    }
  }

  // The oracle's own formula, OHM.totalSupply() minus the listed balances.
  // Before the oracle existed, the same formula with its first list.
  async function expectedCirculating(block: number): Promise<bigint> {
    if (block >= ORACLE_BLOCK) return read(ORACLE, ORACLE_ABI, "OHMCirculatingSupply", block);
    const list = await oracleList(13_000_000);
    let circulating = await read(OHM_V1, ERC20_ABI, "totalSupply", block);
    for (const wallet of list)
      circulating -= await read(OHM_V1, ERC20_ABI, "balanceOf", block, [wallet]);
    return circulating;
  }

  for (const block of SAMPLES) {
    it(`matches OHMCirculatingSupply() exactly at ${block}`, async () => {
      const [supply, dao, expected] = await Promise.all([
        read(OHM_V1, ERC20_ABI, "totalSupply", block - 1),
        read(OHM_V1, ERC20_ABI, "balanceOf", block - 1, [DAO_WALLET]),
        expectedCirculating(block),
      ]);

      // Seed the event ledgers at block - 1, then run the real runtime over
      // the snapshot block so its events, the exclusion-wallet balanceOf reads
      // and the snapshot all happen as in production. No other protocol wallet
      // holds OHM v1 in the v1 era (archive balanceOf at five sample blocks).
      const indexer = createTestIndexer();
      indexer.Erc20Supply.set({
        id: `1-${OHM_V1}`,
        chainId: 1,
        tokenAddress: OHM_V1,
        totalSupply: supply,
        updatedAtBlock: BigInt(block - 1),
      });
      indexer.TokenBalance.set({
        id: `1-${OHM_V1}-${DAO_WALLET}`,
        chainId: 1,
        tokenAddress: OHM_V1,
        walletAddress: DAO_WALLET,
        balance: dao,
        updatedAtBlock: BigInt(block - 1),
      });
      const result = await indexer.process({
        chains: { 1: { startBlock: block, endBlock: block } },
      });

      const chainValues = result.changes
        .filter((change) => change.block === block)
        .flatMap(
          (change) =>
            (change.ChainMetricValues?.sets ?? []) as unknown as Array<{
              ohmCirculatingSupply: unknown;
            }>,
        );
      // The snapshot ran, so the comparison isn't vacuous.
      expect(chainValues).toHaveLength(1);
      const indexed = new BigNumber(String(chainValues[0].ohmCirculatingSupply));
      const onchain = new BigNumber(expected.toString()).div(1e9);
      process.stderr.write(
        `block ${block}: indexed ${indexed.toFixed()} oracle ${onchain.toFixed()}\n`,
      );
      expect(indexed.gt(0)).toBe(true);
      // Exact, to OHM's 9 decimals.
      expect(indexed.toFixed(9)).toBe(onchain.toFixed(9));
    }, 900_000);
  }
});
