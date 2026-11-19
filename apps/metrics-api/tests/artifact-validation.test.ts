import { describe, expect, test } from "vitest";
import { ALL_CHAIN_IDS, buildDailyMetric } from "../../../packages/metrics-artifacts/src";
import { createArtifactReaderFromEnv } from "../src/artifact-store";
import {
  dailyMetricsSchema,
  manifestSchema,
  treasuryAssetsSchema,
} from "../src/artifact-validation";

describe("artifact runtime contracts", () => {
  test("accepts the real publisher metric shape, including zero chain states", () => {
    const metric = buildDailyMetric({
      date: "2026-06-01",
      chainValues: {},
      chainsIndexed: ALL_CHAIN_IDS,
      generatedAt: "2026-06-01T12:00:00.000Z",
    });
    expect(dailyMetricsSchema.parse([metric])).toEqual([metric]);
    expect(dailyMetricsSchema.safeParse([{ ...metric, ohmPrice: "12" }]).success).toBe(false);
    expect(dailyMetricsSchema.safeParse([{ ...metric, blocks: null }]).success).toBe(false);
    expect(dailyMetricsSchema.safeParse([{ ...metric, date: "2026-02-30" }]).success).toBe(false);
    expect(
      dailyMetricsSchema.safeParse([{ ...metric, treasuryLiquidBacking: Infinity }]).success,
    ).toBe(false);
  });
  test("rejects wrong artifact collections and invalid manifest bounds/metadata", () => {
    expect(treasuryAssetsSchema.safeParse({ data: [] }).success).toBe(false);
    expect(treasuryAssetsSchema.safeParse([{ date: "2026-06-01" }]).success).toBe(false);
    const manifest = {
      schemaVersion: "2",
      generatedAt: "2026-06-01T12:00:00.000Z",
      earliestDate: "2026-06-01",
      latestDate: "2026-06-02",
      indexingProgress: { chains: {} },
    };
    expect(manifestSchema.parse(manifest)).toEqual(manifest);
    expect(manifestSchema.safeParse({ ...manifest, latestDate: "2026-05-01" }).success).toBe(false);
    expect(
      manifestSchema.safeParse({
        ...manifest,
        artifacts: { shard: { sha256: "wrong", byteLength: -1, rowCount: 1 } },
      }).success,
    ).toBe(false);
    expect(
      manifestSchema.safeParse({
        ...manifest,
        indexingProgress: { chains: { Ethereum: { block: "wrong" } } },
      }).success,
    ).toBe(false);
  });
  test.each(["0", "-1", "NaN", "1.5", "9007199254740992"])(
    "rejects invalid configured read limits: %s",
    (limit) => {
      expect(() =>
        createArtifactReaderFromEnv({
          ARTIFACT_BUCKET: "fixture",
          ARTIFACT_ENDPOINT: "http://127.0.0.1",
          ARTIFACT_REGION: "us-east-1",
          ARTIFACT_ACCESS_KEY_ID: "fixture",
          ARTIFACT_SECRET_ACCESS_KEY: "fixture",
          METRICS_API_ARTIFACT_MAX_BYTES: limit,
        }),
      ).toThrow(/positive safe integer/);
    },
  );
});
