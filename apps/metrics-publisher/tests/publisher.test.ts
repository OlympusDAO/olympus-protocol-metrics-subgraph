import { describe, expect, test } from "vitest";

import {
  HasuraGraphqlMetricsSource,
  MemoryArtifactStore,
  MetricsNotDataReadyError,
  S3ArtifactStore,
  createArtifactStoreFromEnv,
  createMetricsSourceFromEnv,
  publishMetricsArtifacts,
  publishMetricsArtifactsFromEnv,
  type ArtifactStore,
  type MetricsSource,
  type PublishBoundsCompleteness,
} from "../src/publisher";
import type { DailyMetric, Manifest, OhmSupply, TreasuryAsset } from "../../../packages/metrics-artifacts/src";

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

const existingCurrentDeploymentManifest: Manifest = {
  ...existingManifest,
  indexerDeploymentId: "current-indexer",
  artifacts: {
    "v2/deployments/current-indexer/metrics/daily/2026-05.json": {
      sha256: "0".repeat(64),
      byteLength: 3,
      rowCount: 1,
    },
  },
};

const validPublisherArtifactEnv: NodeJS.ProcessEnv = {
  ARTIFACT_BUCKET: "metrics",
  ARTIFACT_ENDPOINT: "https://r2.example.com",
  ARTIFACT_REGION: "auto",
  ARTIFACT_ACCESS_KEY_ID: "access-key",
  ARTIFACT_SECRET_ACCESS_KEY: "secret-key",
};

