import { expect, test } from "vitest";
import images from "../../.railway/images.json";
import { benchmarkPostgresImage } from "../../scripts/benchmark-images.mjs";

test("benchmark receipts retain the actual historical or current PostgreSQL reference and ID", () => {
  const current = images.local["postgres-local"];
  const historical = "docker.io/library/postgres:17-alpine";
  for (const [reference, id] of [
    [historical, "sha256:old17"],
    [current, "sha256:fresh18"],
  ]) {
    const selected = benchmarkPostgresImage({ [reference]: id }, current);
    expect({ [selected.reference]: selected.id }).toEqual({ [reference]: id });
  }
  expect(() => benchmarkPostgresImage({}, current)).toThrow(
    "Baseline has no PostgreSQL image identity",
  );
});
