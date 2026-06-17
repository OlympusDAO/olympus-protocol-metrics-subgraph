import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ALL_CHAIN_IDS,
  type ApiErrorResponse,
  type ApiResponse,
  type BoundsResponse,
  buildDailyMetric,
  type DailyMetric,
  getOpenApiDocument,
  isCrossChainComplete,
  type Manifest,
  monthKeysForRange,
  type OhmSupply,
  type ProtocolMetric,
  resolveDateRange,
  type TreasuryAsset,
  type WundergraphResponse,
} from "../../../packages/metrics-artifacts/src";
import { ArtifactNotFoundError, type ArtifactReader } from "./artifact-store";

export type MetricsApiConfig = {
  maxRangeDays: number;
  manifest?: Manifest;
  artifactReader?: ArtifactReader;
  generatedAt?: string;
};

const LEGACY_OPERATION_PATHS = new Set([
  "/operations/health",
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

const LEGACY_AT_BLOCK_PATHS = new Set([
  "/operations/atBlock/metrics",
  "/operations/atBlock/tokenRecords",
  "/operations/atBlock/tokenSupplies",
  "/operations/atBlock/internal/protocolMetrics",
]);

const READY_CACHE_CONTROL = "no-store";
const BOUNDS_CACHE_CONTROL = "no-store";
const PUBLIC_CACHE_CONTROL = "public, max-age=3600";
const REQUEST_URL_PARSE_BASE = "http://localhost";
const LEGACY_VARIABLE_KEYS = new Set([
  "startDate",
  "start",
  "endDate",
  "end",
  "includeRecords",
  "crossChainDataComplete",
]);
const LEGACY_IGNORED_VARIABLE_KEYS = new Set(["dateOffset"]);

const SUPPORTED_QUERY_PARAMS = new Map<string, readonly string[]>([
  ["/openapi.json", []],
  ["/docs", []],
  ["/operations/health", []],
  ["/ready", []],
  ["/v2/bounds", []],
  ["/v2/metrics/daily", ["start", "end", "includeRecords"]],
  ["/v2/ohm-supply/daily", ["start", "end"]],
  ["/v2/treasury-assets/daily", ["start", "end"]],
]);

function setCommonHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("vary", "origin");
}

function sendBody(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
): void {
  res.statusCode = status;
  res.setHeader("content-type", contentType);
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(body);
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, value: unknown): void {
  sendBody(req, res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function sendError(
  req: IncomingMessage,
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
  sendJson(req, res, status, body);
}

function getUrl(req: IncomingMessage): URL | undefined {
  try {
    return new URL(req.url ?? "/", REQUEST_URL_PARSE_BASE);
  } catch {
    return undefined;
  }
}

function supportedQueryParamsForPath(pathname: string): readonly string[] | undefined {
  if (pathname.startsWith("/operations/")) {
    return ["wg_variables"];
  }
  return SUPPORTED_QUERY_PARAMS.get(pathname);
}

function validateQueryParams(url: URL): { code: string; message: string } | undefined {
  const supportedKeys = supportedQueryParamsForPath(url.pathname);
  if (supportedKeys === undefined) {
    return undefined;
  }

  const supportedKeySet = new Set(supportedKeys);
  const unsupportedKeys = Array.from(
    new Set([...url.searchParams.keys()].filter((key) => !supportedKeySet.has(key))),
  );
  if (unsupportedKeys.length > 0) {
    return {
      code: "unsupported_query_parameter",
      message: `Unsupported query parameter(s): ${unsupportedKeys.join(", ")}`,
    };
  }

  for (const key of supportedKeys) {
    if (url.searchParams.getAll(key).length > 1) {
      return {
        code: "duplicate_query_parameter",
        message: `Duplicate query parameter is not supported: ${key}`,
      };
    }
  }
  return undefined;
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

function legacyResponse<T>(data: T): WundergraphResponse<T> {
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
      const monthRows = await config.artifactReader.getJson<T[]>(
        artifactKeyForMonth(manifest, keyPrefix, month),
      );
      rows.push(...monthRows.filter((row) => isInRange((row as { date: string }).date, range)));
    } catch (error) {
      if (!(error instanceof ArtifactNotFoundError)) {
        throw error;
      }
    }
  }
  return rows;
}

async function readSelectedDailyRecords<
  T extends { date: string; block: number; blockchain: string },
>(
  config: MetricsApiConfig,
  manifest: Manifest,
  range: { start: string; end: string; days: number },
  keyPrefix: string,
): Promise<T[]> {
  const [metricRows, records] = await Promise.all([
    readArtifactRows<DailyMetric>(config, manifest, range, "v2/metrics/daily"),
    readArtifactRows<T>(config, manifest, range, keyPrefix),
  ]);
  const metricsByDate = new Map(
    metricRows.map((metric) => [metric.date, normalizeMetricCompleteness(metric)]),
  );
  return records.filter((record) => {
    const metric = metricsByDate.get(record.date);
    return metric !== undefined && isSelectedMetricBlock(metric, record);
  });
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

function isSelectedMetricBlock(
  metric: DailyMetric,
  record: { block: number; blockchain: string },
): boolean {
  const metricBlock = (metric.blocks as Partial<Record<string, number>> | undefined)?.[
    record.blockchain
  ];
  return metricBlock !== undefined && metricBlock !== 0 && Number(record.block) === metricBlock;
}

function attachMetricRecords(
  metric: DailyMetric,
  treasuryAssets: TreasuryAsset[],
  ohmSupply: OhmSupply[],
): DailyMetric {
  const selectedTreasuryAssets = treasuryAssets.filter((asset) =>
    isSelectedMetricBlock(metric, asset),
  );
  const selectedOhmSupply = ohmSupply.filter((supply) => isSelectedMetricBlock(metric, supply));
  const records = buildDailyMetric({
    date: metric.date,
    chainValues: {},
    treasuryAssets: selectedTreasuryAssets,
    ohmSupply: selectedOhmSupply,
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
  const metricRows = await readArtifactRows<DailyMetric>(
    config,
    manifest,
    range,
    "v2/metrics/daily",
  );
  const metricsByDate = new Map(
    metricRows.map((metric) => [metric.date, normalizeMetricCompleteness(metric)]),
  );
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

  return validateLegacyVariables(parseLegacyVariablesJson(value));
}

function parseLegacyVariablesJson(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = JSON.parse(decodeURIComponent(value));
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("wg_variables must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function validateLegacyVariables(variables: Record<string, unknown>): Record<string, unknown> {
  const unsupportedKeys = Object.keys(variables).filter(
    (key) => !LEGACY_VARIABLE_KEYS.has(key) && !LEGACY_IGNORED_VARIABLE_KEYS.has(key),
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`Unsupported wg_variables field(s): ${unsupportedKeys.join(", ")}`);
  }
  return Object.fromEntries(
    Object.entries(variables).filter(([key]) => LEGACY_VARIABLE_KEYS.has(key)),
  );
}

function legacyString(variables: Record<string, unknown>, key: string): string | undefined {
  const value = variables[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function resolveLegacyRange(
  pathname: string,
  variables: Record<string, unknown>,
  manifest: Manifest,
  maxRangeDays: number,
): { start: string; end: string; days: number } | undefined {
  if (pathname.startsWith("/operations/latest/")) {
    return resolveDateRange({
      start: manifest.latestDate,
      end: manifest.latestDate,
      manifest,
      maxRangeDays,
      enforceMaxRange: true,
    });
  }

  if (pathname.startsWith("/operations/earliest/")) {
    return resolveDateRange({
      start: manifest.earliestDate,
      end: manifest.earliestDate,
      manifest,
      maxRangeDays,
      enforceMaxRange: true,
    });
  }

  const start =
    legacyString(variables, "startDate") ??
    legacyString(variables, "start") ??
    manifest.earliestDate;
  const end =
    legacyString(variables, "endDate") ?? legacyString(variables, "end") ?? manifest.latestDate;
  const requestedRange = resolveDateRange({
    start,
    end,
    manifest,
    maxRangeDays,
    enforceMaxRange: true,
  });
  if (requestedRange.end < manifest.earliestDate || requestedRange.start > manifest.latestDate) {
    return undefined;
  }

  return resolveDateRange({
    start:
      requestedRange.start < manifest.earliestDate ? manifest.earliestDate : requestedRange.start,
    end: requestedRange.end > manifest.latestDate ? manifest.latestDate : requestedRange.end,
    manifest,
    maxRangeDays,
    enforceMaxRange: true,
  });
}

function legacyRowsDescending<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

function dailyMetricToProtocolMetric(metric: DailyMetric): ProtocolMetric {
  const block = (metric.blocks as Partial<Record<string, number>> | undefined)?.Ethereum ?? 0;
  const timestamp =
    (metric.timestamps as Partial<Record<string, number>> | undefined)?.Ethereum ?? 0;
  const gOhmTotalSupply = metric.ohmIndex === 0 ? 0 : metric.ohmTotalSupply / metric.ohmIndex;

  return {
    id: `protocol-metric-${metric.date}`,
    block,
    currentAPY: metric.ohmApy,
    currentIndex: metric.ohmIndex,
    date: metric.date,
    gOhmPrice: metric.gOhmPrice,
    gOhmTotalSupply,
    nextDistributedOhm: 0,
    nextEpochRebase: 0,
    ohmPrice: metric.ohmPrice,
    ohmTotalSupply: metric.ohmTotalSupply,
    sOhmCirculatingSupply: metric.sOhmCirculatingSupply,
    timestamp,
    totalValueLocked: metric.sOhmTotalValueLocked,
  };
}

async function readLegacyOperation(
  pathname: string,
  variables: Record<string, unknown>,
  config: MetricsApiConfig,
  manifest: Manifest,
): Promise<DailyMetric | DailyMetric[] | TreasuryAsset[] | OhmSupply[] | ProtocolMetric[]> {
  const range = resolveLegacyRange(pathname, variables, manifest, config.maxRangeDays);
  if (range === undefined) {
    return [];
  }

  if (pathname.endsWith("/tokenRecords")) {
    return legacyRowsDescending(
      await readSelectedDailyRecords<TreasuryAsset>(
        config,
        manifest,
        range,
        "v2/treasury-assets/daily",
      ),
    );
  }
  if (pathname.endsWith("/tokenSupplies")) {
    return legacyRowsDescending(
      await readSelectedDailyRecords<OhmSupply>(config, manifest, range, "v2/ohm-supply/daily"),
    );
  }

  const includeRecords = variables.includeRecords === true;
  const metrics = await readDailyMetrics(
    config,
    manifest,
    range,
    includeRecords,
    config.generatedAt ?? manifest.generatedAt,
  );
  const filteredMetrics =
    variables.crossChainDataComplete === true
      ? metrics.filter((metric) => metric.crossChainComplete)
      : metrics;
  if (pathname.endsWith("/metrics") && !pathname.startsWith("/operations/paginated/")) {
    return filteredMetrics[0] === undefined
      ? buildEmptyDailyMetric({
          date: range.start,
          includeRecords,
          generatedAt: config.generatedAt ?? manifest.generatedAt,
        })
      : filteredMetrics[0];
  }
  if (pathname.endsWith("/protocolMetrics")) {
    return legacyRowsDescending(filteredMetrics.map(dailyMetricToProtocolMetric));
  }
  return legacyRowsDescending(filteredMetrics);
}

export async function handleMetricsApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: MetricsApiConfig,
): Promise<void> {
  try {
    await handleMetricsApiRequestUnchecked(req, res, config);
  } catch {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    setCommonHeaders(res);
    res.removeHeader("content-encoding");
    res.removeHeader("content-length");
    res.setHeader("cache-control", "no-store");
    sendError(req, res, 500, "internal_server_error", "Internal server error.");
  }
}

async function handleMetricsApiRequestUnchecked(
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
    sendError(req, res, 405, "method_not_allowed", "Only GET, HEAD, and OPTIONS are supported.");
    return;
  }

  if (hasRequestBody(req)) {
    sendError(
      req,
      res,
      400,
      "request_body_not_allowed",
      "GET and HEAD requests must not include a request body.",
    );
    return;
  }

  const url = getUrl(req);
  if (url === undefined) {
    sendError(req, res, 400, "invalid_request_url", "Request URL is invalid.");
    return;
  }
  const queryParamError = validateQueryParams(url);
  if (queryParamError !== undefined) {
    sendError(req, res, 400, queryParamError.code, queryParamError.message);
    return;
  }

  if (url.pathname === "/ready") {
    res.setHeader("cache-control", READY_CACHE_CONTROL);
    sendJson(req, res, 200, { status: "ready" });
    return;
  }

  if (url.pathname === "/openapi.json") {
    res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
    sendJson(req, res, 200, getOpenApiDocument());
    return;
  }

  if (url.pathname === "/docs") {
    res.statusCode = 200;
    res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
    sendBody(
      req,
      res,
      200,
      "text/html; charset=utf-8",
      "<!doctype html><title>Olympus Protocol Metrics API</title><h1>OpenAPI</h1>",
    );
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
        sendError(
          req,
          res,
          503,
          "manifest_not_published",
          "Metrics artifacts have not been published yet.",
        );
        return undefined;
      }
      console.error("Metrics artifact manifest is unavailable.", error);
      sendError(req, res, 503, "manifest_unavailable", "Metrics artifact manifest is unavailable.");
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
      ...(publishedManifest.indexingProgress === undefined
        ? {}
        : { indexingProgress: publishedManifest.indexingProgress }),
    };
    res.setHeader("cache-control", BOUNDS_CACHE_CONTROL);
    sendJson(req, res, 200, emptyResponse(config, undefined, bounds, publishedManifest));
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
      res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
      sendJson(
        req,
        res,
        200,
        emptyResponse<DailyMetric[]>(config, range, metrics, publishedManifest),
      );
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(
        req,
        res,
        400,
        "invalid_date_range",
        error instanceof Error ? error.message : "Invalid date range.",
      );
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
      const treasuryAssets = await readSelectedDailyRecords<TreasuryAsset>(
        config,
        publishedManifest,
        range,
        "v2/treasury-assets/daily",
      );
      res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
      sendJson(
        req,
        res,
        200,
        emptyResponse<TreasuryAsset[]>(config, range, treasuryAssets, publishedManifest),
      );
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(
        req,
        res,
        400,
        "invalid_date_range",
        error instanceof Error ? error.message : "Invalid date range.",
      );
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
      const ohmSupply = await readSelectedDailyRecords<OhmSupply>(
        config,
        publishedManifest,
        range,
        "v2/ohm-supply/daily",
      );
      res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
      sendJson(
        req,
        res,
        200,
        emptyResponse<OhmSupply[]>(config, range, ohmSupply, publishedManifest),
      );
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(
        req,
        res,
        400,
        "invalid_date_range",
        error instanceof Error ? error.message : "Invalid date range.",
      );
    }
    return;
  }

  if (LEGACY_AT_BLOCK_PATHS.has(url.pathname)) {
    res.setHeader("deprecation", "true");
    sendJson(req, res, 501, {
      data: null,
      errors: [
        { message: "atBlock queries are not supported by the artifact-backed metrics API." },
      ],
    });
    return;
  }

  if (url.pathname === "/operations/health") {
    res.setHeader("deprecation", "true");
    res.setHeader("cache-control", READY_CACHE_CONTROL);
    sendJson(
      req,
      res,
      200,
      legacyResponse({ status: "ok", timestamp: new Date().toISOString(), version: "3.0.0" }),
    );
    return;
  }

  if (LEGACY_OPERATION_PATHS.has(url.pathname)) {
    res.setHeader("deprecation", "true");
    let variables: Record<string, unknown>;
    try {
      variables = parseLegacyVariables(url);
    } catch (error) {
      sendError(
        req,
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
      res.setHeader("cache-control", PUBLIC_CACHE_CONTROL);
      sendJson(req, res, 200, legacyResponse(data));
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        return;
      }
      sendError(
        req,
        res,
        400,
        "invalid_legacy_request",
        error instanceof Error ? error.message : "Invalid legacy request.",
      );
    }
    return;
  }

  sendError(req, res, 404, "not_found", "Route not found.");
}
