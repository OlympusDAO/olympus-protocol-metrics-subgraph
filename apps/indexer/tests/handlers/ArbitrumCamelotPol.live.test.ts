import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

// Register every module that attaches handlers so createTestIndexer runs the
// real two-pass preload+processing runtime, as in BerachainPol.live.test.ts.
import "../../src/handlers/BackfillTokenBalances";
import "../../src/handlers/BalancerPools";
import "../../src/handlers/BlockHandlers";
import "../../src/handlers/BondManager";
import "../../src/handlers/BophadesKernel";
import "../../src/handlers/Erc20Transfers";
import "../../src/handlers/GnosisEasyAuction";
import "../../src/handlers/KodiakLps";
import "../../src/handlers/Lender";
import "../../src/handlers/MellowVault";
import "../../src/handlers/SOhmV3";
import "../../src/handlers/Staking";
import "../../src/handlers/Univ2Pools";
import "../../src/handlers/Univ3Pools";

const hasApiToken = Boolean(process.env.ENVIO_API_TOKEN);

// The Camelot OHM-wETH pair is deployed and first minted at 190,428,287
// (archive eth_getCode / totalSupply), so the LP supply, treasury balance and
// pool reserves all build from events inside this range. 209,554,800
// (= 10,950,000 + 1724 × 115,200) is the first production snapshot with a
// Camelot POL row, published pre-fix as value = valueExcludingOhm =
// $111,488.18, multiplier 1.
const CAMELOT_MINT_BLOCK = 190_428_287;
const SNAPSHOT_BLOCK = 209_554_800;

// Archive reads at SNAPSHOT_BLOCK: reserves 36.997959 wETH / 9,343.3108 OHM,
// Chainlink ETH/USD 3,013.36029738, and Cross-Chain Arbitrum holds the whole
// LP supply. That is $111,488.18 per side, $222,976.36 in total.
const ONCHAIN_WETH_SIDE = 111_488.18;
const ONCHAIN_TOTAL = 222_976.36;

describe.skipIf(!hasApiToken)("Arbitrum Camelot OHM-wETH POL — live two-pass runtime", () => {
  it("values the OHM side of the Camelot POL (multiplier ~0.5)", async () => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: {
        42161: { startBlock: CAMELOT_MINT_BLOCK, endBlock: SNAPSHOT_BLOCK },
      },
    });

    const camelotRows = result.changes.flatMap((change) =>
      ((change.TokenRecord?.sets ?? []) as unknown as Array<Record<string, unknown>>).filter(
        (row) =>
          String(row.token ?? "").includes("Camelot") &&
          BigInt(String(row.block)) === BigInt(SNAPSHOT_BLOCK),
      ),
    );

    for (const r of camelotRows) {
      // eslint-disable-next-line no-console
      console.log(
        `Camelot row: block=${String(r.block)} balance=${String(r.balance)} rate=${String(r.rate)} value=${String(r.value)} valueExcludingOhm=${String(r.valueExcludingOhm)} multiplier=${String(r.multiplier)}`,
      );
    }

    // Don't assert balance or rate: under createTestIndexer the get-then-add
    // ledgers (TokenBalance, Erc20Supply) see their own preload-pass write, so
    // both come out doubled (production has the real 0.0184 LP). Value and the
    // multiplier are balance × totalValue / supply, so the doubling cancels.
    expect(camelotRows).toHaveLength(1);
    const [row] = camelotRows;
    const value = Number(row.value);
    const valueExcludingOhm = Number(row.valueExcludingOhm);

    expect(Number(row.multiplier)).toBeCloseTo(0.5, 6);
    expect(value).toBeCloseTo(ONCHAIN_TOTAL, 1);
    // The OHM side is never backing, so valueExcludingOhm stays the wETH leg.
    expect(valueExcludingOhm).toBeCloseTo(ONCHAIN_WETH_SIDE, 1);
    // ~19M blocks and ~165 snapshots of archive reads; slower than Berachain's.
  }, 3_600_000);
});
