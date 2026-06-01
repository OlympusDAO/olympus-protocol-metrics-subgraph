import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function serviceBlock(compose: string, serviceName: string): string {
  const match = compose.match(new RegExp(`\\n  ${serviceName}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:\\n|\\nnetworks:\\n|$)`));
  if (match === null) {
    throw new Error(`Missing service ${serviceName}`);
  }
  return match[1];
}

describe("local Docker Compose stack", () => {
  test("defines a full local stack", () => {
    expect(existsSync("docker-compose.yml")).toBe(true);
    const compose = readFileSync("docker-compose.yml", "utf8");

    for (const service of [
      "postgres",
      "hasura",
      "minio",
      "minio-init",
      "indexer",
      "metrics-api",
      "metrics-publisher",
    ]) {
      expect(compose).toContain(`  ${service}:`);
    }
  });

  test("keeps non-API services internal by default", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    for (const service of ["postgres", "hasura", "minio", "indexer", "metrics-publisher"]) {
      expect(serviceBlock(compose, service), service).not.toContain("ports:");
    }

    const api = serviceBlock(compose, "metrics-api");
    expect(api).toContain("ports:");
    expect(api).toContain("127.0.0.1:${METRICS_API_PORT:-3000}:3000");
  });

  test("runs publisher as an explicit profile and documents local usage", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const doc = readFileSync("docs/local-compose.md", "utf8");

    expect(serviceBlock(compose, "metrics-publisher")).toContain("publish");
    expect(doc).toContain("only `metrics-api` is reachable from the host");
    expect(doc).toContain("docker compose --profile publish run --rm metrics-publisher");
  });
});
