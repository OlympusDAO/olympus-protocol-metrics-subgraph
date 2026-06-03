import { readFileSync } from "node:fs";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";

import { createClient, DEFAULT_BASE_URL } from "../src";
import {
  getOpenApiDocument,
  type ChainTokenRecords,
  type ChainTokenSupplies,
  type Health,
  type Metric,
  type Operations,
  type OhmSupply,
  type TokenRecord,
  type TokenSupply,
  type TreasuryAsset,
  type WundergraphResponse,
} from "../src";
import { getOpenApiDocument as getCanonicalOpenApiDocument } from "../../../packages/metrics-artifacts/src";

describe("@olympusdao/treasury-subgraph-client compatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults to the public treasury subgraph API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ fetch: fetchMock });

    await client.getDailyMetrics({ start: "2026-05-20" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    const url = new URL(calls[0][0]);
    expect(DEFAULT_BASE_URL).toBe("https://treasury-subgraph-api.olympusdao.finance");
    expect(`${url.protocol}//${url.host}`).toBe(DEFAULT_BASE_URL);
    expect(url.pathname).toBe("/v2/metrics/daily");
  });

  test("wraps the default global fetch so browser receivers stay valid", async () => {
    const fetchMock = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new Error("fetch called with the wrong receiver");
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createClient({ baseUrl: "https://metrics.example" });

    await client.getDailyMetrics({ start: "2026-05-20" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(new URL(calls[0][0]).pathname).toBe("/v2/metrics/daily");
  });

  test("still uses a custom fetch implementation when provided", async () => {
    const defaultFetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const customFetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", defaultFetchMock);

    const client = createClient({ baseUrl: "https://metrics.example", fetch: customFetchMock });

    await client.getDailyMetrics({ start: "2026-05-20" });

    expect(customFetchMock).toHaveBeenCalledTimes(1);
    expect(defaultFetchMock).not.toHaveBeenCalled();
  });

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

  test("legacy health query maps to the operations health route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { status: "ok", timestamp: "2026-06-03T00:00:00.000Z", version: "3.0.0" } })),
    );
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    const health = await client.query({ operationName: "health" });

    expectTypeOf(health).toEqualTypeOf<Operations["health"]["response"]>();
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(new URL(calls[0][0]).pathname).toBe("/operations/health");
  });

  test("legacy query preserves operation-specific TypeScript inference", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    const metrics = await client.query({
      operationName: "paginated/metrics",
      input: { startDate: "2026-05-20", includeRecords: true },
    });
    const protocolMetrics = await client.query({
      operationName: "paginated/protocolMetrics",
      input: { startDate: "2026-05-20" },
    });

    expectTypeOf(metrics).toEqualTypeOf<Operations["paginated/metrics"]["response"]>();
    expectTypeOf(await client.query({ operationName: "latest/metrics" })).toEqualTypeOf<
      Operations["latest/metrics"]["response"]
    >();
    expectTypeOf(protocolMetrics).toEqualTypeOf<Operations["paginated/protocolMetrics"]["response"]>();
    expectTypeOf(protocolMetrics).toEqualTypeOf<WundergraphResponse<Operations["paginated/protocolMetrics"]["data"]>>();
  });

  test("deprecated legacy helper methods call the same operations routes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.getPaginatedTokenRecords({ startDate: "2026-05-20" });
    await client.getLatestProtocolMetrics();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(new URL(calls[0][0]).pathname).toBe("/operations/paginated/tokenRecords");
    expect(new URL(calls[1][0]).pathname).toBe("/operations/latest/protocolMetrics");
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

  test("does not paginate v2 ranges unless autoPaginate is enabled", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], meta: {} })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.getDailyMetrics({ start: "2025-01-01", end: "2026-01-02" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0][0]);
    expect(url.pathname).toBe("/v2/metrics/daily");
    expect(url.searchParams.get("start")).toBe("2025-01-01");
    expect(url.searchParams.get("end")).toBe("2026-01-02");
  });

  test.each([
    {
      label: "less than maxRangeDays",
      end: "2025-01-02",
      expectedChunks: [{ start: "2025-01-01", end: "2025-01-02" }],
    },
    {
      label: "equal to maxRangeDays",
      end: "2025-01-03",
      expectedChunks: [{ start: "2025-01-01", end: "2025-01-03" }],
    },
    {
      label: "greater than maxRangeDays",
      end: "2025-01-04",
      expectedChunks: [
        { start: "2025-01-01", end: "2025-01-03" },
        { start: "2025-01-04", end: "2025-01-04" },
      ],
    },
  ])("auto-paginates v2 daily metrics when the date range is $label", async ({ end, expectedChunks }) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const parsed = new URL(input instanceof Request ? input.url : input.toString());
      if (parsed.pathname === "/v2/bounds") {
        return new Response(
          JSON.stringify({
            data: {
              earliestDate: "2025-01-01",
              latestDate: "2025-01-04",
              maxRangeDays: 3,
            },
          }),
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ start: parsed.searchParams.get("start"), end: parsed.searchParams.get("end") }],
          meta: {},
        }),
      );
    });
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    const data = await client.getDailyMetrics({
      start: "2025-01-01",
      end,
      autoPaginate: true,
    });

    expect(data).toEqual(expectedChunks);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/v2/bounds",
      ...expectedChunks.map(() => "/v2/metrics/daily"),
    ]);
    expect(
      calls.slice(1).map(([url]) => {
        const parsed = new URL(url);
        return {
          start: parsed.searchParams.get("start"),
          end: parsed.searchParams.get("end"),
        };
      }),
    ).toEqual(expectedChunks);
  });

  test("auto-pagination preserves metric-specific options", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const parsed = new URL(input instanceof Request ? input.url : input.toString());
      if (parsed.pathname === "/v2/bounds") {
        return new Response(
          JSON.stringify({
            data: {
              earliestDate: "2025-01-01",
              latestDate: "2025-01-04",
              maxRangeDays: 3,
            },
          }),
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ includeRecords: parsed.searchParams.get("includeRecords") }],
          meta: {},
        }),
      );
    });
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    const data = await client.getDailyMetrics({
      start: "2025-01-01",
      end: "2025-01-04",
      includeRecords: true,
      autoPaginate: true,
    });

    expect(data).toEqual([{ includeRecords: "true" }, { includeRecords: "true" }]);
  });

  test("auto-paginates v2 treasury assets and OHM supply when enabled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const parsed = new URL(input instanceof Request ? input.url : input.toString());
      if (parsed.pathname === "/v2/bounds") {
        return new Response(
          JSON.stringify({
            data: {
              earliestDate: "2025-01-01",
              latestDate: "2025-01-03",
              maxRangeDays: 2,
            },
          }),
        );
      }
      return new Response(JSON.stringify({ data: [{ path: parsed.pathname, start: parsed.searchParams.get("start") }] }));
    });
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.getDailyTreasuryAssets({ start: "2025-01-01", end: "2025-01-03", autoPaginate: true });
    await client.getDailyOhmSupply({ start: "2025-01-01", end: "2025-01-03", autoPaginate: true });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/v2/bounds",
      "/v2/treasury-assets/daily",
      "/v2/treasury-assets/daily",
      "/v2/ohm-supply/daily",
      "/v2/ohm-supply/daily",
    ]);
  });

  test("ships package metadata for the published client", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      version: string;
      files: string[];
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      exports: Record<string, unknown>;
      main: string;
      scripts: Record<string, string>;
      types: string;
    };

    expect(packageJson.name).toBe("@olympusdao/treasury-subgraph-client");
    expect(packageJson.version).toMatch(/^3\./);
    expect(packageJson.scripts["auth:login"]).toBe(
      "npm login --registry=https://registry.npmjs.org --scope=@olympusdao --userconfig ./.npmrc.local",
    );
    expect(packageJson.scripts["auth:logout"]).toBe("tsx scripts/auth-logout.ts");
    expect(packageJson.scripts["auth:whoami"]).toBe(
      "npm whoami --registry=https://registry.npmjs.org --userconfig ./.npmrc.local",
    );
    expect(packageJson.main).toBe("./dist/apps/client/src/index.js");
    expect(packageJson.types).toBe("./dist/apps/client/src/index.d.ts");
    expect(packageJson.files).toContain("CHANGELOG.md");
    expect(packageJson.files).toContain("openapi.json");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.scripts.build).toBe("rm -rf dist && tsc -p tsconfig.build.json && pnpm run openapi:generate");
    expect(packageJson.scripts["openapi:generate"]).toBe("tsx scripts/write-openapi.ts");
    expect(packageJson.scripts["pack:dry-run"]).toBe(
      "pnpm run build && npm pack --dry-run --ignore-scripts --cache /tmp/olympus-treasury-subgraph-npm-cache",
    );
    expect(packageJson.scripts.pretest).toBe("pnpm run openapi:generate");
    expect(packageJson.scripts.prepack).toBe("pnpm run build");
    expect(packageJson.scripts.prepublishOnly).toBe("pnpm run release:check");
    expect(packageJson.scripts["publish:client"]).toBe("tsx scripts/stage-publish.ts");
    expect(packageJson.scripts["release:check"]).toBe("tsx scripts/release-check.ts");
    expect(packageJson.scripts["stage:list"]).toBe(
      "npm stage list @olympusdao/treasury-subgraph-client --userconfig ./.npmrc.local",
    );
    expect(packageJson.exports).toHaveProperty("./openapi.json");
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
    expect(packageJson.peerDependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
  });

  test("publish helper logs out and removes the local npm credentials", () => {
    const stagePublish = readFileSync("scripts/stage-publish.ts", "utf8");
    const authLogout = readFileSync("scripts/auth-logout.ts", "utf8");
    const npmAuth = readFileSync("scripts/npm-auth.ts", "utf8");

    expect(stagePublish).toContain('runNpm(["login"');
    expect(stagePublish).toContain('"stage"');
    expect(stagePublish).toContain('"publish"');
    expect(stagePublish).not.toContain('"--provenance"');
    expect(stagePublish).toContain("logoutAndRemoveLocalNpmConfig()");
    expect(stagePublish).toContain("removeLocalNpmConfig()");
    expect(authLogout).toContain("logoutAndRemoveLocalNpmConfig()");
    expect(npmAuth).toContain('runNpm(["logout"');
    expect(npmAuth).toContain("unlinkSync(userConfig)");
  });

  test("ships an OpenAPI JSON file matching the generated document paths", () => {
    const packaged = JSON.parse(readFileSync("openapi.json", "utf8")) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    const canonical = getCanonicalOpenApiDocument();

    expect(packaged.openapi).toBe("3.1.0");
    expect(Object.keys(packaged.paths).sort()).toEqual(Object.keys(canonical.paths).sort());
    expect(Object.keys(getOpenApiDocument().paths).sort()).toEqual(Object.keys(canonical.paths).sort());
    expect(packaged.paths["/operations/paginated/metrics"]).toEqual(canonical.paths["/operations/paginated/metrics"]);
  });

  test("exports semantic v2 and legacy-compatible TypeScript types", () => {
    const treasuryAsset = {} as TreasuryAsset;
    const tokenRecord: TokenRecord = treasuryAsset;
    const ohmSupply = {} as OhmSupply;
    const tokenSupply: TokenSupply = ohmSupply;
    const tokenRecords = {} as ChainTokenRecords;
    const tokenSupplies = {} as ChainTokenSupplies;
    const health = {} as Health;

    expect(tokenRecord).toBe(treasuryAsset);
    expect(tokenSupply).toBe(ohmSupply);
    expectTypeOf<Metric["_meta"]["chainsComplete"]>().toEqualTypeOf<string[]>();
    expect(tokenRecords).toBe(tokenRecords);
    expect(tokenSupplies).toBe(tokenSupplies);
    expect(health).toBe(health);
  });
});
