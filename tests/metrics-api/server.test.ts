import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";

import { handleMetricsApiRequest } from "../../apps/metrics-api/src/server";

let closeServer: (() => Promise<void>) | undefined;

async function request(path: string, init?: RequestInit) {
  const server = createServer((req, res) => {
    void handleMetricsApiRequest(req, res, { maxRangeDays: 366 });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closeServer = () => new Promise((resolve) => server.close(() => resolve()));
  const port = (server.address() as AddressInfo).port;
  return fetch(`http://127.0.0.1:${port}${path}`, init);
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

  test("rejects end date before start date on v2 ranges", async () => {
    const response = await request("/v2/metrics/daily?start=2026-06-01&end=2026-05-20");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_date_range" },
    });
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
});
