import { randomUUID } from "node:crypto";
import {
  monthKeysForRange,
  resolveDateRange,
  type DateRange,
  type Manifest,
} from "../../../packages/metrics-artifacts/src";
import {
  ArtifactNotFoundError,
  MemoryArtifactStore,
  S3ArtifactStore,
  artifactEntry,
  type ArtifactEntry,
  type ArtifactStore,
} from "./artifact-store";
import {
  EmptyMetricsSource,
  HasuraGraphqlMetricsSource,
  MetricsNotDataReadyError,
  type LatestIndexingProgress,
  type MetricsBounds,
  type PublishBoundsCompleteness,
  type MetricsSource,
} from "./metrics-source";

export {
  MemoryArtifactStore,
  S3ArtifactStore,
  type ArtifactStore,
  EmptyMetricsSource,
  HasuraGraphqlMetricsSource,
  MetricsNotDataReadyError,
  type LatestIndexingProgress,
  type MetricsBounds,
  type PublishBoundsCompleteness,
  type MetricsSource,
};

export type PublisherIndexingProgress = {
  chains: LatestIndexingProgress["chains"];
};

export type PublishResult = {
  deletedKeys: string[];
  deploymentId: string;
  indexingProgress?: PublisherIndexingProgress;
  manifestPublishedLast: boolean;
  range?: DateRange;
  skipped: boolean;
  skipReason?: "lock_held" | "not_data_ready";
  runId: string;
  writtenKeys: string[];
};

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_GENERATED_AT = "2026-06-01T08:15:00.000Z";
const DEFAULT_PUBLIC_START_DATE = "2022-05-01";
const DEFAULT_LOCK_TTL_MS = 12 * 60 * 60 * 1000;
const PUBLISHER_LOCK_KEY = "v2/publisher.lock";
const DAY_MS = 24 * 60 * 60 * 1000;

type PublisherLock = {
  runId: string;
  startedAt: string;
  expiresAt: string;
  operation: "initial_backfill" | "incremental_refresh";
};

const SCHEMAS: Record<string, Record<string, unknown>> = {
  "v2/schemas/manifest.schema.json": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Olympus Metrics Artifact Manifest",
    type: "object",
    required: ["schemaVersion", "generatedAt", "earliestDate", "latestDate", "artifacts"],
    properties: {
      schemaVersion: { type: "string" },
      generatedAt: { type: "string", format: "date-time" },
      indexerDeploymentId: { type: "string" },
      earliestDate: { type: "string", format: "date" },
      latestDate: { type: "string", format: "date" },
      artifacts: {
        type: "object",
        additionalProperties: {
          type: "object",
          required: ["sha256", "byteLength", "rowCount"],
          properties: {
            sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
            byteLength: { type: "integer", minimum: 0 },
            rowCount: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },
  "v2/schemas/daily-metric.schema.json": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Olympus Daily Metrics Shard",
    type: "array",
    items: { type: "object", required: ["date", "treasuryMarketValue", "crossChainComplete"] },
  },
  "v2/schemas/treasury-asset.schema.json": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Olympus Daily Treasury Assets Shard",
    type: "array",
    items: { type: "object", required: ["id", "date", "blockchain", "token", "value"] },
  },
  "v2/schemas/ohm-supply.schema.json": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Olympus Daily OHM Supply Shard",
    type: "array",
    items: { type: "object", required: ["id", "date", "blockchain", "token", "supplyBalance"] },
  },
};

