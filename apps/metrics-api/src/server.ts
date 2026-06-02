import type { IncomingMessage, ServerResponse } from "node:http";

import { ArtifactNotFoundError, type ArtifactReader } from "./artifact-store";
import {
  ALL_CHAIN_IDS,
  buildDailyMetric,
  getOpenApiDocument,
  isCrossChainComplete,
  monthKeysForRange,
  resolveDateRange,
  type ApiErrorResponse,
  type ApiResponse,
  type BoundsResponse,
  type DailyMetric,
  type Manifest,
  type OhmSupply,
  type TreasuryAsset,
  type WundergraphResponse,
} from "../../../packages/metrics-artifacts/src";

export type MetricsApiConfig = {
  maxRangeDays: number;
  manifest?: Manifest;
  artifactReader?: ArtifactReader;
  generatedAt?: string;
};

const LEGACY_OPERATION_PATHS = new Set([
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
]);

const READY_CACHE_CONTROL = "no-store";
const MANIFEST_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=60";
const RANGE_CACHE_CONTROL = "public, max-age=28800, stale-while-revalidate=86400";
const STATIC_CACHE_CONTROL = "public, max-age=3600";

function setCommonHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("vary", "origin");
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
  sendJson(res, status, body);
}

function getUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://metrics-api.local");
}

async function getManifest(config: MetricsApiConfig): Promise<Manifest> {
  if (config.manifest !== undefined) {
    return config.manifest;
  }
  if (config.artifactReader !== undefined) {
    return config.artifactReader.getJson<Manifest>("v2/manifest.json");
  }
  throw new ArtifactNotFoundError("v2/manifest.json");
}

function hasRequestBody(req: IncomingMessage): boolean {
  const contentLength = req.headers["content-length"];
  if (Array.isArray(contentLength)) {
    return contentLength.some((value) => Number(value) > 0);
  }
  if (contentLength !== undefined && Number(contentLength) > 0) {
    return true;
  }
  return req.headers["transfer-encoding"] !== undefined;
}

function emptyResponse<T>(
  config: MetricsApiConfig,
  range: { start: string; end: string; days: number } | undefined,
  data: T,
  manifest: Manifest,
): ApiResponse<T> {
  return {
    data,
    meta: {
      generatedAt: config.generatedAt ?? manifest.generatedAt,
      earliestDate: manifest.earliestDate,
      latestDate: manifest.latestDate,
      ...(range === undefined
        ? {}
        : {
            range: {
              ...range,
              maxDays: config.maxRangeDays,
            },
          }),
    },
  };
}

function resolveV2Range(
  url: URL,
  config: MetricsApiConfig,
  manifest: Manifest,
): { start: string; end: string; days: number } {
  const start = url.searchParams.get("start");
  if (start === null) {
    throw new Error("start is required");
  }

  return resolveDateRange({
    start,
    end: url.searchParams.get("end") ?? undefined,
    manifest,
    maxRangeDays: config.maxRangeDays,
    enforceMaxRange: true,
  });
}

function legacyResponse<T>(data: T | null): WundergraphResponse<T> {
  return { data };
}

function buildEmptyDailyMetric(input: {
  date: string;
  includeRecords: boolean;
  generatedAt: string;
}): DailyMetric {
  return buildDailyMetric({
    date: input.date,
    chainValues: {},
    treasuryAssets: [],
    ohmSupply: [],
    includeRecords: input.includeRecords,
    chainsIndexed: [],
    chainsMissing: ALL_CHAIN_IDS,
    generatedAt: input.generatedAt,
  });
}

function normalizeMetricCompleteness(metric: DailyMetric): DailyMetric {
  const chainsMissing = ALL_CHAIN_IDS.filter((chainId) => !metric.chainsIndexed.includes(chainId));
  return {
    ...metric,
    chainsMissing,
    crossChainComplete: isCrossChainComplete(metric.chainsIndexed),
  };
}

