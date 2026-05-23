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

// End-to-end verification via real HyperSync. Confirms the exact-block
// `_gte: X, _lte: X` filter combined with a sentinel-gated body fires on
// both Arbitrum (event-bearing startBlock) and Berachain (quiet startBlock
// — first treasury Transfer was 541K blocks later at 1,340,669).
//
// The seemingly-broken behaviour we originally observed (only Arbitrum
// produced `-backfill` rows) was a visibility artifact: the old code
// skipped writing TokenBalanceUpdate for zero-balance pairs, so chains
// where every wallet had a zero pre-window balance left no trace. The
// sentinel entity (added alongside this test) makes those silent fires
// observable; both tests assert one BackfillSentinel row is written.

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
