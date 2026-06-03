# Treasury Subgraph Client Backwards Compatibility

This document defines what `@olympusdao/treasury-subgraph-client@3.0.0`
preserves from `@olympusdao/treasury-subgraph-client@2.0.0`.

The compatibility target is the published `2.0.0` npm package, plus the
deprecated WunderGraph-style `/operations/*` REST API shape that package used.
The goal is that normal TypeScript consumers can upgrade to `3.0.0` without
changing imports or the legacy `query({ operationName, input })` call shape.

## Preserved Package Surface

The package name is unchanged:

```ts
import { createClient, TreasurySubgraphClient } from "@olympusdao/treasury-subgraph-client";
```

The following exports from `2.0.0` are preserved:

- `createClient`
- `TreasurySubgraphClient`
- `ClientConfig`
- `Operations`
- `Queries`
- `WundergraphResponse`
- `Health`
- `ChainValues`
- `SupplyCategoryValues`
- `TokenSupply`
- `TokenRecord`
- `ProtocolMetric`
- `ChainTokenSupplies`
- `ChainTokenRecords`
- `ResponseMetadata`
- `Metric`
- `IgnoreCacheInput`
- `PaginatedMetricsInput`
- `PaginatedTokenRecordsInput`
- `PaginatedTokenSuppliesInput`
- `PaginatedProtocolMetricsInput`
- `AtBlockInput`

`3.0.0` also adds newer semantic exports such as `DailyMetric`,
`TreasuryAsset`, `OhmSupply`, `BoundsResponse`, `DEFAULT_BASE_URL`, and
OpenAPI helpers. Additive exports are not considered a compatibility break.

## Preserved Client Calls

The legacy factory and query shape are preserved:

```ts
const client = createClient({ baseUrl });

const response = await client.query({
  operationName: "paginated/metrics",
  input: {
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    includeRecords: true,
  },
});
```

`query()` still:

- accepts `operationName` and optional `input`
- maps legacy operations to `/operations/<operationName>`
- serializes `input` into the `wg_variables` query parameter
- returns the WunderGraph-compatible `{ data: ... }` response wrapper

The typed legacy helper methods are also preserved and deprecated:

- `getLatestMetrics`
- `getEarliestMetrics`
- `getPaginatedMetrics`
- `getLatestTokenRecords`
- `getEarliestTokenRecords`
- `getPaginatedTokenRecords`
- `getLatestTokenSupplies`
- `getEarliestTokenSupplies`
- `getPaginatedTokenSupplies`
- `getLatestProtocolMetrics`
- `getEarliestProtocolMetrics`
- `getPaginatedProtocolMetrics`

## Preserved Operation Types

The legacy `Operations` mapping keeps the old response cardinality:

- `health` returns `{ data: Health }`
- `latest/metrics` returns `{ data: Metric }`
- `earliest/metrics` returns `{ data: Metric }`
- `paginated/metrics` returns `{ data: Metric[] }`
- `latest/tokenRecords` and `earliest/tokenRecords` return `{ data: TokenRecord[] }`
- `latest/tokenSupplies` and `earliest/tokenSupplies` return `{ data: TokenSupply[] }`
- `latest/protocolMetrics` and `earliest/protocolMetrics` return `{ data: ProtocolMetric[] }`
- `atBlock/metrics` remains typed as `{ data: Metric }`

The runtime API returns `501` for `atBlock/*` routes because the artifact-backed
API does not support block-specific reconstruction. The type remains present so
existing TypeScript code still compiles.

## Preserved Legacy Route Shape

The API keeps these deprecated routes under `/operations/`:

- `/operations/health`
- `/operations/latest/metrics`
- `/operations/earliest/metrics`
- `/operations/paginated/metrics`
- `/operations/latest/tokenRecords`
- `/operations/earliest/tokenRecords`
- `/operations/paginated/tokenRecords`
- `/operations/latest/tokenSupplies`
- `/operations/earliest/tokenSupplies`
- `/operations/paginated/tokenSupplies`
- `/operations/latest/protocolMetrics`
- `/operations/earliest/protocolMetrics`
- `/operations/paginated/protocolMetrics`
- `/operations/atBlock/metrics`
- `/operations/atBlock/tokenRecords`
- `/operations/atBlock/tokenSupplies`
- `/operations/atBlock/internal/protocolMetrics`

Raw chain-specific WunderGraph route names such as
`/operations/tokenRecordsLatest` are intentionally not exposed.

## Preserved Data Shapes

The legacy response object names are preserved:

- `Metric`
- `TokenRecord`
- `TokenSupply`
- `ProtocolMetric`
- `ChainValues`
- `SupplyCategoryValues`
- `ChainTokenRecords`
- `ChainTokenSupplies`
- `ResponseMetadata`

`TokenRecord` is an alias for the newer `TreasuryAsset` type.
`TokenSupply` is an alias for the newer `OhmSupply` type.

The `Metric` type preserves the legacy top-level scalar/component/records
shape. The newer `DailyMetric` type extends that shape with readiness fields
such as `chainsIndexed`, `chainsMissing`, and `crossChainComplete`.

## Intentional Differences

These differences are intentional and should be visible to consumers:

- The default `baseUrl` is now
  `https://treasury-subgraph-api.olympusdao.finance`.
- The API is backed by hourly published artifacts rather than live fan-out to
  Graph subgraphs.
- Legacy paginated operations enforce the API `maxRangeDays` limit. Callers
  requesting larger ranges must paginate or use the v2 helpers with
  `autoPaginate: true`.
- `dateOffset` is accepted for legacy callers but ignored.
- `ignoreCache` is accepted for legacy callers but does not bypass the
  artifact-backed cache.
- `atBlock/*` routes are present for type/route compatibility but return `501`.
- Raw chain-specific WunderGraph routes are not exposed.

## Verification

Before releasing `3.0.0`, compare against the published `2.0.0` package:

```sh
mkdir -p /tmp/treasury-client-compare
npm pack @olympusdao/treasury-subgraph-client@2.0.0 \
  --pack-destination /tmp/treasury-client-compare \
  --cache /tmp/treasury-client-compare/npm-cache
pnpm --dir apps/client run pack:dry-run
```

The release checks should confirm:

- legacy named TypeScript exports are present
- `query({ operationName, input })` maps to `/operations/*`
- legacy operation response types match the `2.0.0` cardinality
- `createClient({ baseUrl })` works without a custom `fetch`
- custom `config.fetch` is still used when provided
- `openapi.json` includes both v2 routes and deprecated legacy routes

