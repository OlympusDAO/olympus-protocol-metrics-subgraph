type OpenApiParameter = {
  name: string;
  in: "query";
  required?: boolean;
  deprecated?: boolean;
  schema: Record<string, unknown>;
  description?: string;
};

function jsonResponse(description: string): Record<string, unknown> {
  return {
    description,
    content: {
      "application/json": {
        schema: {},
      },
    },
  };
}

const rangeParameters: OpenApiParameter[] = [
  {
    name: "start",
    in: "query",
    required: true,
    schema: { type: "string", format: "date" },
    description: "Inclusive UTC calendar start date.",
  },
  {
    name: "end",
    in: "query",
    schema: { type: "string", format: "date" },
    description: "Inclusive UTC calendar end date. Defaults to the latest published date.",
  },
];

const legacyVariablesParameter: OpenApiParameter = {
  name: "wg_variables",
  in: "query",
  schema: { type: "string" },
  description: "JSON-encoded legacy WunderGraph variables. dateOffset is accepted and ignored.",
};

export function getOpenApiDocument(): {
  openapi: string;
  info: Record<string, string>;
  paths: Record<string, Record<string, unknown>>;
} {
  const deprecatedOperation = (summary: string) => ({
    deprecated: true,
    summary,
    parameters: [legacyVariablesParameter],
    responses: {
      "200": jsonResponse("Legacy WunderGraph-compatible response."),
      "400": jsonResponse("Invalid request."),
    },
  });
  const deprecatedAtBlockOperation = (summary: string) => ({
    deprecated: true,
    summary,
    parameters: [legacyVariablesParameter],
    responses: {
      "501": jsonResponse("atBlock queries are not supported by the artifact-backed API."),
    },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "Olympus Protocol Metrics API",
      version: "2.0.0",
      description:
        "Cacheable REST API for Olympus protocol metrics, treasury assets, and OHM supply. /operations routes are deprecated compatibility routes.",
    },
    paths: {
      "/ready": {
        get: {
          summary: "Readiness probe",
          responses: { "200": jsonResponse("API is ready.") },
        },
      },
      "/v2/bounds": {
        get: {
          summary: "Published date bounds",
          responses: {
            "200": jsonResponse("Earliest/latest dates, maximum v2 range, and latest per-chain indexing progress."),
          },
        },
      },
      "/v2/metrics/daily": {
        get: {
          summary: "Daily protocol metrics",
          parameters: [
            ...rangeParameters,
            {
              name: "includeRecords",
              in: "query",
              schema: { type: "boolean", default: false },
              description: "Include metric-specific treasury asset and OHM supply records.",
            },
          ],
          responses: {
            "200": jsonResponse("Daily metrics."),
            "400": jsonResponse("Invalid date range."),
          },
        },
      },
      "/v2/treasury-assets/daily": {
        get: {
          summary: "Daily treasury assets",
          parameters: rangeParameters,
          responses: {
            "200": jsonResponse("Treasury assets."),
            "400": jsonResponse("Invalid date range."),
          },
        },
      },
      "/v2/ohm-supply/daily": {
        get: {
          summary: "Daily OHM supply",
          parameters: rangeParameters,
          responses: {
            "200": jsonResponse("OHM supply records."),
            "400": jsonResponse("Invalid date range."),
          },
        },
      },
      "/operations/latest/metrics": {
        get: deprecatedOperation("Latest protocol metrics."),
      },
      "/operations/earliest/metrics": {
        get: deprecatedOperation("Earliest protocol metrics."),
      },
      "/operations/paginated/metrics": {
        get: deprecatedOperation("Daily protocol metrics from a start date to optional end date."),
      },
      "/operations/latest/tokenRecords": {
        get: deprecatedOperation("Latest treasury assets using the legacy tokenRecords shape."),
      },
      "/operations/earliest/tokenRecords": {
        get: deprecatedOperation("Earliest treasury assets using the legacy tokenRecords shape."),
      },
      "/operations/paginated/tokenRecords": {
        get: deprecatedOperation("Treasury assets using the legacy tokenRecords shape."),
      },
      "/operations/latest/tokenSupplies": {
        get: deprecatedOperation("Latest OHM supply using the legacy tokenSupplies shape."),
      },
      "/operations/earliest/tokenSupplies": {
        get: deprecatedOperation("Earliest OHM supply using the legacy tokenSupplies shape."),
      },
      "/operations/paginated/tokenSupplies": {
        get: deprecatedOperation("OHM supply using the legacy tokenSupplies shape."),
      },
      "/operations/latest/protocolMetrics": {
        get: deprecatedOperation("Latest protocol metrics using the legacy protocolMetrics alias."),
      },
      "/operations/earliest/protocolMetrics": {
        get: deprecatedOperation("Earliest protocol metrics using the legacy protocolMetrics alias."),
      },
      "/operations/paginated/protocolMetrics": {
        get: deprecatedOperation(
          "Protocol metrics from a start date to optional end date using the legacy protocolMetrics alias.",
        ),
      },
      "/operations/atBlock/metrics": {
        get: deprecatedAtBlockOperation("Deprecated atBlock metrics placeholder."),
      },
      "/operations/atBlock/tokenRecords": {
        get: deprecatedAtBlockOperation("Deprecated atBlock tokenRecords placeholder."),
      },
      "/operations/atBlock/tokenSupplies": {
        get: deprecatedAtBlockOperation("Deprecated atBlock tokenSupplies placeholder."),
      },
      "/operations/atBlock/internal/protocolMetrics": {
        get: deprecatedAtBlockOperation("Deprecated atBlock protocolMetrics placeholder."),
      },
    },
  };
}
