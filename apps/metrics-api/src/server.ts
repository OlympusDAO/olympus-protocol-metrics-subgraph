import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildDailyMetric,
  getOpenApiDocument,
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
  generatedAt?: string;
};

const DEFAULT_GENERATED_AT = "2026-06-01T08:15:00.000Z";

const DEFAULT_MANIFEST: Manifest = {
  schemaVersion: "1.0.0",
  generatedAt: DEFAULT_GENERATED_AT,
  earliestDate: "2021-04-29",
  latestDate: "2026-06-01",
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

function getManifest(config: MetricsApiConfig): Manifest {
  return config.manifest ?? DEFAULT_MANIFEST;
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
): ApiResponse<T> {
  const manifest = getManifest(config);
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

function resolveV2Range(url: URL, config: MetricsApiConfig): { start: string; end: string; days: number } {
  const start = url.searchParams.get("start");
  if (start === null) {
    throw new Error("start is required");
  }

  return resolveDateRange({
    start,
    end: url.searchParams.get("end") ?? undefined,
    manifest: getManifest(config),
    maxRangeDays: config.maxRangeDays,
    enforceMaxRange: true,
  });
}

function legacyResponse<T>(data: T | null): WundergraphResponse<T> {
  return { data };
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
  const manifest = getManifest(config);

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

  if (url.pathname === "/v2/manifest") {
    res.setHeader("cache-control", MANIFEST_CACHE_CONTROL);
    sendJson(res, 200, emptyResponse(config, undefined, manifest));
    return;
  }

  if (url.pathname === "/v2/bounds") {
    const bounds: BoundsResponse = {
      earliestDate: manifest.earliestDate,
      latestDate: manifest.latestDate,
      maxRangeDays: config.maxRangeDays,
    };
    res.setHeader("cache-control", MANIFEST_CACHE_CONTROL);
    sendJson(res, 200, emptyResponse(config, undefined, bounds));
    return;
  }

  if (url.pathname === "/v2/metrics/daily") {
    try {
      const range = resolveV2Range(url, config);
      const includeRecords = url.searchParams.get("includeRecords") === "true";
      const metric = buildDailyMetric({
        date: range.start,
        chainValues: {},
        treasuryAssets: [],
        ohmSupply: [],
        includeRecords,
        generatedAt: config.generatedAt ?? manifest.generatedAt,
      });
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<DailyMetric[]>(config, range, [metric]));
    } catch (error) {
      sendError(res, 400, "invalid_date_range", error instanceof Error ? error.message : "Invalid date range.");
    }
    return;
  }

  if (url.pathname === "/v2/treasury-assets/daily") {
    try {
      const range = resolveV2Range(url, config);
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<TreasuryAsset[]>(config, range, []));
    } catch (error) {
      sendError(res, 400, "invalid_date_range", error instanceof Error ? error.message : "Invalid date range.");
    }
    return;
  }

  if (url.pathname === "/v2/ohm-supply/daily") {
    try {
      const range = resolveV2Range(url, config);
      res.setHeader("cache-control", RANGE_CACHE_CONTROL);
      sendJson(res, 200, emptyResponse<OhmSupply[]>(config, range, []));
    } catch (error) {
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
    try {
      parseLegacyVariables(url);
    } catch (error) {
      sendError(
        res,
        400,
        "invalid_wg_variables",
        error instanceof Error ? error.message : "Invalid wg_variables JSON.",
      );
      return;
    }
    sendJson(res, 200, legacyResponse([]));
    return;
  }

  sendError(res, 404, "not_found", "Route not found.");
}