function source(overrides: Partial<MetricsSource> = {}): MetricsSource {
  return {
    fetchBounds: async () => ({ earliestDate: "2026-04-30", latestDate: "2026-06-01" }),
    fetchLatestIndexingProgress: async () => ({
      chains: {
        Arbitrum: { block: 100, date: "2026-06-01" },
        Ethereum: { block: 200, date: "2026-06-01" },
        Fantom: { block: 300, date: "2026-06-01" },
        Polygon: { block: 400, date: "2026-06-01" },
        Base: { block: 500, date: "2026-06-01" },
        Berachain: { block: 600, date: "2026-06-01" },
      },
    }),
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
    await store.putJson("v2/manifest.json", existingCurrentDeploymentManifest);

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

  test("first publish for a deployment only publishes up to the latest all-chain indexed snapshot", async () => {
    const store = new MemoryArtifactStore();
    const observedRanges: Array<{ start: string; end: string; days: number }> = [];
    const observedCompleteness: PublishBoundsCompleteness[] = [];
    await store.putJson("v2/manifest.json", existingManifest);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      lookbackDays: 2,
      source: source({
        fetchBounds: async (completeness) => {
          observedCompleteness.push(completeness ?? "cross_chain");
          return { earliestDate: "2026-04-30", latestDate: "2026-05-31" };
        },
        fetchDailyMetrics: async (range) => {
          observedRanges.push(range);
          return [{ ...metric, date: "2026-05-31" }];
        },
        fetchTreasuryAssets: async (range) => {
          observedRanges.push(range);
          return [];
        },
        fetchOhmSupply: async (range) => {
          observedRanges.push(range);
          return [];
        },
      }),
      store,
      now: () => new Date(generatedAt),
    });

    expect(observedCompleteness).toEqual(["all_chains"]);
    expect(result.range).toEqual({ start: "2022-05-01", end: "2026-05-31", days: 1492 });
    expect(result.deploymentId).toBe("current-indexer");
    expect(result.indexingProgress).toMatchObject({
      chains: {
        Arbitrum: { block: 100, date: "2026-06-01" },
        Ethereum: { block: 200, date: "2026-06-01" },
      },
    });
    expect(observedRanges).toEqual([
      { start: "2022-05-01", end: "2026-05-31", days: 1492 },
      { start: "2022-05-01", end: "2026-05-31", days: 1492 },
      { start: "2022-05-01", end: "2026-05-31", days: 1492 },
    ]);
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-05.json");
    expect(result.writtenKeys).not.toContain("v2/deployments/current-indexer/metrics/daily/2026-06.json");
    expect(store.json("v2/manifest.json")).toMatchObject({
      latestDate: "2026-05-31",
      indexerDeploymentId: "current-indexer",
    });
  });

  test("first publish for a deployment waits until all-chain data is within one day of current UTC date", async () => {
    const store = new MemoryArtifactStore();
    const observedCompleteness: PublishBoundsCompleteness[] = [];
    await store.putJson("v2/manifest.json", existingManifest);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      source: source({
        fetchBounds: async (completeness) => {
          observedCompleteness.push(completeness ?? "cross_chain");
          return { earliestDate: "2026-04-30", latestDate: "2026-05-30" };
        },
        fetchDailyMetrics: async () => {
          throw new Error("should not fetch daily metrics before deployment handover is ready");
        },
        fetchTreasuryAssets: async () => {
          throw new Error("should not fetch treasury assets before deployment handover is ready");
        },
        fetchOhmSupply: async () => {
          throw new Error("should not fetch OHM supply before deployment handover is ready");
        },
      }),
      store,
      now: () => new Date("2026-06-01T08:15:00.000Z"),
    });

    expect(observedCompleteness).toEqual(["all_chains"]);
    expect(result).toMatchObject({
      deletedKeys: [],
      skipped: true,
      skipReason: "not_data_ready",
      manifestPublishedLast: false,
      writtenKeys: [],
    });
    expect(store.json("v2/manifest.json")).toEqual(existingManifest);
    await expect(store.getJson("v2/publisher.lock")).rejects.toThrow("Artifact not found");
  });

  test("incremental publish for the same deployment can use cross-chain complete bounds", async () => {
    const store = new MemoryArtifactStore();
    const observedCompleteness: PublishBoundsCompleteness[] = [];
    await store.putJson("v2/manifest.json", existingCurrentDeploymentManifest);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      lookbackDays: 2,
      source: source({
        fetchBounds: async (completeness) => {
          observedCompleteness.push(completeness ?? "cross_chain");
          return { earliestDate: "2026-04-30", latestDate: "2026-06-01" };
        },
      }),
      store,
      now: () => new Date(generatedAt),
    });

    expect(observedCompleteness).toEqual(["cross_chain"]);
    expect(result.range).toEqual({ start: "2026-05-29", end: "2026-06-01", days: 4 });
    expect(result.indexingProgress).toMatchObject({
      chains: {
        Arbitrum: { block: 100, date: "2026-06-01" },
        Ethereum: { block: 200, date: "2026-06-01" },
      },
    });
    expect(result.writtenKeys).toContain("v2/deployments/current-indexer/metrics/daily/2026-06.json");
  });

  test("skips without replacing the manifest when no complete Hasura bounds exist", async () => {
    const store = new MemoryArtifactStore();
    const observedCompleteness: PublishBoundsCompleteness[] = [];
    await store.putJson("v2/manifest.json", existingManifest);

    const result = await publishMetricsArtifacts({
      deploymentId: "current-indexer",
      source: source({
        fetchLatestIndexingProgress: async () => ({
          chains: {
            Base: { block: 12345, date: "2026-06-01" },
          },
        }),
        fetchBounds: async (completeness) => {
          observedCompleteness.push(completeness ?? "cross_chain");
          throw new MetricsNotDataReadyError("Hasura returned no complete GlobalMetricSnapshot bounds.");
        },
        fetchDailyMetrics: async () => {
          throw new Error("should not fetch daily metrics while data is not ready");
        },
        fetchTreasuryAssets: async () => {
          throw new Error("should not fetch treasury assets while data is not ready");
        },
        fetchOhmSupply: async () => {
          throw new Error("should not fetch OHM supply while data is not ready");
        },
      }),
      store,
      now: () => new Date(generatedAt),
    });

    expect(observedCompleteness).toEqual(["all_chains"]);
    expect(result).toMatchObject({
      deletedKeys: [],
      skipped: true,
      skipReason: "not_data_ready",
      manifestPublishedLast: false,
      writtenKeys: [],
    });
    expect(result.indexingProgress).toMatchObject({
      chains: {
        Base: { block: 12345, date: "2026-06-01" },
      },
    });
    expect(store.json("v2/manifest.json")).toEqual(existingManifest);
    await expect(store.getJson("v2/publisher.lock")).rejects.toThrow("Artifact not found");
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

  test("handles a changed indexer deployment id by replacing deployment-scoped artifacts", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/deployments/old-indexer/metrics/daily/2026-05.json", []);
    await store.putJson("v2/deployments/old-indexer/treasury-assets/daily/2026-05.json", []);
    await store.putJson("v2/deployments/old-indexer/ohm-supply/daily/2026-05.json", []);
    await store.putJson("v2/manifest.json", {
      ...existingManifest,
      indexerDeploymentId: "old-indexer",
      artifacts: {
        "v2/deployments/old-indexer/metrics/daily/2026-05.json": {
          sha256: "0".repeat(64),
          byteLength: 3,
          rowCount: 0,
        },
        "v2/deployments/old-indexer/treasury-assets/daily/2026-05.json": {
          sha256: "1".repeat(64),
          byteLength: 3,
          rowCount: 0,
        },
        "v2/deployments/old-indexer/ohm-supply/daily/2026-05.json": {
          sha256: "2".repeat(64),
          byteLength: 3,
          rowCount: 0,
        },
      },
    });

    const result = await publishMetricsArtifacts({
      deploymentId: "new-indexer",
      lookbackDays: 2,
      source: source(),
      store,
      now: () => new Date(generatedAt),
    });

    expect(result.range).toEqual({ start: "2022-05-01", end: "2026-06-01", days: 1493 });
    expect(result.writtenKeys).toContain("v2/deployments/new-indexer/metrics/daily/2026-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/new-indexer/metrics/daily/2022-05.json");
    expect(result.writtenKeys).toContain("v2/deployments/new-indexer/metrics/daily/2026-06.json");
    expect(result.deletedKeys).toEqual([
      "v2/deployments/old-indexer/metrics/daily/2026-05.json",
      "v2/deployments/old-indexer/ohm-supply/daily/2026-05.json",
      "v2/deployments/old-indexer/treasury-assets/daily/2026-05.json",
    ]);

    const manifest = store.json("v2/manifest.json");
    expect(manifest).toMatchObject({ indexerDeploymentId: "new-indexer" });
    expect(Object.keys(manifest.artifacts).some((key) => key.startsWith("v2/deployments/old-indexer/"))).toBe(false);
    expect(manifest.artifacts["v2/deployments/new-indexer/metrics/daily/2026-05.json"]).toMatchObject({
      rowCount: 1,
    });
    expect(manifest.artifacts["v2/deployments/new-indexer/metrics/daily/2026-06.json"]).toMatchObject({
      rowCount: 1,
    });
    await expect(store.getJson("v2/deployments/old-indexer/metrics/daily/2026-05.json")).rejects.toThrow(
      "Artifact not found",
    );
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
          ...validPublisherArtifactEnv,
        },
        {
          source: source(),
          store: new MemoryArtifactStore(),
          now: () => new Date(generatedAt),
        },
      ),
    ).rejects.toThrow("Missing required environment variable INDEXER_DEPLOYMENT_ID");
  });

  test("requires Hasura env variables before constructing the publisher source", () => {
    expect(() =>
      createMetricsSourceFromEnv({
        HASURA_GRAPHQL_ADMIN_SECRET: "secret",
      }),
    ).toThrow("Missing required environment variable HASURA_GRAPHQL_ENDPOINT");

    expect(() =>
      createMetricsSourceFromEnv({
        HASURA_GRAPHQL_ENDPOINT: "http://hasura.internal/v1/graphql",
        HASURA_GRAPHQL_ADMIN_SECRET: "   ",
      }),
    ).toThrow("Missing required environment variable HASURA_GRAPHQL_ADMIN_SECRET");
  });

  test("requires artifact storage env variables before constructing the publisher store", () => {
    for (const name of Object.keys(validPublisherArtifactEnv)) {
      expect(() =>
        createArtifactStoreFromEnv({
          ...validPublisherArtifactEnv,
          [name]: "",
        }),
      ).toThrow(`Missing required environment variable ${name}`);
    }

    expect(() =>
      createArtifactStoreFromEnv({
        ...validPublisherArtifactEnv,
        ARTIFACT_BUCKET: "   ",
      }),
    ).toThrow("Missing required environment variable ARTIFACT_BUCKET");
  });

  test("treats blank optional publisher date environment variables as unset", async () => {
    const store = new MemoryArtifactStore();
    await store.putJson("v2/manifest.json", existingCurrentDeploymentManifest);

    const result = await publishMetricsArtifactsFromEnv(
      {
        HASURA_GRAPHQL_ENDPOINT: "http://hasura.internal/v1/graphql",
        HASURA_GRAPHQL_ADMIN_SECRET: "secret",
        ...validPublisherArtifactEnv,
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

  test("Hasura source uses cross-chain complete snapshots for incremental publish bounds", async () => {
    let requestBody: { query?: string } | undefined;
    const source = new HasuraGraphqlMetricsSource({
      endpoint: "http://hasura.internal/v1/graphql",
      adminSecret: "secret",
      fetchFn: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            data: {
              earliest: [{ date: "2026-05-01" }],
              latest: [{ date: "2026-05-31" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await expect(source.fetchBounds()).resolves.toEqual({
      earliestDate: "2026-05-01",
      latestDate: "2026-05-31",
    });
    expect(requestBody?.query).toContain("crossChainComplete");
    expect(requestBody?.query).toContain("_eq: true");
  });

  test("Hasura source uses all supported chain ids for first deployment publish bounds", async () => {
    let requestBody: { query?: string } | undefined;
    const source = new HasuraGraphqlMetricsSource({
      endpoint: "http://hasura.internal/v1/graphql",
      adminSecret: "secret",
      fetchFn: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            data: {
              earliest: [{ date: "2026-05-01" }],
              latest: [{ date: "2026-05-31" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await expect(source.fetchBounds("all_chains")).resolves.toEqual({
      earliestDate: "2026-05-01",
      latestDate: "2026-05-31",
    });
    expect(requestBody?.query).toContain("chainsIndexed");
    expect(requestBody?.query).toContain("_contains: [42161, 1, 250, 137, 8453, 80094]");
  });

  test("Hasura source reports latest indexing progress per chain", async () => {
    let requestBody: { query?: string } | undefined;
    const source = new HasuraGraphqlMetricsSource({
      endpoint: "http://hasura.internal/v1/graphql",
      adminSecret: "secret",
      fetchFn: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            data: {
              arbitrumProgress: [{ date: "2026-05-30", block: "123" }],
              ethereumProgress: [{ date: "2026-05-31", block: "456" }],
              fantomProgress: [],
              polygonProgress: [],
              baseProgress: [{ date: "2026-06-01", block: "789" }],
              berachainProgress: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await expect(source.fetchLatestIndexingProgress()).resolves.toMatchObject({
      chains: {
        Arbitrum: { block: 123, date: "2026-05-30" },
        Ethereum: { block: 456, date: "2026-05-31" },
        Base: { block: 789, date: "2026-06-01" },
      },
    });
    expect(requestBody?.query).toContain("LatestIndexingProgress");
    expect(requestBody?.query).toContain("ChainMetricValues");
    expect(requestBody?.query).toContain("block");
  });

  test("Hasura source reports not-ready when no complete snapshots exist", async () => {
    const source = new HasuraGraphqlMetricsSource({
      endpoint: "http://hasura.internal/v1/graphql",
      adminSecret: "secret",
      fetchFn: async () =>
        new Response(JSON.stringify({ data: { earliest: [], latest: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    await expect(source.fetchBounds()).rejects.toThrow(MetricsNotDataReadyError);
  });
});
