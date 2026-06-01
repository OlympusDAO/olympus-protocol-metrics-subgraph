# Railway Metrics API Deployment

This deployment keeps Envio, Hasura, Postgres, and the artifact publisher private
inside Railway. Only `metrics-api` should receive a public Railway domain.

## Services

| Service | Public domain | Purpose |
| --- | --- | --- |
| `metrics-api` | Yes | Public REST API, OpenAPI document, and readiness probe. |
| `metrics-publisher` | No | Scheduled artifact generation and upload. |
| `hasura` | No | Private GraphQL access for the publisher only. |
| `indexer` | No | Envio indexer process. |
| Postgres | No | Railway private database service. |

Hasura must use Railway private networking only. Configure publisher-to-Hasura
traffic with the private service hostname, not the public internet hostname.

## Railway Variables

Set secrets only through Railway variables. Do not commit secrets to repository
files, Dockerfiles, OpenAPI output, or generated artifacts.

### Postgres

- `DATABASE_URL`: Railway private Postgres connection string used by Envio and
  Hasura.

### Hasura

- `HASURA_GRAPHQL_DATABASE_URL`: same private Postgres connection string as
  `DATABASE_URL`, or a Railway reference to it.
- `HASURA_GRAPHQL_ADMIN_SECRET`: high-entropy admin secret.
- `HASURA_GRAPHQL_ENABLE_CONSOLE`: must be `false`. The Dockerfile also sets
  this as a default.
- `HASURA_GRAPHQL_ENABLED_LOG_TYPES`: recommended `startup,http-log,webhook-log,websocket-log,query-log`.
- `HASURA_GRAPHQL_CORS_DOMAIN`: omit or restrict to private service callers.

### RPC URLs

Use per-chain variables so rotation can happen independently:

- `RPC_URL_1`: Ethereum.
- `RPC_URL_42161`: Arbitrum.
- `RPC_URL_8453`: Base.
- `RPC_URL_80094`: Berachain.
- `RPC_URL_137`: Polygon.
- `RPC_URL_250`: Fantom.

### Artifact Storage

The publisher writes immutable monthly JSON shards before publishing the manifest.
The API reads from the same bucket.

- `ARTIFACT_BUCKET`: bucket name.
- `ARTIFACT_ENDPOINT`: S3-compatible endpoint, for example Cloudflare R2.
- `ARTIFACT_REGION`: S3 region. Use `auto` for Cloudflare R2.
- `ARTIFACT_ACCESS_KEY_ID`: bucket access key.
- `ARTIFACT_SECRET_ACCESS_KEY`: bucket secret key.
- `ARTIFACT_PUBLIC_BASE_URL`: public CDN origin for immutable artifacts, if the
  API redirects or references artifact URLs.

### Publisher

- `PUBLISHER_MODE`: `full` for initial publish, `incremental` after launch.
- `PUBLISHER_LOOKBACK_DAYS`: number of recent days to regenerate in incremental
  mode.
- `PUBLISHER_START_DATE`: optional UTC calendar date for full backfills.
- `PUBLISHER_CRON`: documented value is `15 * * * *`; the Railway config sets
  this schedule directly.

### Metrics API

- `METRICS_API_MAX_RANGE_DAYS`: maximum inclusive v2 range. The documented
  default is `366`.
- `METRICS_API_PORT`: optional port override if the runtime does not provide
  `PORT`.
- `ARTIFACT_BUCKET`, `ARTIFACT_ENDPOINT`, `ARTIFACT_REGION`,
  `ARTIFACT_ACCESS_KEY_ID`, and `ARTIFACT_SECRET_ACCESS_KEY`: read-only
  artifact access.

## Cloudflare Cache Rules

Cloudflare should sit in front of the public `metrics-api` domain.

- Cache `GET /v2/metrics/daily*`, `GET /v2/treasury-assets/daily*`, and
  `GET /v2/ohm-supply/daily*` by full URL, including query string.
- Respect origin `Cache-Control`. Range routes currently use an 8-hour TTL
  because indexer data only updates on that cadence.
- Cache `GET /v2/manifest` and `GET /v2/bounds` for a short TTL and allow stale
  revalidation.
- Do not cache `/ready`.
- Do not cache error responses by default.
- Keep `GET` and `HEAD` as the only cacheable methods.

## Cloudflare WAF Rules

Use WAF rules to keep the public surface narrow:

- Allow `GET`, `HEAD`, and `OPTIONS`; block other methods before they reach
  Railway.
- Block requests with bodies for `GET` and `HEAD`.
- Rate-limit abusive traffic by IP and path.
- Block obvious path traversal and non-API paths.
- Keep Hasura, Postgres, the indexer, and the publisher without public domains;
  WAF rules are not a substitute for private Railway networking.
