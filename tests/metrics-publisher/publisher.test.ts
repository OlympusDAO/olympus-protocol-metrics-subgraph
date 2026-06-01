import { describe, expect, test } from "vitest";

import {
  HasuraGraphqlMetricsSource,
  MemoryArtifactStore,
  S3ArtifactStore,
  createArtifactStoreFromEnv,
  createMetricsSourceFromEnv,
  publishMetricsArtifacts,
  publishMetricsArtifactsFromEnv,
  type ArtifactStore,
  type MetricsSource,
} from "../../apps/metrics-publisher/src/publisher";
import type { DailyMetric, Manifest, OhmSupply, TreasuryAsset } from "../../packages/metrics-artifacts/src";

const generatedAt = "2026-06-01T08:15:00.000Z";

const metric: DailyMetric = {
  date: "2026-05-21",
  blocks: { Arbitrum: 0, Ethereum: 100, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  timestamps: { Arbitrum: 0, Ethereum: 1779814223, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  crossChainComplete: true,
  chainsIndexed: [1],
  chainsMissing: [],
  ohmIndex: 1,
  ohmApy: 2,
  ohmTotalSupply: 3,
  ohmTotalSupplyComponents: { Arbitrum: 0, Ethereum: 3, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  ohmCirculatingSupply: 4,
  ohmCirculatingSupplyComponents: { Arbitrum: 0, Ethereum: 4, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  ohmFloatingSupply: 5,
  ohmFloatingSupplyComponents: { Arbitrum: 0, Ethereum: 5, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  ohmBackedSupply: 6,
  gOhmBackedSupply: 7,
  ohmBackedSupplyComponents: { Arbitrum: 0, Ethereum: 6, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  ohmSupplyCategories: {
    BondsDeposits: 0,
    BondsPreminted: 0,
    BondsVestingDeposits: 0,
    BondsVestingTokens: 0,
    BoostedLiquidityVault: 0,
    LendingMarkets: 0,
    ProtocolOwnedLiquidity: 0,
    MigrationOffset: 0,
    TotalSupply: 3,
    Treasury: 0,
  },
  ohmPrice: 8,
  gOhmPrice: 9,
  marketCap: 10,
  sOhmCirculatingSupply: 11,
  sOhmTotalValueLocked: 12,
  treasuryMarketValue: 13,
  treasuryMarketValueComponents: { Arbitrum: 0, Ethereum: 13, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  treasuryLiquidBacking: 14,
  treasuryLiquidBackingComponents: { Arbitrum: 0, Ethereum: 14, Fantom: 0, Polygon: 0, Base: 0, Berachain: 0 },
  treasuryLiquidBackingPerOhmFloating: 15,
  treasuryLiquidBackingPerOhmBacked: 16,
  treasuryLiquidBackingPerGOhmBacked: 17,
  _meta: { chainsComplete: ["Ethereum"], chainsFailed: [], timestamp: generatedAt },
};

const treasuryAsset: TreasuryAsset = {
  id: "asset-1",
  balance: 100,
  block: 100,
  blockchain: "Ethereum",
  category: "Stable",
  date: "2026-05-21",
  isBluechip: false,
  isLiquid: true,
  multiplier: 1,
  rate: 1,
  source: "Treasury MS",
  sourceAddress: "0xsource",
  timestamp: 1779814223,
  token: "USDS",
  tokenAddress: "0xtoken",
  value: 100,
  valueExcludingOhm: 100,
};

const ohmSupply: OhmSupply = {
  id: "supply-1",
  balance: 1000,
  block: 100,
  blockchain: "Ethereum",
  date: "2026-05-21",
  pool: null,
  poolAddress: null,
  source: "",
  sourceAddress: "",
  supplyBalance: 1000,
  timestamp: 1779814223,
  token: "OHM",
  tokenAddress: "0xohm",
  type: "Total Supply",
};

const existingManifest: Manifest = {
  schemaVersion: "1.0.0",
  generatedAt,
  earliestDate: "2022-05-01",
  latestDate: "2026-05-30",
  artifacts: {},
};

function source(overrides: Partial<MetricsSource> = {}): MetricsSource {
  return {
    fetchBounds: async () => ({ earliestDate: "2026-04-30", latestDate: "2026-06-01" }),
    fetchDailyMetrics: async () => [metric, { ...metric, date: "2026-06-01" }],
    fetchTreasuryAssets: async () => [treasuryAsset],
    fetchOhmSupply: async () => [ohmSupply],
    ...overrides,
  };
}

describe("metrics publisher", () => {
  test("publishes manifest last after writing metric, treasury asset, and OHM supply shards", async () => {
    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      startDate: "2026-05-01",
      source: source(),
      store: new MemoryArtifactStore(),
      now: () => new Date(generatedAt),
    });

    expect(result.manifestPublishedLast).toBe(true);
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/treasury-assets/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/ohm-supply/daily/2026-05.json");
    expect(result.writtenKeys.at(-1)).toBe("v2/manifest.json");
  });

  test("writes schemas before manifest and records hashes, byte sizes, and row counts", async () => {
    const store = new MemoryArtifactStore();
    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      source: source(),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result.writtenKeys).toContain("v2/schemas/manifest.schema.json");
    expect(result.writtenKeys.indexOf("v2/schemas/manifest.schema.json")).toBeLessThan(
      result.writtenKeys.indexOf("v2/manifest.json"),
    );

    const manifest = store.json("v2/manifest.json");
    expect(manifest).toMatchObject({
      schemaVersion: "1.0.0",
      generatedAt,
      indexerDeploymentId: "current-indexer",
      earliestDate: "2026-05-01",
      latestDate: "2026-05-31",
    });
    expect(manifest.artifacts["v2/deployments/current-indexer/metrics/daily/2026-05.json"]).toMatchObject({
      rowCount: 1,
      byteLength: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(manifest.artifacts["v2/deployments/current-indexer/treasury-assets/daily/2026-05.json"].rowCount).toBe(1);
    expect(manifest.artifacts["v2/deployments/current-indexer/ohm-supply/daily/2026-05.json"].rowCount).toBe(1);
  });

  test("publishes from the existing manifest with a lookback overlap", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/manifest.json", existingManifest);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      lookbackDays: 2,
      source: source(),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result.range).toEqual({ start: "2026-05-29", end: "2026-06-01", days: 4 });
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-06.json");
  });

  test("defaults to the public start date for the initial backfill when no manifest exists", async () => {
    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      source: source(),
      store: new MemoryArtifactStore(),
      now: () => new Date(generatedAt),
    });

    expect(result.range).toEqual({ start: "2022-05-01", end: "2026-06-01", days: 1493 });
  });

  test("writes deployment-scoped shards and deletes historical deployment files after publishing manifest", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/deployments/old-indexer/metrics/daily/2026-05.json", []);
    await store.putJson("v2/deployments/current-indexer/metrics/daily/2026-04.json", []);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      source: source(),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/treasury-assets/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/ohm-supply/daily/2026-05.json");
    expect(result.deletedKeys).toEqual(["v2/deployments/old-indexer/metrics/daily/2026-05.json"]);

    const manifest = store.json("v2/manifest.json");
    expect(manifest).toMatchObject({ indexerDeploymentId: "current-indexer" });
    expect(manifest.artifacts["v2/deployments/current-indexer/metrics/daily/2026-05.json"]).toMatchObject({
      rowCount: 1,
    });
    expect(manifest.artifacts["v2/deployments/old-indexer/metrics/daily/2026-05.json"]).toBeUndefined();
    await expect(store.getJson("v2/deployments/old-indexer/metrics/daily/2026-05.json")).rejects.toThrow(
      "Artifact not found",
    );
    await expect(store.getJson("v2/deployments/current-indexer/metrics/daily/2026-04.json")).resolves.toEqual([]);
  });

  test("rejects unsafe indexer deployment ids", async () => {
    await expect(
      publishMetricsArtifacts({
        deploymentId: "../old-indexer",
        source: source(),
        store: new MemoryArtifactStore(),
        now: () => new Date(generatedAt),
      }),
    ).rejects.toThrow("INDEXER_DEPLOYMENT_ID");
  });

  test("requires an indexer deployment id before locking or reading Hasura", async () => {
    await expect(
      publishMetricsArtifacts({
        deploymentId: "",
        source: source({
          fetchBounds: async () => {
            throw new Error("should not fetch Hasura without a deployment id");
          },
        }),
        store: new MemoryArtifactStore(),
        now: () => new Date(generatedAt),
      }),
    ).rejects.toThrow("INDEXER_DEPLOYMENT_ID is required");
  });

  test("requires INDEXER_DEPLOYMENT_ID in the environment", async () => {
    await expect(
      publishMetricsArtifactsFromEnv(
        {
          HASURA_GRAPHQL_ENDPOINT: "http://hasura.internal/v1/graphql",
          HASURA_GRAPHQL_ADMIN_SECRET: "secret",
          ARTIFACT_BUCKET: "metrics",
          ARTIFACT_ENDPOINT: "https://r2.example.com",
          ARTIFACT_REGION: "auto",
          ARTIFACT_ACCESS_KEY_ID: "access-key",
          ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
        },
        {
          source: source(),
          store: new MemoryArtifactStore(),
          now: () => new Date(generatedAt),
        },
      ),
    ).rejects.toThrow("Missing required environment variable INDEXER_DEPLOYMENT_ID");
  });

  test("treats blank optional publisher date environment variables as unset", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/manifest.json", existingManifest);

    const result = await publishMetricsArtifactsFromEnv(
      {
        HASURA_GRAPHQL_ENDPOINT: "http://hasura.internal/v1/graphql",
        HASURA_GRAPHQL_ADMIN_SECRET: "secret",
        ARTIFACT_BUCKET: "metrics",
        ARTIFACT_ENDPOINT: "https://r2.example.com",
        ARTIFACT_REGION: "auto",
        ARTIFACT_ACCESS_KEY_ID: "access-key",
        ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
        INDEXER_DEPLOYMENT_ID: "current-indexer",
        PUBLISHER_LOOKBACK_DAYS: "2",
        PUBLISHER_PUBLIC_START_DATE: "2022-05-01",
        PUBLISHER_START_DATE: "",
        PUBLISHER_END_DATE: "   ",
      },
      {
        source: source(),
        store,
        now: () => new Date(generatedAt),
      },
    );

    expect(result.range).toEqual({ start: "2026-05-29", end: "2026-06-01", days: 4 });
  });

  test("skips cleanly when a fresh publisher lock already exists", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/publisher.lock", {
      runId: "existing-run",
      operation: "initial_backfill",
      startedAt: "2026-06-01T08:00:00.000Z",
      expiresAt: "2026-06-01T20:00:00.000Z",
    });

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      source: source({
        fetchBounds: async () => {
          throw new Error("should not fetch Hasura while locked");
        },
      }),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result).toMatchObject({
      deletedKeys: [],
      skipped: true,
      skipReason: "lock_held",
      manifestPublishedLast: false,
      writtenKeys: [],
    });
    await expect(store.getJson("v2/manifest.json")).rejects.toThrow("Artifact not found");
  });

  test("takes over stale publisher locks and releases the lock after publishing", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/publisher.lock", {
      runId: "stale-run",
      operation: "initial_backfill",
      startedAt: "2026-05-31T08:00:00.000Z",
      expiresAt: "2026-05-31T20:00:00.000Z",
    });

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      source: source(),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result.skipped).toBe(false);
    expect(result.range).toEqual({ start: "2022-05-01", end: "2026-06-01", days: 1493 });
    await expect(store.getJson("v2/publisher.lock")).rejects.toThrow("Artifact not found");
  });

  test("does not publish a new manifest when a shard upload fails", async () => {
    class FailingStore extends MemoryArtifactStore implements ArtifactStore {
      async putJson(key: string): Promise<void> {
        this.writtenKeys.push(key);
        if (key === "v2/deployments/current-indexer/metrics/daily/2026-05.json") {
          throw new Error("upload failed");
        }
        this.objects.set(key, `${JSON.stringify({ key })}\n`);
      }
    }
    const store = new FailingStore();

    await expect(
      publishMetricsArtifacts({
        deploymentId: "current-indexer",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        source: source(),
        store,
        now: () => new Date(generatedAt),
      }),
    ).rejects.toThrow("upload failed");

    expect(store.writtenKeys).not.toContain("v2/manifest.json");
  });

  test("S3-compatible store uploads JSON through the pinned AWS S3 client", async () => {
    const commands: Array<{ input?: Record<string, unknown> }> = [];
    const store = new S3ArtifactStore({
      endpoint: "https://r2.example.com",
      region: "auto",
      bucket: "metrics",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      client: {
        async send(command) {
          commands.push(command as unknown as { input?: Record<string, unknown> });
          return {};
        },
      },
    });

    await store.putJson("v2/manifest.json", { ok: true });
    await expect(store.putJsonIfAbsent("v2/publisher.lock", { runId: "run-1" })).resolves.toBe(true);

    expect(commands).toHaveLength(2);
    expect(commands[0].input).toMatchObject({
      Bucket: "metrics",
      Key: "v2/manifest.json",
      Body: '{"ok":true}\n',
      ContentType: "application/json; charset=utf-8",
    });
    expect(commands[1].input).toMatchObject({
      Bucket: "metrics",
      Key: "v2/publisher.lock",
      IfNoneMatch: "*",
    });
  });

  test("creates production source and store from documented Railway variables", () => {
    expect(
      createMetricsSourceFromEnv({
        HASURA_GRAPHQL_ENDPOINT: "http://hasura.railway.internal/v1/graphql",
        HASURA_GRAPHQL_ADMIN_SECRET: "secret",
      }),
    ).toBeInstanceOf(Object);

    expect(
      createArtifactStoreFromEnv({
        ARTIFACT_BUCKET: "metrics",
        ARTIFACT_ENDPOINT: "https://r2.example.com",
        ARTIFACT_REGION: "auto",
        ARTIFACT_ACCESS_KEY_ID: "access-key",
        ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
      }),
    ).toBeInstanceOf(S3ArtifactStore);
  });

  test("Hasura source keeps cross-chain complete when Arbitrum and Ethereum are indexed", async () => {
    const rawMetric = {
      date: "2026-05-21",
      crossChainComplete: true,
      chainsIndexed: [1, 42161],
      chainsMissing: [],
      chainValues: [],
      supplyCategories: [],
      ohmIndex: 0,
      ohmApy: 0,
      ohmTotalSupply: 0,
      ohmCirculatingSupply: 0,
      ohmFloatingSupply: 0,
      ohmBackedSupply: 0,
      gOhmBackedSupply: 0,
      ohmPrice: 0,
      gOhmPrice: 0,
      marketCap: 0,
      sOhmCirculatingSupply: 0,
      sOhmTotalValueLocked: 0,
      treasuryMarketValue: 0,
      treasuryLiquidBacking: 0,
      treasuryLiquidBackingPerOhmFloating: 0,
      treasuryLiquidBackingPerOhmBacked: 0,
      treasuryLiquidBackingPerGOhmBacked: 0,
    };
    const source = new HasuraGraphqlMetricsSource({
      endpoint: "http://hasura.internal/v1/graphql",
      adminSecret: "secret",
      fetchFn: async () =>
        new Response(JSON.stringify({ data: { GlobalMetricSnapshot: [rawMetric] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const [metric] = await source.fetchDailyMetrics({ start: "2026-05-21", end: "2026-05-21", days: 1 });

    expect(metric.chainsIndexed).toEqual([1, 42161]);
    expect(metric.chainsMissing).toEqual([250, 137, 8453, 80094]);
    expect(metric.crossChainComplete).toBe(true);
  });
});
