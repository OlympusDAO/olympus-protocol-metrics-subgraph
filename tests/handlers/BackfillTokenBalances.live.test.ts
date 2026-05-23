import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

// Importing the module is what registers the `indexer.onBlock` handler
// (top-level side effect at the bottom of BackfillTokenBalances.ts).
import "../../src/handlers/BackfillTokenBalances";

// `createTestIndexer` hits live HyperSync, which requires ENVIO_API_TOKEN.
// CI doesn't ship a token (no secret needed for the suite to pass), so we
// skip this whole file when the env var is missing. Devs running locally
// pick up the token from .env via the test runner's process env.
const hasApiToken = Boolean(process.env.ENVIO_API_TOKEN);

// End-to-end verification via real HyperSync. Three cases:
//
//  - Arbitrum: handler still fires on the configured startBlock (regression
//    guard — the previous exact-block filter worked there and the new
//    wide filter must too).
//
//  - Berachain: configured startBlock 799,194 has no qualifying event; the
//    first treasury Transfer on the deployed indexer was at block 1,340,669
//    (~541K blocks later). Under the OLD exact-block filter this never
//    fired. Under the new wide filter the handler should fire on the first
//    delivered block in [799_194, 1_341_000] and write exactly one
//    BackfillSentinel row.

describe.skipIf(!hasApiToken)("BackfillTokenBalances — live HyperSync (post-fix)", () => {
  it("Arbitrum: fires on the configured startBlock", async () => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: {
        42161: { startBlock: 10_950_000, endBlock: 10_950_500 },
      },
    });
    const backfillRows = result.changes.flatMap(
      (change) =>
        (change.TokenBalanceUpdate?.sets ?? []).filter((row) =>
          String((row as { id: string }).id).endsWith("-backfill"),
        ),
    );
    const sentinelRows = result.changes.flatMap(
      (change) => change.BackfillSentinel?.sets ?? [],
    );
    expect(backfillRows.length).toBeGreaterThan(0);
    expect(sentinelRows).toHaveLength(1);
    expect((sentinelRows[0] as { chainId: number }).chainId).toBe(42161);
  }, 120_000);

  it("Berachain: fires within [startBlock, first-known-event] window", async () => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: {
        80094: { startBlock: 799_194, endBlock: 1_341_000 },
      },
    });
    const sentinelRows = result.changes.flatMap(
      (change) => change.BackfillSentinel?.sets ?? [],
    );
    // The fix proves itself: sentinel exists ⇒ handler fired exactly once.
    // (Berachain may have zero non-zero pre-window balances, so we don't
    // assert on TokenBalanceUpdate-backfill row count — only on the
    // sentinel that proves the body executed.)
    expect(sentinelRows).toHaveLength(1);
    const sentinel = sentinelRows[0] as {
      chainId: number;
      firedAtBlock: bigint;
      seededAtBlock: bigint;
    };
    expect(sentinel.chainId).toBe(80094);
    expect(sentinel.firedAtBlock).toBeGreaterThanOrEqual(799_194n);
    expect(sentinel.seededAtBlock).toBe(799_193n); // startBlock - 1
  }, 300_000);
});
