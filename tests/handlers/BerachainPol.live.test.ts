import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

// Register the full handler set (Envio auto-loads src/handlers in prod; here
// we import every module so createTestIndexer runs the real two-pass
// preload+processing runtime — the only way to reproduce the Berachain
// OHM-HONEY POL pricing bug, which never manifests in single-pass unit tests).
import "../../src/handlers/ArbitrumLending";
import "../../src/handlers/ArbitrumStaking";
import "../../src/handlers/BackfillTokenBalances";
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

const hasApiToken = Boolean(process.env.ENVIO_API_TOKEN);

// Berachain snapshot fires at startBlock(799194) + k*14917. The earliest
// Beradrome Kodiak OHM-HONEY POL row in production is at block 1,082,617
// (= 799194 + 19*14917), with the buggy multiplier=1. Processing from chain
// start through that block builds the Kodiak pool state (pool created at
// 969,521) and the DAO's Beradrome position, then fires the snapshot under
// the real preload+processing runtime.
describe.skipIf(!hasApiToken)("Berachain OHM-HONEY POL pricing — live two-pass runtime", () => {
  it("prices the OHM side of the Beradrome POL (multiplier < 1)", async () => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: {
        80094: { startBlock: 799_194, endBlock: 1_082_617 },
      },
    });

    const beradromeRows = result.changes.flatMap((change) =>
      ((change.TokenRecord?.sets ?? []) as unknown as Array<Record<string, unknown>>).filter(
        (row) => String(row.token ?? "").includes("Beradrome"),
      ),
    );

    // Surface what we got for diagnosis.
    for (const r of beradromeRows) {
      // eslint-disable-next-line no-console
      console.log(
        `Beradrome row: value=${String(r.value)} valueExcludingOhm=${String(r.valueExcludingOhm)} multiplier=${String(r.multiplier)}`,
      );
    }

    expect(beradromeRows.length).toBeGreaterThan(0);
    // The fix target: OHM contributes real value, so multiplier is in (0,1).
    for (const r of beradromeRows) {
      expect(Number(r.multiplier)).toBeLessThan(1);
      expect(Number(r.multiplier)).toBeGreaterThan(0);
    }
  }, 600_000);
});
