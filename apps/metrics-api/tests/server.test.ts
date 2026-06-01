import { createServer, request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";

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
  init: { method: string; body?: string },
  config: MetricsApiConfig = defaultConfig,
) {
  const server = createServer((req, res) => {
    void handleMetricsApiRequest(req, res, config);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closeServer = () => new Promise((resolve) => server.close(() => resolve()));
  const port = (server.address() as AddressInfo).port;

  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>(
    (resolve, reject) => {
      const clientRequest = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path,
          method: init.method,
          headers:
            init.body === undefined
              ? undefined
              : {
                  "content-length": Buffer.byteLength(init.body),
                  "content-type": "application/json",
                },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      clientRequest.on("error", reject);
      if (init.body !== undefined) {
        clientRequest.write(init.body);
      }
      clientRequest.end();
    },
  );
}

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe("metrics API HTTP behavior", () => {
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
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        earliestDate: "2021-04-29",
        latestDate: "2026-06-01",
        maxRangeDays: 366,
        indexerDeploymentId: "current-indexer",
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
    expect((await request("/v2/bounds")).headers.get("cache-control")).toContain("max-age=300");
    expect(
      (await request("/v2/metrics/daily?start=2026-05-21")).headers.get("cache-control"),
    ).toContain("max-age=28800");
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
    expect(latest.headers.get("deprecation")).toBe("true");

    const atBlock = await request("/operations/atBlock/metrics");
    expect(atBlock.status).toBe(501);
    expect(await atBlock.json()).toMatchObject({
      data: null,
      errors: [{ message: expect.stringMatching(/not supported/i) }],
    });
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
      expect(await response.json(), route).toEqual({ data: [] });
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
    expect(await encoded.json()).toMatchObject({ data: [] });

    const raw = await request(`/operations/paginated/tokenRecords?wg_variables=${variables}`);
    expect(raw.status).toBe(200);
    expect(await raw.json()).toMatchObject({ data: [] });
  });
});
