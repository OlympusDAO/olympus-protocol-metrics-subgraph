import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = resolve(TEST_DIR, "..");
const clientFile = (path: string) => resolve(CLIENT_DIR, path);

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

  test("normalizes trailing slashes in the base URL without a regular expression", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ baseUrl: "https://metrics.example////", fetch: fetchMock });

    await client.getDailyMetrics({ start: "2026-05-20" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(calls[0][0]).toBe("https://metrics.example/v2/metrics/daily?start=2026-05-20");
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

  test("auto-pagination retries bounds after a transient bounds failure", async () => {
    let boundsAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const parsed = new URL(input instanceof Request ? input.url : input.toString());
      if (parsed.pathname === "/v2/bounds") {
        boundsAttempts += 1;
        if (boundsAttempts === 1) {
          return new Response(JSON.stringify({ message: "temporary failure" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            data: {
              earliestDate: "2025-01-01",
              latestDate: "2025-01-02",
              maxRangeDays: 2,
            },
          }),
        );
      }
      return new Response(JSON.stringify({ data: [{ path: parsed.pathname }] }));
    });
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await expect(
      client.getDailyMetrics({
        start: "2025-01-01",
        end: "2025-01-02",
        autoPaginate: true,
      }),
    ).rejects.toThrow("status 503");

    await expect(
      client.getDailyMetrics({
        start: "2025-01-01",
        end: "2025-01-02",
        autoPaginate: true,
      }),
    ).resolves.toEqual([{ path: "/v2/metrics/daily" }]);
    expect(boundsAttempts).toBe(2);
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
    const packageJson = JSON.parse(readFileSync(clientFile("package.json"), "utf8")) as {
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
    expect(packageJson.scripts["auth:login"]).toBeUndefined();
    expect(packageJson.scripts["auth:logout"]).toBeUndefined();
    expect(packageJson.scripts["auth:whoami"]).toBeUndefined();
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
    expect(packageJson.scripts["publish:client"]).toBeUndefined();
    expect(packageJson.scripts["release:check"]).toBe("tsx scripts/release-check.ts");
    expect(packageJson.scripts["stage:list"]).toBeUndefined();
    expect(packageJson.exports).toHaveProperty("./openapi.json");
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
    expect(packageJson.peerDependencies ?? {}).not.toHaveProperty("@tanstack/react-query");
  });

  test("ships a manual CI staged-publishing workflow", () => {
    const workflow = readFileSync(resolve(CLIENT_DIR, "../../.github/workflows/client-release.yml"), "utf8");
    const docs = readFileSync(resolve(CLIENT_DIR, "../../docs/client-release.md"), "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("expected_version:");
    expect(workflow).toContain("mode:");
    expect(workflow).toContain("default: dry-run");
    expect(workflow).toContain("- dry-run");
    expect(workflow).toContain("- stage");
    expect(workflow).toContain("required: true");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("validate-pack:");
    expect(workflow).toContain("stage-npm:");
    expect(workflow).toContain("github-release:");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("environment: npm-stage");
    expect(workflow).toContain("npm install -g npm@11.15.0");
    expect(workflow).toContain("pnpm --dir \"$PACKAGE_DIR\" exec tsx scripts/ci-release.ts validate");
    expect(workflow).toContain("pnpm --dir \"$PACKAGE_DIR\" exec tsx scripts/ci-release.ts pack");
    expect(workflow).toContain("pnpm --dir \"$PACKAGE_DIR\" exec tsx scripts/ci-release.ts notes");
    expect(workflow).toContain("pnpm --dir \"$PACKAGE_DIR\" run release:check");
    expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(workflow).toContain("actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53");
    expect(workflow).toContain(`if: \${{ inputs.mode == 'dry-run' }}`);
    expect(workflow).toContain(`if: \${{ inputs.mode == 'stage' }}`);
    expect(workflow).toContain("No npm staging, git tag, or GitHub Release was created.");
    expect(workflow).toContain("npm stage publish \"$RUNNER_TEMP/client-package/");
    expect(workflow).toContain("gh release create");
    expect(workflow).not.toContain("npm publish --access public");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("node --input-type=module");
    expect(workflow).not.toContain("<<'NODE'");
    expect(workflow).not.toContain("git tag -a");

    const ciRelease = readFileSync(clientFile("scripts/ci-release.ts"), "utf8");
    expect(ciRelease).toContain("EXPECTED_VERSION is required");
    expect(ciRelease).toContain("Package version must be valid semver");
    expect(ciRelease).toContain("is already published on npm");
    expect(ciRelease).toContain("is already staged on npm");
    expect(ciRelease).toContain("validateReleaseInputs");
    expect(ciRelease).toContain(
      [
        "function validateReleaseInputs(): void {",
        "  assertExpectedVersion();",
        "  assertVersionNotPublished();",
        "  assertReleaseTagDoesNotExist();",
        "}",
      ].join("\n"),
    );
    expect(ciRelease).toContain("already exists on origin");
    expect(ciRelease).toContain("CHANGELOG.md");
    expect(ciRelease).toContain("Missing changelog section");
    expect(ciRelease).toContain("## Changelog");
    expect(ciRelease).toContain("escapeRegExp");
    expect(ciRelease).toContain("CHANGELOG_RELEASE_HEADING_PATTERN");
    expect(ciRelease).toContain("SEMVER_PATTERN.source.slice(1, -1)");
    expect(ciRelease).not.toContain("^## \\\\[v?\\\\d+\\\\.\\\\d+\\\\.\\\\d+\\\\]");
    expect(ciRelease).toContain("validateReleaseInputs");
    expect(ciRelease).toContain(["treasury-subgraph-client-v", "{version}"].join("$"));
    expect(ciRelease).toContain('"release"');
    expect(ciRelease).toContain('"create"');
    expect(ciRelease).toContain('"tag"');
    expect(ciRelease).toContain('getExitStatus(error) !== 2');
    expect(docs).toContain("Use the manual GitHub Actions workflow");
    expect(docs).toContain("Allow **stage publish**");
    expect(docs).toContain("Do not allow direct");
    expect(docs).toContain("There is no supported local package staging path");
    expect(docs).toContain("approve it with 2FA");
  });

  test("generates CI release notes from the matching changelog section", () => {
    const outputDir = mkdtempSync(resolve(tmpdir(), "treasury-subgraph-client-release-"));
    const notesPath = resolve(outputDir, "notes.md");

    execFileSync("pnpm", ["exec", "tsx", "scripts/ci-release.ts", "notes"], {
      cwd: CLIENT_DIR,
      env: { ...process.env, RELEASE_NOTES_PATH: notesPath },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const notes = readFileSync(notesPath, "utf8");
    expect(notes).toContain("Package: `@olympusdao/treasury-subgraph-client@3.0.0`");
    expect(notes).toContain("https://www.npmjs.com/package/@olympusdao/treasury-subgraph-client");
    expect(notes).not.toContain("Staged npm package");
    expect(notes).not.toContain("Review and approve the staged package");
    expect(notes).toContain("## Changelog");
    expect(notes).toContain("## [v3.0.0] - 2026-06-04");
    expect(notes).toContain("### Breaking: Move to the self-hosted metrics API");
    expect(notes).toContain("Preserved legacy `query({ operationName, input })` support for `/operations/*`.");
    expect(notes).not.toContain("## [v2.0.0]");
  });

  test("release check fails if generated files drift during build or tests", () => {
    const releaseCheck = readFileSync(clientFile("scripts/release-check.ts"), "utf8");
    const buildIndex = releaseCheck.indexOf('run("pnpm", ["run", "build"], packageDir);');
    const testIndex = releaseCheck.indexOf('run("pnpm", ["run", "test"], packageDir);');
    const postBuildCleanIndex = releaseCheck.indexOf('assertCleanGitTree();', testIndex);
    const auditIndex = releaseCheck.indexOf('run("pnpm", ["audit", "--audit-level", "moderate"], repoRoot);');

    expect(buildIndex).toBeGreaterThan(0);
    expect(testIndex).toBeGreaterThan(buildIndex);
    expect(postBuildCleanIndex).toBeGreaterThan(testIndex);
    expect(auditIndex).toBeGreaterThan(postBuildCleanIndex);
  });

  test("ships an OpenAPI JSON file matching the generated document paths", () => {
    const packaged = JSON.parse(readFileSync(clientFile("openapi.json"), "utf8")) as {
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
