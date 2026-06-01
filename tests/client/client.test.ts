import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";

import { createClient } from "../../apps/client/src";
import { getOpenApiDocument, type OhmSupply, type TokenRecord, type TokenSupply, type TreasuryAsset } from "../../apps/client/src";
import { getOpenApiDocument as getCanonicalOpenApiDocument } from "../../packages/metrics-artifacts/src";

describe("@olympusdao/treasury-subgraph-client compatibility", () => {
  test("legacy query maps to /operations with wg_variables", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.query({
      operationName: "paginated/metrics",
      input: { startDate: "2026-05-20", dateOffset: 30 },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    const url = new URL(calls[0][0]);
    expect(url.pathname).toBe("/operations/paginated/metrics");
    expect(JSON.parse(url.searchParams.get("wg_variables") ?? "{}")).toEqual({
      startDate: "2026-05-20",
      dateOffset: 30,
    });
  });

  test("new methods map to semantic v2 routes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], meta: {} })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.getDailyTreasuryAssets({ start: "2026-05-20" });
    await client.getDailyOhmSupply({ start: "2026-05-20" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(new URL(calls[0][0]).pathname).toBe("/v2/treasury-assets/daily");
    expect(new URL(calls[1][0]).pathname).toBe("/v2/ohm-supply/daily");
  });

  test("ships package metadata for the published client", () => {
    const packageJson = JSON.parse(readFileSync("apps/client/package.json", "utf8")) as {
      name: string;
      version: string;
      files: string[];
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      exports: Record<string, unknown>;
    };

    expect(packageJson.name).toBe("@olympusdao/treasury-subgraph-client");
    expect(packageJson.version).toMatch(/^2\./);
    expect(packageJson.files).toContain("openapi.json");
    expect(packageJson.exports).toHaveProperty("./openapi.json");
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
    expect(packageJson.peerDependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
  });

  test("ships an OpenAPI JSON file matching the generated document paths", () => {
    const packaged = JSON.parse(readFileSync("apps/client/openapi.json", "utf8")) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    const canonical = getCanonicalOpenApiDocument();

    expect(packaged.openapi).toBe("3.1.0");
    expect(Object.keys(packaged.paths).sort()).toEqual(Object.keys(canonical.paths).sort());
    expect(Object.keys(getOpenApiDocument().paths).sort()).toEqual(Object.keys(canonical.paths).sort());
  });

  test("exports semantic v2 and legacy-compatible TypeScript types", () => {
    const treasuryAsset = {} as TreasuryAsset;
    const tokenRecord: TokenRecord = treasuryAsset;
    const ohmSupply = {} as OhmSupply;
    const tokenSupply: TokenSupply = ohmSupply;

    expect(tokenRecord).toBe(treasuryAsset);
    expect(tokenSupply).toBe(ohmSupply);
  });
});