export async function publishMetricsArtifacts(input: {
  lookbackDays?: number;
  publicStartDate?: string;
  deploymentId: string;
  startDate?: string;
  endDate?: string;
  manifest?: Manifest;
  source?: MetricsSource;
  store?: ArtifactStore;
  now?: () => Date;
  lockTtlMs?: number;
}): Promise<PublishResult> {
  const source = input.source ?? new EmptyMetricsSource();
  const store = input.store ?? new MemoryArtifactStore();
  const now = input.now?.() ?? new Date(DEFAULT_GENERATED_AT);
  const generatedAt = now.toISOString();
  const publicStartDate = input.publicStartDate ?? DEFAULT_PUBLIC_START_DATE;
  const deploymentId = parseDeploymentId(input.deploymentId);
  const lockTtlMs = input.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  if (!Number.isInteger(lockTtlMs) || lockTtlMs < 1) {
    throw new Error("lockTtlMs must be a positive integer.");
  }
  const existingManifest = input.manifest ?? (await getExistingManifest(store));
  const operation = existingManifest === undefined ? "initial_backfill" : "incremental_refresh";
  const hasPublishedDeploymentArtifacts = deploymentHasPublishedArtifacts(existingManifest, deploymentId);
  const lock = await acquirePublisherLock({
    store,
    operation,
    now,
    ttlMs: lockTtlMs,
  });
  if (!lock.acquired) {
    return {
      manifestPublishedLast: false,
      deletedKeys: [],
      deploymentId,
      indexingProgress: {
        chains: {},
      },
      skipped: true,
      skipReason: "lock_held",
      runId: lock.runId,
      writtenKeys: [],
    };
  }

  try {
    let bounds: MetricsBounds;
    const publishBoundsCompleteness = hasPublishedDeploymentArtifacts ? "cross_chain" : "all_chains";
    const latestIndexingProgress = await source.fetchLatestIndexingProgress();
    const indexingProgress: PublisherIndexingProgress = {
      chains: latestIndexingProgress.chains,
    };
    try {
      bounds = await source.fetchBounds(publishBoundsCompleteness);
    } catch (error) {
      if (error instanceof MetricsNotDataReadyError) {
        return {
          manifestPublishedLast: false,
          deletedKeys: [],
          deploymentId,
          indexingProgress,
          skipped: true,
          skipReason: "not_data_ready",
          runId: lock.runId,
          writtenKeys: [],
        };
      }
      throw error;
    }
    const freshForDeploymentHandover =
      hasPublishedDeploymentArtifacts || isFreshForDeploymentHandover(bounds.latestDate, now);
    if (!freshForDeploymentHandover) {
      return {
        manifestPublishedLast: false,
        deletedKeys: [],
        deploymentId,
        indexingProgress,
        skipped: true,
        skipReason: "not_data_ready",
        runId: lock.runId,
        writtenKeys: [],
      };
    }
    const range = resolvePublishRange(input, bounds, existingManifest, publicStartDate, hasPublishedDeploymentArtifacts);
    const [metrics, treasuryAssets, ohmSupply] = await Promise.all([
      source.fetchDailyMetrics(range),
      source.fetchTreasuryAssets(range),
      source.fetchOhmSupply(range),
    ]);

    const writtenKeys: string[] = [];
    let deletedKeys: string[] = [];
    const artifacts: Record<string, ArtifactEntry> = { ...(existingManifest?.artifacts ?? {}) };

    const writeArtifact = async (key: string, value: unknown, rowCount: number): Promise<void> => {
      artifacts[key] = artifactEntry(value, rowCount);
      await store.putJson(key, value);
      writtenKeys.push(key);
    };

    for (const [key, schema] of Object.entries(SCHEMAS)) {
      await writeArtifact(key, schema, 0);
    }

    const dataKey = (kind: "metrics" | "treasury-assets" | "ohm-supply", month: string): string =>
      `v2/deployments/${deploymentId}/${kind}/daily/${month}.json`;

    for (const month of monthKeysForRange(range)) {
      const metricRows = metrics.filter((row) => row.date.startsWith(month));
      const treasuryAssetRows = treasuryAssets.filter((row) => row.date.startsWith(month));
      const ohmSupplyRows = ohmSupply.filter((row) => row.date.startsWith(month));

      await writeArtifact(dataKey("metrics", month), metricRows, metricRows.length);
      await writeArtifact(dataKey("treasury-assets", month), treasuryAssetRows, treasuryAssetRows.length);
      await writeArtifact(dataKey("ohm-supply", month), ohmSupplyRows, ohmSupplyRows.length);
    }

    const earliestDate = maxDate(publicStartDate, minDate(existingManifest?.earliestDate ?? range.start, range.start));
    const latestDate = minDate(maxDate(existingManifest?.latestDate ?? range.end, range.end), bounds.latestDate);
    const manifestArtifacts = pruneArtifactsOutsidePublishedBounds(
      pruneHistoricalDeploymentArtifacts(artifacts, deploymentId),
      earliestDate,
      latestDate,
    );
    const manifest: Manifest = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      indexerDeploymentId: deploymentId,
      earliestDate,
      latestDate,
      artifacts: manifestArtifacts,
    };

    await store.putJson("v2/manifest.json", manifest);
    writtenKeys.push("v2/manifest.json");
    deletedKeys = await cleanupHistoricalDeploymentArtifacts(store, deploymentId);

    return {
      deletedKeys,
      deploymentId,
      indexingProgress,
      manifestPublishedLast: writtenKeys.at(-1) === "v2/manifest.json",
      range,
      skipped: false,
      runId: lock.runId,
      writtenKeys,
    };
  } finally {
    await releasePublisherLock(store, lock.runId);
  }
}

