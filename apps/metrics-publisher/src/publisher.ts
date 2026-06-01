import {
  monthKeysForRange,
  resolveDateRange,
  type DateRange,
  type Manifest,
} from "../../../packages/metrics-artifacts/src";
import {
  MemoryArtifactStore,
  S3ArtifactStore,
  artifactEntry,
  type ArtifactEntry,
  type ArtifactStore,
} from "./artifact-store";
import {
  EmptyMetricsSource,
  HasuraGraphqlMetricsSource,
  type MetricsBounds,
  type MetricsSource,
} from "./metrics-source";

export {
  MemoryArtifactStore,
  S3ArtifactStore,
  type ArtifactStore,
  EmptyMetricsSource,
  HasuraGraphqlMetricsSource,
  type MetricsBounds,
  type MetricsSource,
};

export type PublishMode = "full" | "incremental";

export type PublishResult = {
  manifestPublishedLast: boolean;
  range: DateRange;
  writtenKeys: string[];
};

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_GENERATED_AT = "2026-06-01T08:15:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

const SCHEMAS: Record<string, Record<string, unknown>> = {
  "v2/schemas/manifest.schema.json": {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Olympus Metrics Artifact Manifest",
    type: "object",
    required: ["schemaVersion", "generatedAt", "earliestDate", "latestDate", "artifacts"],
    properties: {
      schemaVersion: { type: "string" },
      generatedAt: { type: "string", format: "date-time" },
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
  mode: PublishMode;
  lookbackDays?: number;
  startDate?: string;
  endDate?: string;
  manifest?: Manifest;
  source?: MetricsSource;
  store?: ArtifactStore;
  now?: () => Date;
}): Promise<PublishResult> {
  const source = input.source ?? new EmptyMetricsSource();
  const store = input.store ?? new MemoryArtifactStore();
  const bounds = input.manifest ?? (await source.fetchBounds());
  const range = resolvePublishRange(input, bounds);
  const generatedAt = (input.now?.() ?? new Date(DEFAULT_GENERATED_AT)).toISOString();
  const [metrics, treasuryAssets, ohmSupply] = await Promise.all([
    source.fetchDailyMetrics(range),
    source.fetchTreasuryAssets(range),
    source.fetchOhmSupply(range),
  ]);

  const writtenKeys: string[] = [];
  const artifacts: Record<string, ArtifactEntry> = {};

  const writeArtifact = async (key: string, value: unknown, rowCount: number): Promise<void> => {
    artifacts[key] = artifactEntry(value, rowCount);
    await store.putJson(key, value);
    writtenKeys.push(key);
  };

  for (const [key, schema] of Object.entries(SCHEMAS)) {
    await writeArtifact(key, schema, 0);
  }

  for (const month of monthKeysForRange(range)) {
    const metricRows = metrics.filter((row) => row.date.startsWith(month));
    const treasuryAssetRows = treasuryAssets.filter((row) => row.date.startsWith(month));
    const ohmSupplyRows = ohmSupply.filter((row) => row.date.startsWith(month));

    await writeArtifact(`v2/metrics/daily/${month}.json`, metricRows, metricRows.length);
    await writeArtifact(`v2/treasury-assets/daily/${month}.json`, treasuryAssetRows, treasuryAssetRows.length);
    await writeArtifact(`v2/ohm-supply/daily/${month}.json`, ohmSupplyRows, ohmSupplyRows.length);
  }

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    earliestDate: bounds.earliestDate,
    latestDate: bounds.latestDate,
    artifacts,
  };

  await store.putJson("v2/manifest.json", manifest);
  writtenKeys.push("v2/manifest.json");

  return {
    manifestPublishedLast: writtenKeys.at(-1) === "v2/manifest.json",
    range,
    writtenKeys,
  };
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

export async function publishMetricsArtifactsFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<PublishResult> {
  const mode = parsePublishMode(env.PUBLISHER_MODE);
  return publishMetricsArtifacts({
    mode,
    lookbackDays: env.PUBLISHER_LOOKBACK_DAYS === undefined ? undefined : Number(env.PUBLISHER_LOOKBACK_DAYS),
    startDate: env.PUBLISHER_START_DATE,
    endDate: env.PUBLISHER_END_DATE,
    source: createMetricsSourceFromEnv(env),
    store: createArtifactStoreFromEnv(env),
  });
}

function resolvePublishRange(
  input: { mode: PublishMode; lookbackDays?: number; startDate?: string; endDate?: string },
  bounds: MetricsBounds,
): DateRange {
  if (input.mode === "full") {
    return resolveDateRange({
      start: input.startDate ?? bounds.earliestDate,
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
  const start = input.startDate ?? maxDate(bounds.earliestDate, addDays(end, -(lookbackDays - 1)));
  return resolveDateRange({
    start,
    end,
    manifest: { schemaVersion: SCHEMA_VERSION, generatedAt: DEFAULT_GENERATED_AT, ...bounds },
    enforceMaxRange: false,
  });
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function parsePublishMode(value: string | undefined): PublishMode {
  if (value === undefined || value === "") {
    return "incremental";
  }
  if (value === "full" || value === "incremental") {
    return value;
  }
  throw new Error("PUBLISHER_MODE must be either full or incremental.");
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
