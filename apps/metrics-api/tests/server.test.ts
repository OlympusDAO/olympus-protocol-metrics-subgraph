import { createServer, request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, test } from "vitest";

import { metricsApiConfigFromEnv, metricsApiPortFromEnv } from "../src/config";
import { handleMetricsApiRequest, type MetricsApiConfig } from "../src/server";
import type { Manifest } from "../../../packages/metrics-artifacts/src";

let closeServer: (() => Promise<void>) | undefined;

const testManifest: Manifest = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-06-01T08:15:00.000Z",
  earliestDate: "2021-04-29",
  latestDate: "2026-06-01",
};

const defaultConfig: MetricsApiConfig = {
  maxRangeDays: 366,
  manifest: testManifest,
};

function artifactReader(objects: Record<string, unknown>): MetricsApiConfig["artifactReader"] {
  return {
    async getJson<T>(key: string): Promise<T> {
      if (!(key in objects)) {
        throw new Error(`Missing test artifact: ${key}`);
      }
      return objects[key] as T;
    },
  };
}

async function request(path: string, init?: RequestInit, config: MetricsApiConfig = defaultConfig) {
  const server = createServer((req, res) => {
    void handleMetricsApiRequest(req, res, config);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closeServer = () => new Promise((resolve) => server.close(() => resolve()));
  const port = (server.address() as AddressInfo).port;
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

async function rawRequest(
  path: string,
  init: { method: string; body?: string; headers?: Record<string, string> },
  config: MetricsApiConfig = defaultConfig,
) {
  const server = createServer((req, res) => {
    void handleMetricsApiRequest(req, res, config);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closeServer = () => new Promise((resolve) => server.close(() => resolve()));
  const port = (server.address() as AddressInfo).port;

  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
    rawBody: Buffer;
  }>((resolve, reject) => {
      const clientRequest = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path,
          method: init.method,
          headers:
            init.body === undefined
              ? init.headers
              : {
                  ...init.headers,
                  "content-length": Buffer.byteLength(init.body),
                  "content-type": "application/json",
                },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            const rawBody = Buffer.concat(chunks);
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: rawBody.toString("utf8"),
              rawBody,
            });
          });
        },
      );
      clientRequest.on("error", reject);
      if (init.body !== undefined) {
        clientRequest.write(init.body);
      }
      clientRequest.end();
    });
}

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe("metrics API HTTP behavior", () => {
  test("fails config creation loudly when artifact env variables are missing", () => {
    expect(() =>
      metricsApiConfigFromEnv({
        ARTIFACT_ENDPOINT: "https://r2.example.com",
        ARTIFACT_REGION: "auto",
        ARTIFACT_ACCESS_KEY_ID: "access-key",
        ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
      }),
    ).toThrow("Missing required environment variable ARTIFACT_BUCKET");
  });

  test("rejects invalid port and range env values before creating the server", () => {
    expect(() => metricsApiPortFromEnv({ PORT: "0" })).toThrow("PORT or METRICS_API_PORT");
    expect(() =>
      metricsApiConfigFromEnv({
        METRICS_API_MAX_RANGE_DAYS: "0",
        ARTIFACT_BUCKET: "metrics",
        ARTIFACT_ENDPOINT: "https://r2.example.com",
        ARTIFACT_REGION: "auto",
        ARTIFACT_ACCESS_KEY_ID: "access-key",
        ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
      }),
    ).toThrow("METRICS_API_MAX_RANGE_DAYS");
  });

  test("has /ready but no /healthz", async () => {
    expect((await request("/ready")).status).toBe(200);
    expect((await request("/healthz")).status).toBe(404);
  });

  test("supports CORS preflight", async () => {
    const response = await request("/v2/bounds", { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });

  test("does not return hardcoded bounds when manifest has not been published", async () => {
    const response = await request("/v2/bounds", undefined, { maxRangeDays: 366 });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "manifest_not_published",
        message: expect.stringMatching(/not been published/i),
      },
    });
  });

  test("returns the indexer deployment id in bounds when present", async () => {
    const response = await request("/v2/bounds", undefined, {
      maxRangeDays: 366,
      manifest: {
        ...testManifest,
        indexerDeploymentId: "current-indexer",
        indexingProgress: {
          chains: {
            Arbitrum: { date: "2026-06-01", timestamp: 1780272000, block: 100 },
            Ethereum: { date: "2026-06-01", timestamp: 1780272000, block: 200 },
          },
        },
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        earliestDate: "2021-04-29",
        latestDate: "2026-06-01",
        maxRangeDays: 366,
        indexerDeploymentId: "current-indexer",
        indexingProgress: {
          chains: {
            Arbitrum: { date: "2026-06-01", timestamp: 1780272000, block: 100 },
            Ethereum: { date: "2026-06-01", timestamp: 1780272000, block: 200 },
          },
        },
      },
    });
  });

  test("rejects end date before start date on v2 ranges", async () => {
    const response = await request("/v2/metrics/daily?start=2026-06-01&end=2026-05-20");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_date_range" },
    });
  });

  test("rejects v2 ranges that exceed the documented maximum", async () => {
    const response = await request("/v2/metrics/daily?start=2025-01-01&end=2026-06-01");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_date_range" },
    });
  });

  test("sets cache headers for readiness, bounds, and range routes", async () => {
    expect((await request("/ready")).headers.get("cache-control")).toBe("no-store");
    expect((await request("/v2/bounds")).headers.get("cache-control")).toBe("no-store");
    expect(
      (await request("/v2/metrics/daily?start=2026-05-21")).headers.get("cache-control"),
    ).toBe("public, max-age=3600");
  });

  test("compresses JSON responses when requested", async () => {
    const response = await rawRequest("/v2/metrics/daily?start=2026-05-21", {
      method: "GET",
      headers: { "accept-encoding": "gzip" },
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers.vary).toContain("accept-encoding");
    const body = JSON.parse(gunzipSync(response.rawBody).toString("utf8")) as { data: Array<{ date: string }> };
    expect(body.data[0]).toMatchObject({ date: "2026-05-21" });
  });

  test("does not expose the internal manifest as a public route", async () => {
    const response = await request("/v2/manifest", undefined, {
      maxRangeDays: 366,
      manifest: {
        ...testManifest,
        indexerDeploymentId: "current-indexer",
        artifacts: {
          "v2/deployments/current-indexer/metrics/daily/2026-05.json": {
            sha256: "0".repeat(64),
            byteLength: 2,
            rowCount: 1,
          },
        },
      },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "not_found" },
    });
  });

  test("reads deployment-scoped artifact keys from the internal manifest", async () => {
    const response = await request("/v2/metrics/daily?start=2026-05-21&end=2026-05-21", undefined, {
      maxRangeDays: 366,
      manifest: {
        ...testManifest,
        indexerDeploymentId: "current-indexer",
        artifacts: {
          "v2/metrics/daily/2026-05.json": {
            sha256: "1".repeat(64),
            byteLength: 2,
            rowCount: 1,
          },
          "v2/deployments/current-indexer/metrics/daily/2026-05.json": {
            sha256: "0".repeat(64),
            byteLength: 2,
            rowCount: 1,
          },
        },
      },
      artifactReader: artifactReader({
        "v2/metrics/daily/2026-05.json": [
          {
            date: "2026-05-21",
            chainsIndexed: [],
            chainsMissing: [],
            crossChainComplete: false,
            treasuryMarketValue: 99,
          },
        ],
        "v2/deployments/current-indexer/metrics/daily/2026-05.json": [
          {
            date: "2026-05-21",
            chainsIndexed: [1, 42161],
            chainsMissing: [],
            crossChainComplete: true,
            treasuryMarketValue: 13,
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      date: "2026-05-21",
      chainsIndexed: [1, 42161],
      chainsMissing: [250, 137, 8453, 80094],
      crossChainComplete: true,
      treasuryMarketValue: 13,
    });
  });

  test("marks required chains as missing when no metric rows exist for a requested date", async () => {
    const response = await request("/v2/metrics/daily?start=2026-05-21&end=2026-05-21&includeRecords=true");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      date: "2026-05-21",
      chainsIndexed: [],
      chainsMissing: [42161, 1, 250, 137, 8453, 80094],
      crossChainComplete: false,
      _meta: {
        chainsComplete: [],
        chainsFailed: ["Arbitrum", "Ethereum", "Fantom", "Polygon", "Base", "Berachain"],
      },
    });
    expect(body.data[0].treasuryMarketValueRecords.Arbitrum).toEqual([]);
    expect(body.data[0].treasuryMarketValueRecords.Ethereum).toEqual([]);
    expect(body.data[0].ohmTotalSupplyRecords.Arbitrum).toEqual([]);
    expect(body.data[0].ohmTotalSupplyRecords.Ethereum).toEqual([]);
  });

  test("rejects request bodies on GET and HEAD", async () => {
    const getResponse = await rawRequest("/v2/bounds", { method: "GET", body: "{}" });
    expect(getResponse.status).toBe(400);
    expect(JSON.parse(getResponse.body)).toMatchObject({
      error: { code: "request_body_not_allowed" },
    });

    const headResponse = await rawRequest("/v2/bounds", { method: "HEAD", body: "{}" });
    expect(headResponse.status).toBe(400);
  });

  test("returns deprecated legacy operations and 501 atBlock responses", async () => {
    const latest = await request("/operations/latest/metrics");
    expect(latest.status).toBe(200);
    expect(latest.headers.get("deprecation")).toBe("true");
    expect(await latest.json()).toMatchObject({ data: [{ date: "2026-06-01" }] });

    const atBlock = await request("/operations/atBlock/metrics");
    expect(atBlock.status).toBe(501);
    expect(await atBlock.json()).toMatchObject({
      data: null,
      errors: [{ message: expect.stringMatching(/not supported/i) }],
    });
    expect((await request("/operations/atBlock/tokenRecords")).status).toBe(501);
    expect((await request("/operations/atBlock/tokenSupplies")).status).toBe(501);
    expect((await request("/operations/atBlock/internal/protocolMetrics")).status).toBe(501);
  });

  test("does not expose raw Wundergraph operation names", async () => {
    expect((await request("/operations/tokenRecordsLatest")).status).toBe(404);
    expect((await request("/operations/treasuryEthereum_tokenRecords")).status).toBe(404);
  });

  test("supports documented latest, earliest, and paginated legacy route families", async () => {
    const routes = [
      "/operations/latest/metrics",
      "/operations/earliest/metrics",
      "/operations/paginated/metrics",
      "/operations/latest/tokenRecords",
      "/operations/earliest/tokenRecords",
      "/operations/paginated/tokenRecords",
      "/operations/latest/tokenSupplies",
      "/operations/earliest/tokenSupplies",
      "/operations/paginated/tokenSupplies",
      "/operations/latest/protocolMetrics",
      "/operations/earliest/protocolMetrics",
      "/operations/paginated/protocolMetrics",
    ];

    for (const route of routes) {
      const response = await request(route);
      expect(response.status, route).toBe(200);
      expect(response.headers.get("deprecation"), route).toBe("true");
      expect(await response.json(), route).toHaveProperty("data");
    }
  });

  test("parses legacy wg_variables, accepts ignored controls, and does not apply v2 max ranges", async () => {
    const variables = JSON.stringify({
      startDate: "2025-01-01",
      endDate: "2026-06-01",
      dateOffset: 30,
      ignoreCache: true,
      crossChainDataComplete: true,
      includeRecords: true,
    });
    const encoded = await request(`/operations/paginated/metrics?wg_variables=${encodeURIComponent(variables)}`);
    expect(encoded.status).toBe(200);
    expect(await encoded.json()).toMatchObject({ data: expect.any(Array) });

    const raw = await request(`/operations/paginated/tokenRecords?wg_variables=${variables}`);
    expect(raw.status).toBe(200);
    expect(await raw.json()).toMatchObject({ data: expect.any(Array) });
  });

  test("backs legacy operations with published artifacts", async () => {
    const config: MetricsApiConfig = {
      maxRangeDays: 1,
      manifest: {
        ...testManifest,
        artifacts: {
          "v2/metrics/daily/2026-05.json": { sha256: "0".repeat(64), byteLength: 2, rowCount: 1 },
          "v2/treasury-assets/daily/2026-05.json": { sha256: "1".repeat(64), byteLength: 2, rowCount: 1 },
          "v2/ohm-supply/daily/2026-05.json": { sha256: "2".repeat(64), byteLength: 2, rowCount: 1 },
        },
      },
      artifactReader: artifactReader({
        "v2/metrics/daily/2026-05.json": [
          {
            date: "2026-05-21",
            blocks: { Ethereum: 123 },
            timestamps: { Ethereum: 1_716_249_600 },
            chainsIndexed: [1, 42161],
            chainsMissing: [],
            crossChainComplete: true,
            ohmIndex: 10,
            ohmApy: 0.05,
            ohmPrice: 12,
            gOhmPrice: 120,
            ohmTotalSupply: 1000,
            sOhmCirculatingSupply: 500,
            sOhmTotalValueLocked: 6000,
            treasuryMarketValue: 13,
          },
        ],
        "v2/treasury-assets/daily/2026-05.json": [
          {
            id: "asset-1",
            date: "2026-05-21",
            blockchain: "Ethereum",
            value: 13,
            valueExcludingOhm: 13,
            isLiquid: true,
          },
        ],
        "v2/ohm-supply/daily/2026-05.json": [
          {
            id: "supply-1",
            date: "2026-05-21",
            blockchain: "Ethereum",
            balance: 100,
            supplyBalance: 100,
          },
        ],
      }),
    };
    const variables = encodeURIComponent(JSON.stringify({ startDate: "2026-05-21", endDate: "2026-05-21" }));

    const metrics = await request(`/operations/paginated/metrics?wg_variables=${variables}`, undefined, config);
    expect(metrics.status).toBe(200);
    const metricsBody = await metrics.json();
    expect(metricsBody).toEqual({
      data: [expect.objectContaining({ date: "2026-05-21", treasuryMarketValue: 13 })],
    });
    expect(metricsBody).not.toHaveProperty("meta");
    expect(metricsBody).not.toHaveProperty("error");

    const tokenRecords = await request(`/operations/paginated/tokenRecords?wg_variables=${variables}`, undefined, config);
    expect(tokenRecords.status).toBe(200);
    const tokenRecordsBody = await tokenRecords.json();
    expect(tokenRecordsBody).toEqual({
      data: [expect.objectContaining({ id: "asset-1", blockchain: "Ethereum" })],
    });

    const tokenSupplies = await request(
      `/operations/paginated/tokenSupplies?wg_variables=${variables}`,
      undefined,
      config,
    );
    expect(tokenSupplies.status).toBe(200);
    const tokenSuppliesBody = await tokenSupplies.json();
    expect(tokenSuppliesBody).toEqual({
      data: [expect.objectContaining({ id: "supply-1", blockchain: "Ethereum" })],
    });

    const protocolMetrics = await request(
      `/operations/paginated/protocolMetrics?wg_variables=${variables}`,
      undefined,
      config,
    );
    expect(protocolMetrics.status).toBe(200);
    expect(await protocolMetrics.json()).toEqual({
      data: [
        {
          id: "protocol-metric-2026-05-21",
          block: 123,
          currentAPY: 0.05,
          currentIndex: 10,
          date: "2026-05-21",
          gOhmPrice: 120,
          gOhmTotalSupply: 100,
          nextDistributedOhm: 0,
          nextEpochRebase: 0,
          ohmPrice: 12,
          ohmTotalSupply: 1000,
          sOhmCirculatingSupply: 500,
          timestamp: 1_716_249_600,
          totalValueLocked: 6000,
        },
      ],
    });
  });
});