export function createMetricsSourceFromEnv(env: NodeJS.ProcessEnv): HasuraGraphqlMetricsSource {
  return new HasuraGraphqlMetricsSource({
    endpoint: requiredEnv(env, "HASURA_GRAPHQL_ENDPOINT"),
    adminSecret: requiredEnv(env, "HASURA_GRAPHQL_ADMIN_SECRET"),
  });
}

export function createArtifactStoreFromEnv(env: NodeJS.ProcessEnv): S3ArtifactStore {
  return new S3ArtifactStore({
    bucket: requiredEnv(env, "ARTIFACT_BUCKET"),
    endpoint: requiredEnv(env, "ARTIFACT_ENDPOINT"),
    region: requiredEnv(env, "ARTIFACT_REGION"),
    accessKeyId: requiredEnv(env, "ARTIFACT_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv(env, "ARTIFACT_SECRET_ACCESS_KEY"),
  });
}

export async function publishMetricsArtifactsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  deps: { source?: MetricsSource; store?: ArtifactStore; now?: () => Date } = {},
): Promise<PublishResult> {
  const lookbackDays = optionalEnv(env, "PUBLISHER_LOOKBACK_DAYS");
  const lockTtlMs = optionalEnv(env, "PUBLISHER_LOCK_TTL_MS");
  return publishMetricsArtifacts({
    lookbackDays: lookbackDays === undefined ? undefined : Number(lookbackDays),
    publicStartDate: optionalEnv(env, "PUBLISHER_PUBLIC_START_DATE"),
    startDate: optionalEnv(env, "PUBLISHER_START_DATE"),
    endDate: optionalEnv(env, "PUBLISHER_END_DATE"),
    source: deps.source ?? createMetricsSourceFromEnv(env),
    store: deps.store ?? createArtifactStoreFromEnv(env),
    now: deps.now,
    lockTtlMs: lockTtlMs === undefined ? undefined : Number(lockTtlMs),
    deploymentId: requiredEnv(env, "INDEXER_DEPLOYMENT_ID"),
  });
}

function resolvePublishRange(
  input: { lookbackDays?: number; startDate?: string; endDate?: string },
  bounds: MetricsBounds,
  existingManifest: Manifest | undefined,
  publicStartDate: string,
  hasPublishedDeploymentArtifacts: boolean,
): DateRange {
  if (existingManifest === undefined || !hasPublishedDeploymentArtifacts) {
    return resolveDateRange({
      start: input.startDate ?? publicStartDate,
      end: input.endDate ?? bounds.latestDate,
      manifest: { schemaVersion: SCHEMA_VERSION, generatedAt: DEFAULT_GENERATED_AT, ...bounds },
      enforceMaxRange: false,
    });
  }

  const end = input.endDate ?? bounds.latestDate;
  const lookbackDays = input.lookbackDays ?? 3;
  if (!Number.isInteger(lookbackDays) || lookbackDays < 1) {
    throw new Error("lookbackDays must be a positive integer.");
  }
  const catchupBaseDate = minDate(existingManifest.latestDate, bounds.latestDate);
  const start = input.startDate ?? maxDate(publicStartDate, addDays(catchupBaseDate, -(lookbackDays - 1)));
  return resolveDateRange({
    start,
    end,
    manifest: { schemaVersion: SCHEMA_VERSION, generatedAt: DEFAULT_GENERATED_AT, ...bounds },
    enforceMaxRange: false,
  });
}

async function getExistingManifest(store: ArtifactStore): Promise<Manifest | undefined> {
  try {
    return await store.getJson<Manifest>("v2/manifest.json");
  } catch (error) {
    if (error instanceof ArtifactNotFoundError) {
      return undefined;
    }
    throw error;
  }
}

async function cleanupHistoricalDeploymentArtifacts(store: ArtifactStore, currentDeploymentId: string): Promise<string[]> {
  const currentPrefix = `v2/deployments/${currentDeploymentId}/`;
  const keys = await store.listKeys("v2/deployments/");
  const staleKeys = keys.filter((key) => !key.startsWith(currentPrefix));
  for (const key of staleKeys) {
    await store.deleteJson(key);
  }
  return staleKeys;
}

