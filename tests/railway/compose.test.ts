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

  test("orders dependent services with health and completion gates", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    expect(serviceBlock(compose, "minio")).toContain("/minio/health/ready");
    expect(serviceBlock(compose, "minio-init")).toContain("condition: service_healthy");
    expect(serviceBlock(compose, "metrics-api")).toContain("condition: service_completed_successfully");
    expect(serviceBlock(compose, "metrics-publisher")).toContain("condition: service_completed_successfully");
    expect(serviceBlock(compose, "indexer")).toContain("condition: service_healthy");
    expect(serviceBlock(compose, "indexer")).toContain("hasura:");
  });

  test("includes indexer in the default stack and runs publisher as an explicit profile", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const doc = readFileSync("docs/local-compose.md", "utf8");
    const packageJson = readFileSync("package.json", "utf8");

    expect(serviceBlock(compose, "metrics-publisher")).toContain("publish");
    expect(serviceBlock(compose, "indexer")).not.toContain("profiles:");
    expect(doc).toContain("only `metrics-api` is reachable from the host");
    expect(doc).toContain("docker compose up --build postgres hasura minio minio-init indexer metrics-api");
    expect(doc).toContain("pnpm run compose:publish");
    expect(packageJson).toContain("docker compose up --build postgres hasura minio minio-init indexer metrics-api");
    expect(packageJson).toContain('"compose:publish": "docker compose --profile publish run --rm metrics-publisher"');
  });

  test("documents and wires stack variables without unsupported Envio env knobs", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const doc = readFileSync("docs/local-compose.md", "utf8");
    const sample = readFileSync(".env.compose.sample", "utf8");
    const indexer = serviceBlock(compose, "indexer");

    for (const variable of [
      "ENVIO_API_TOKEN",
      "ENVIO_PG_HOST",
      "ENVIO_ETHEREUM_RPC_URL",
      "ENVIO_ARBITRUM_RPC_URL",
      "INDEXER_HASURA_GRAPHQL_ENDPOINT",
      "ENVIO_BASE_RPC_URL",
      "ENVIO_BERACHAIN_RPC_URL",
      "ENVIO_POLYGON_RPC_URL",
      "ENVIO_FANTOM_RPC_URL",
    ]) {
      expect(indexer).toContain(variable);
      expect(sample).toContain(variable);
    }

    expect(compose).not.toContain("FALLBACK_RPC_URLS");
    expect(compose).not.toContain("REQUESTS_PER_SECOND");
    expect(compose).not.toContain("ENVIO_PG_SSL_MODE: ${ENVIO_PG_SSL_MODE:-disable}");
    expect(compose).toContain("ENVIO_PG_SSL_MODE: ${ENVIO_PG_SSL_MODE:-false}");
    expect(compose).toContain("ENVIO_API_TOKEN: ${ENVIO_API_TOKEN:?");
    expect(compose).toContain("HASURA_GRAPHQL_ENDPOINT: ${INDEXER_HASURA_GRAPHQL_ENDPOINT:-http://hasura:8080/v1/metadata}");
    expect(compose).toContain("MINIO_ROOT_USER: ${MINIO_ROOT_USER:-metricsadmin}");
    expect(doc).toContain("It does not consume a");
    expect(doc).toContain("requests_per_second");
    expect(doc).toContain("ENVIO_API_TOKEN` is required");
    expect(doc).toContain("fails fast if the token is missing");
    expect(doc).toContain("fallbacks, not as the primary sync source");
  });
});
