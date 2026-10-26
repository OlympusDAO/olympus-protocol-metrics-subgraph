import { describe, expect, test } from "vitest";

import { requiredChainsForComplete } from "../../apps/indexer/src/snapshot/global";
import { requiredChainIdsForComplete } from "../../packages/metrics-artifacts/src/legacy-shape";

// The indexer writes crossChainComplete; the publisher and API recompute it
// from chainsIndexed. The two copies of the rule must agree on every date.
describe("cross-chain completeness rule", () => {
  test.each(["2021-03-23", "2021-12-26", "2022-04-30", "2022-05-01", "2026-10-26"])(
    "the indexer and the artifacts package require the same chains on %s",
    (date) => {
      expect([...requiredChainsForComplete(date)].sort()).toEqual(
        [...requiredChainIdsForComplete(date)].sort(),
      );
    },
  );
});
