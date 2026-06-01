import { describe, expect, test } from "vitest";

import { publishMetricsArtifacts } from "../../apps/metrics-publisher/src/publisher";

describe("metrics publisher", () => {
  test("publishes manifest last after writing metric, treasury asset, and OHM supply shards", async () => {
    const result = await publishMetricsArtifacts({ mode: "full", startDate: "2026-05-01" });

    expect(result.manifestPublishedLast).toBe(true);
    expect(result.writtenKeys).toContain("v2/metrics/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/treasury-assets/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/ohm-supply/daily/2026-05.json");
    expect(result.writtenKeys.at(-1)).toBe("v2/manifest.json");
  });
});
