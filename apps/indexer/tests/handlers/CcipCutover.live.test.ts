import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

import "../../src/handlers/ArbitrumLending";
import "../../src/handlers/ArbitrumStaking";
import "../../src/handlers/BalancerPools";
import "../../src/handlers/BlockHandlers";
import "../../src/handlers/BlvSupply";
import "../../src/handlers/BondManager";
import "../../src/handlers/BophadesKernel";
import "../../src/handlers/CoolerLoans";
import "../../src/handlers/Erc20Transfers";
import "../../src/handlers/GnosisAuctions";
import "../../src/handlers/GnosisEasyAuction";
import "../../src/handlers/KodiakLps";
import "../../src/handlers/Lender";
import "../../src/handlers/MigrationOffset";
import "../../src/handlers/SOhmV3";
import "../../src/handlers/Staking";
import "../../src/handlers/Univ2Pools";
import "../../src/handlers/Univ3NftPol";
import "../../src/handlers/Univ3Pools";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";

const hasApiToken = Boolean(process.env.ENVIO_API_TOKEN);

// The CCIP pool was funded in Ethereum block 26,245,881 (2026-10-22T04:51:47Z).
// Each L2 runs from its last snapshot before the cutover to its first snapshot
// after it, under the real runtime and chain config. The window starts long
// after the chain's start block, so OHM total supply (and the Base DAO MS
// balance) is seeded with the onchain value, unchanged across the window.
const L2S = [
  { chainId: 42161, before: 517_023_600, after: 517_138_800, supply: 14_860_698_911_844n },
  { chainId: 8453, before: 52_920_027, after: 52_934_427, supply: 45_180_488_364_365n },
  { chainId: 80094, before: 27_813_881, after: 27_828_798, supply: 70_679_728_717_484n },
] as const;
const BASE_DAO_MS = addr("0x18a390bd45bcc92652b9a91ad51aed7f1c1358f5");
const BASE_DAO_MS_OHM = 384_631_649_028n;

type SupplyRow = { block: bigint; type: string; sourceAddress?: string; supplyBalance: unknown };

describe.skipIf(!hasApiToken)("CCIP cutover — live snapshots around the pool funding", () => {
  for (const { chainId, before, after, supply } of L2S) {
    it(`chain ${chainId}: total supply counts before the cutover and stops after`, async () => {
      const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
      const cutover = config.ohmTotalSupplyEndBlock as number;
      expect(before).toBeLessThan(cutover);
      expect(after).toBeGreaterThanOrEqual(cutover);

      const indexer = createTestIndexer();
      const ohm = addr(config.ohmToken);
      indexer.Erc20Supply.set({
        id: `${chainId}-${ohm}`,
        chainId,
        tokenAddress: ohm,
        totalSupply: supply,
        updatedAtBlock: BigInt(before - 1),
      });
      if (chainId === 8453) {
        indexer.TokenBalance.set({
          id: `${chainId}-${ohm}-${BASE_DAO_MS}`,
          chainId,
          tokenAddress: ohm,
          walletAddress: BASE_DAO_MS,
          balance: BASE_DAO_MS_OHM,
          updatedAtBlock: BigInt(before - 1),
        });
      }

      const result = await indexer.process({
        chains: { [chainId]: { startBlock: before, endBlock: after } },
      });
      const changesAt = (block: number) =>
        result.changes.filter((change) => change.block === block);
      const supplyAt = (block: number) =>
        changesAt(block).flatMap(
          (change) => (change.TokenSupply?.sets ?? []) as unknown as SupplyRow[],
        );
      const totalSupplyAt = (block: number) =>
        supplyAt(block).filter((row) => row.type === "Total Supply");

      // The snapshot ran at both blocks.
      for (const block of [before, after]) {
        expect(
          changesAt(block).flatMap((change) => change.ChainMetricValues?.sets ?? []),
        ).toHaveLength(1);
      }
      expect(totalSupplyAt(before)).toHaveLength(1);
      expect(totalSupplyAt(after)).toHaveLength(0);

      if (chainId === 8453) {
        // Protocol-owned OHM is still deducted after the cutover.
        const treasury = supplyAt(after).find(
          (row) => row.type === "Treasury" && row.sourceAddress === BASE_DAO_MS,
        );
        expect(String(treasury?.supplyBalance)).toBe("-384.631649028");
        expect(supplyAt(after).some((row) => row.type === "Liquidity")).toBe(true);
      }
    }, 900_000);
  }
});