function pruneHistoricalDeploymentArtifacts(
  artifacts: Record<string, ArtifactEntry>,
  currentDeploymentId: string,
): Record<string, ArtifactEntry> {
  const currentPrefix = `v2/deployments/${currentDeploymentId}/`;
  return Object.fromEntries(
    Object.entries(artifacts).filter(([key]) => !key.startsWith("v2/deployments/") || key.startsWith(currentPrefix)),
  );
}

function deploymentHasPublishedArtifacts(manifest: Manifest | undefined, deploymentId: string): boolean {
  if (manifest === undefined) {
    return false;
  }
  return Object.keys(manifest.artifacts ?? {}).some(
    (key) =>
      key.startsWith(`v2/deployments/${deploymentId}/metrics/daily/`) ||
      key.startsWith(`v2/deployments/${deploymentId}/treasury-assets/daily/`) ||
      key.startsWith(`v2/deployments/${deploymentId}/ohm-supply/daily/`),
  );
}

function pruneArtifactsOutsidePublishedBounds(
  artifacts: Record<string, ArtifactEntry>,
  earliestDate: string,
  latestDate: string,
): Record<string, ArtifactEntry> {
  const publishedMonths = new Set(monthKeysForRange({ start: earliestDate, end: latestDate, days: 1 }));
  return Object.fromEntries(
    Object.entries(artifacts).filter(([key]) => {
      const month = dataArtifactMonth(key);
      return month === undefined || publishedMonths.has(month);
    }),
  );
}

function dataArtifactMonth(key: string): string | undefined {
  return (
    key.match(/^v2\/deployments\/[^/]+\/(?:metrics|treasury-assets|ohm-supply)\/daily\/(\d{4}-\d{2})\.json$/)?.[1] ??
    key.match(/^v2\/(?:metrics|treasury-assets|ohm-supply)\/daily\/(\d{4}-\d{2})\.json$/)?.[1]
  );
}

function isFreshForDeploymentHandover(latestDate: string, now: Date): boolean {
  const latestAllowedLagDate = addDays(now.toISOString().slice(0, 10), -1);
  return latestDate >= latestAllowedLagDate;
}

async function acquirePublisherLock(input: {
  store: ArtifactStore;
  operation: PublisherLock["operation"];
  now: Date;
  ttlMs: number;
}): Promise<{ acquired: true; runId: string } | { acquired: false; runId: string }> {
  const runId = randomUUID();
  const lock = buildPublisherLock(runId, input.operation, input.now, input.ttlMs);
  const acquired = await input.store.putJsonIfAbsent(PUBLISHER_LOCK_KEY, lock);
  if (acquired) {
    return { acquired: true, runId };
  }

  const existing = await readPublisherLock(input.store);
  if (existing === undefined || Date.parse(existing.value.expiresAt) > input.now.getTime()) {
    return { acquired: false, runId: existing?.value.runId ?? runId };
  }

  const replaced =
    existing.etag === undefined
      ? await input.store.putJsonIfAbsent(PUBLISHER_LOCK_KEY, lock)
      : await input.store.putJsonIfMatch(PUBLISHER_LOCK_KEY, lock, existing.etag);
  if (!replaced) {
    const current = await readPublisherLock(input.store);
    return { acquired: false, runId: current?.value.runId ?? runId };
  }

  const verified = await readPublisherLock(input.store);
  return verified?.value.runId === runId ? { acquired: true, runId } : { acquired: false, runId };
}

async function readPublisherLock(
  store: ArtifactStore,
): Promise<{ value: PublisherLock; etag?: string } | undefined> {
  try {
    return await store.getJsonWithMetadata<PublisherLock>(PUBLISHER_LOCK_KEY);
  } catch (error) {
    if (error instanceof ArtifactNotFoundError) {
      return undefined;
    }
    throw error;
  }
}

async function releasePublisherLock(store: ArtifactStore, runId: string): Promise<void> {
  const existing = await readPublisherLock(store);
  if (existing?.value.runId === runId && existing.etag !== undefined) {
    await store.deleteJsonIfMatch(PUBLISHER_LOCK_KEY, existing.etag);
    return;
  }
  if (existing?.value.runId === runId) {
    await store.deleteJson(PUBLISHER_LOCK_KEY);
  }
}

function buildPublisherLock(
  runId: string,
  operation: PublisherLock["operation"],
  now: Date,
  ttlMs: number,
): PublisherLock {
  return {
    runId,
    operation,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === "" ? undefined : value;
}

function parseDeploymentId(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("INDEXER_DEPLOYMENT_ID is required.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new Error("INDEXER_DEPLOYMENT_ID may contain only letters, numbers, dots, underscores, and dashes.");
  }
  return trimmed;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