function dateKeysForRange(range: { start: string; days: number }): string[] {
  const start = Date.parse(`${range.start}T00:00:00.000Z`);
  return Array.from({ length: range.days }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

function isInRange(date: string, range: { start: string; end: string }): boolean {
  return date >= range.start && date <= range.end;
}

async function readArtifactRows<T>(
  config: MetricsApiConfig,
  manifest: Manifest,
  range: { start: string; end: string; days: number },
  keyPrefix: string,
): Promise<T[]> {
  if (config.artifactReader === undefined) {
    return [];
  }

  const rows: T[] = [];
  for (const month of monthKeysForRange(range)) {
    try {
      const monthRows = await config.artifactReader.getJson<T[]>(artifactKeyForMonth(manifest, keyPrefix, month));
      rows.push(...monthRows.filter((row) => isInRange((row as { date: string }).date, range)));
    } catch (error) {
      if (!(error instanceof ArtifactNotFoundError)) {
        throw error;
      }
    }
  }
  return rows;
}

function artifactKeyForMonth(manifest: Manifest, keyPrefix: string, month: string): string {
  const deploymentPath = `${keyPrefix.replace(/^v2\//, "")}/${month}.json`;
  if (manifest.indexerDeploymentId !== undefined) {
    const currentDeploymentKey = `v2/deployments/${manifest.indexerDeploymentId}/${deploymentPath}`;
    if (manifest.artifacts?.[currentDeploymentKey] !== undefined) {
      return currentDeploymentKey;
    }
  }

  const stableKey = `${keyPrefix}/${month}.json`;
  if (manifest.artifacts?.[stableKey] !== undefined) {
    return stableKey;
  }

  const deploymentSuffix = `/${deploymentPath}`;
  const deploymentKey = Object.keys(manifest.artifacts ?? {}).find(
    (key) => key.startsWith("v2/deployments/") && key.endsWith(deploymentSuffix),
  );
  return deploymentKey ?? stableKey;
}

function attachMetricRecords(metric: DailyMetric, treasuryAssets: TreasuryAsset[], ohmSupply: OhmSupply[]): DailyMetric {
  const records = buildDailyMetric({
    date: metric.date,
    chainValues: {},
    treasuryAssets,
    ohmSupply,
    includeRecords: true,
    chainsIndexed: metric.chainsIndexed,
    chainsMissing: metric.chainsMissing,
    generatedAt: metric._meta?.timestamp ?? "",
  });
  return {
    ...metric,
    ohmTotalSupplyRecords: records.ohmTotalSupplyRecords,
    ohmCirculatingSupplyRecords: records.ohmCirculatingSupplyRecords,
    ohmFloatingSupplyRecords: records.ohmFloatingSupplyRecords,
    ohmBackedSupplyRecords: records.ohmBackedSupplyRecords,
    treasuryMarketValueRecords: records.treasuryMarketValueRecords,
    treasuryLiquidBackingRecords: records.treasuryLiquidBackingRecords,
  };
}

async function readDailyMetrics(
  config: MetricsApiConfig,
  manifest: Manifest,
  range: { start: string; end: string; days: number },
  includeRecords: boolean,
  generatedAt: string,
): Promise<DailyMetric[]> {
  const metricRows = await readArtifactRows<DailyMetric>(config, manifest, range, "v2/metrics/daily");
  const metricsByDate = new Map(metricRows.map((metric) => [metric.date, normalizeMetricCompleteness(metric)]));
  const treasuryAssets = includeRecords
    ? await readArtifactRows<TreasuryAsset>(config, manifest, range, "v2/treasury-assets/daily")
    : [];
  const ohmSupply = includeRecords
    ? await readArtifactRows<OhmSupply>(config, manifest, range, "v2/ohm-supply/daily")
    : [];

  return dateKeysForRange(range).map((date) => {
    const metric = metricsByDate.get(date);
    if (metric === undefined) {
      return buildEmptyDailyMetric({ date, includeRecords, generatedAt });
    }
    if (!includeRecords) {
      return metric;
    }
    return attachMetricRecords(
      metric,
      treasuryAssets.filter((asset) => asset.date === date),
      ohmSupply.filter((supply) => supply.date === date),
    );
  });
}

function parseLegacyVariables(url: URL): Record<string, unknown> {
  const value = url.searchParams.get("wg_variables");
  if (value === null || value === "") {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
  }
}

function legacyString(variables: Record<string, unknown>, key: string): string | undefined {
  const value = variables[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function resolveLegacyRange(
  pathname: string,
  variables: Record<string, unknown>,
  manifest: Manifest,
): { start: string; end: string; days: number } {
  if (pathname.startsWith("/operations/latest/")) {
    return resolveDateRange({
      start: manifest.latestDate,
      end: manifest.latestDate,
      manifest,
      enforceMaxRange: false,
    });
  }

  if (pathname.startsWith("/operations/earliest/")) {
    return resolveDateRange({
      start: manifest.earliestDate,
      end: manifest.earliestDate,
      manifest,
      enforceMaxRange: false,
    });
  }

  const start = legacyString(variables, "startDate") ?? legacyString(variables, "start") ?? manifest.earliestDate;
  const end = legacyString(variables, "endDate") ?? legacyString(variables, "end") ?? manifest.latestDate;
  return resolveDateRange({
    start,
    end,
    manifest,
    enforceMaxRange: false,
  });
}

async function readLegacyOperation(
  pathname: string,
  variables: Record<string, unknown>,
  config: MetricsApiConfig,
  manifest: Manifest,
): Promise<DailyMetric[] | TreasuryAsset[] | OhmSupply[]> {
  const range = resolveLegacyRange(pathname, variables, manifest);
  if (pathname.endsWith("/tokenRecords")) {
    return readArtifactRows<TreasuryAsset>(config, manifest, range, "v2/treasury-assets/daily");
  }
  if (pathname.endsWith("/tokenSupplies")) {
    return readArtifactRows<OhmSupply>(config, manifest, range, "v2/ohm-supply/daily");
  }

  const includeRecords = variables.includeRecords === true;
  return readDailyMetrics(config, manifest, range, includeRecords, config.generatedAt ?? manifest.generatedAt);
}

export async function handleMetricsApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: MetricsApiConfig,
): Promise<void> {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendError(res, 405, "method_not_allowed", "Only GET, HEAD, and OPTIONS are supported.");
    return;
  }

  if (hasRequestBody(req)) {
    sendError(res, 400, "request_body_not_allowed", "GET and HEAD requests must not include a request body.");
    return;
  }

  const url = getUrl(req);

  if (url.pathname === "/ready") {
    res.setHeader("cache-control", READY_CACHE_CONTROL);
    sendJson(res, 200, { status: "ready" });
    return;
  }

  if (url.pathname === "/openapi.json") {
    res.setHeader("cache-control", STATIC_CACHE_CONTROL);
    sendJson(res, 200, getOpenApiDocument());
    return;
  }

  if (url.pathname === "/docs") {
    res.statusCode = 200;
    res.setHeader("cache-control", STATIC_CACHE_CONTROL);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end("<!doctype html><title>Olympus Protocol Metrics API</title><h1>OpenAPI</h1>");
    return;
  }

  let manifest: Manifest | undefined;
  const getPublishedManifest = async (): Promise<Manifest | undefined> => {
    if (manifest !== undefined) {
      return manifest;
    }
    try {
      manifest = await getManifest(config);
      return manifest;
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        sendError(res, 503, "manifest_not_published", "Metrics artifacts have not been published yet.");
        return undefined;
      }
      sendError(
        res,
        503,
        "manifest_unavailable",
        error instanceof Error ? error.message : "Metrics artifact manifest is unavailable.",
      );
      return undefined;
    }
  };

  if (url.pathname === "/v2/bounds") {
    const publishedManifest = await getPublishedManifest();
    if (publishedManifest === undefined) {
      return;
    }
    const bounds: BoundsResponse = {
      earliestDate: publishedManifest.earliestDate,
      latestDate: publishedManifest.latestDate,
      maxRangeDays: config.maxRangeDays,
      ...(publishedManifest.indexerDeploymentId === undefined
        ? {}
        : { indexerDeploymentId: publishedManifest.indexerDeploymentId }),
    };
    res.setHeader("cache-control", MANIFEST_CACHE_CONTROL);
    sendJson(res, 200, emptyResponse(config, undefined, bounds, publishedManifest));
    return;
  }

  if (url.pathname === "/v2/metrics/daily") {
    try {
      const publishedManifest = await getPublishedManifest();
      if (publishedManifest === undefined) {
        return;
      }
      const range = resolveV2Range(url, config, publishedManifest);
      const includeRecords = url.searchParams.get("includeRecords") === "true";
      const metrics = await readDailyMetrics(
        config,
        publishedManifest,
        range,
        includeRecords,
        config.generatedAt ?? publishedManifest.generatedAt,
      );
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<DailyMetric[]>(config, range, metrics, publishedManifest));
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(res, 400, "invalid_date_range", error instanceof Error ? error.message : "Invalid date range.");
    }
    return;
  }

  if (url.pathname === "/v2/treasury-assets/daily") {
    try {
      const publishedManifest = await getPublishedManifest();
      if (publishedManifest === undefined) {
        return;
      }
      const range = resolveV2Range(url, config, publishedManifest);
      const treasuryAssets = await readArtifactRows<TreasuryAsset>(
        config,
        publishedManifest,
        range,
        "v2/treasury-assets/daily",
      );
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<TreasuryAsset[]>(config, range, treasuryAssets, publishedManifest));
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(res, 400, "invalid_date_range", error instanceof Error ? error.message : "Invalid date range.");
    }
    return;
  }

  if (url.pathname === "/v2/ohm-supply/daily") {
    try {
      const publishedManifest = await getPublishedManifest();
      if (publishedManifest === undefined) {
        return;
      }
      const range = resolveV2Range(url, config, publishedManifest);
      const ohmSupply = await readArtifactRows<OhmSupply>(config, publishedManifest, range, "v2/ohm-supply/daily");
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<OhmSupply[]>(config, range, ohmSupply, publishedManifest));
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(res, 400, "invalid_date_range", error instanceof Error ? error.message : "Invalid date range.");
    }
    return;
  }

  if (url.pathname === "/operations/atBlock/metrics") {
    res.setHeader("deprecation", "true");
    sendJson(res, 501, {
      data: null,
      errors: [{ message: "atBlock queries are not supported by the artifact-backed metrics API." }],
    });
    return;
  }

  if (LEGACY_OPERATION_PATHS.has(url.pathname)) {
    res.setHeader("deprecation", "true");
    let variables: Record<string, unknown>;
    try {
      variables = parseLegacyVariables(url);
    } catch (error) {
      sendError(
        res,
        400,
        "invalid_wg_variables",
        error instanceof Error ? error.message : "Invalid wg_variables JSON.",
      );
      return;
    }
    try {
      const publishedManifest = await getPublishedManifest();
      if (publishedManifest === undefined) {
        return;
      }
      const data = await readLegacyOperation(url.pathname, variables, config, publishedManifest);
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, legacyResponse(data));
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(res, 400, "invalid_legacy_request", error instanceof Error ? error.message : "Invalid legacy request.");
    }
    return;
  }

  sendError(res, 404, "not_found", "Route not found.");
}
