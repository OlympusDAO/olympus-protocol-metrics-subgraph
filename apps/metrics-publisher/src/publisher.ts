import { monthKeysForRange, resolveDateRange, type Manifest } from "../../../packages/metrics-artifacts/src";

export type PublishMode = "full" | "incremental";

export type PublishResult = {
  manifestPublishedLast: boolean;
  writtenKeys: string[];
};

const DEFAULT_MANIFEST: Manifest = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-06-01T08:15:00.000Z",
  earliestDate: "2021-04-29",
  latestDate: "2026-06-01",
};

export async function publishMetricsArtifacts(input: {
  mode: PublishMode;
  lookbackDays?: number;
  startDate?: string;
  manifest?: Manifest;
}): Promise<PublishResult> {
  const manifest = input.manifest ?? DEFAULT_MANIFEST;
  const startDate = input.startDate ?? manifest.latestDate;
  const range = resolveDateRange({
    start: startDate,
    manifest,
    enforceMaxRange: false,
  });
  const writtenKeys = monthKeysForRange(range).flatMap((month) => [
    `v2/metrics/daily/${month}.json`,
    `v2/treasury-assets/daily/${month}.json`,
    `v2/ohm-supply/daily/${month}.json`,
  ]);

  writtenKeys.push("v2/manifest.json");

  return {
    manifestPublishedLast: writtenKeys.at(-1) === "v2/manifest.json",
    writtenKeys,
  };
}
