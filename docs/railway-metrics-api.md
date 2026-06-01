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
- `ENVIO_PG_HOST`, `ENVIO_PG_PORT`, `ENVIO_PG_USER`, `ENVIO_PG_PASSWORD`,
  `ENVIO_PG_DATABASE`, and `ENVIO_PG_SCHEMA`: Envio's Postgres connection
  settings. Set these from Railway Postgres private-network variables.
- `ENVIO_PG_SSL_MODE`: set according to the Railway Postgres connection mode.
  Envio accepts `false`, `true`, `require`, `allow`, `prefer`, or
  `verify-full`; it does not accept libpq-style `disable`.
- `ENVIO_PG_MAX_CONNECTIONS`: optional Envio Postgres pool size.

### Hasura

- `HASURA_GRAPHQL_DATABASE_URL`: same private Postgres connection string as
  `DATABASE_URL`, or a Railway reference to it.
- `HASURA_GRAPHQL_ADMIN_SECRET`: high-entropy admin secret.
- `HASURA_GRAPHQL_ENDPOINT`: for the indexer service, set this to the private
  Hasura metadata endpoint, for example
  `http://hasura.railway.internal/v1/metadata`.
- `HASURA_GRAPHQL_ENABLE_CONSOLE`: must be `false`. The Dockerfile also sets
  this as a default.
- `HASURA_GRAPHQL_ENABLED_LOG_TYPES`: recommended `startup,http-log,webhook-log,websocket-log,query-log`.
- `HASURA_GRAPHQL_CORS_DOMAIN`: omit or restrict to private service callers.

### RPC URLs

Use the per-chain `ENVIO_*_RPC_URL` variables consumed by
`apps/indexer/config.yaml` so rotation can happen independently:

- `ENVIO_ETHEREUM_RPC_URL`: Ethereum.
- `ENVIO_ARBITRUM_RPC_URL`: Arbitrum.
- `ENVIO_BASE_RPC_URL`: Base.
- `ENVIO_BERACHAIN_RPC_URL`: Berachain.
- `ENVIO_POLYGON_RPC_URL`: Polygon.
- `ENVIO_FANTOM_RPC_URL`: Fantom.

Envio v3 supports fallback RPCs by adding multiple `rpc` entries in
`apps/indexer/config.yaml` with `for: fallback`. It does not consume
comma-separated fallback URL environment variables. Envio's RPC schema supports
batch/backoff/timeout/polling fields in `config.yaml`; it does not consume
`requests_per_second` environment variables. Any repository-local
`ENVIO_RPC_*` tuning variables are for the snapshot effect RPC client, not
Envio's event ingestion engine.

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

- `HASURA_GRAPHQL_ENDPOINT`: private Railway URL for Hasura GraphQL, for
  example `http://hasura.railway.internal/v1/graphql`.
- `PUBLISHER_PUBLIC_START_DATE`: first public API date, default `2022-05-01`.
- `PUBLISHER_LOOKBACK_DAYS`: number of already-published days to regenerate
  when catching up from the existing manifest latest date.
- `PUBLISHER_LOCK_TTL_MS`: S3 lock timeout for overlapping cron runs. The
  documented default is 12 hours (`43200000`) so a slow first bootstrap is not
  overtaken by the next hourly cron.
- `INDEXER_DEPLOYMENT_ID`: required current indexer deployment identifier. The
  publisher writes data shards under `v2/deployments/<id>/...`, records those
  file keys in the internal manifest, and deletes stale deployment prefixes
  after the new manifest is published.
- `PUBLISHER_START_DATE`: optional UTC calendar date for full backfills.
- `PUBLISHER_END_DATE`: optional UTC calendar end date for controlled
  backfills or re-publishing a bounded window.
- `PUBLISHER_CRON`: documented value is `15 * * * *`; the Railway config sets
  this schedule directly.

The publisher writes `v2/publisher.lock` before reading Hasura. If a new cron
run starts while a previous publish still holds a fresh lock, the new run exits
successfully without writing artifacts. If no manifest exists, the publisher
creates the initial backfill from `PUBLISHER_PUBLIC_START_DATE`; once a manifest
exists, the same cron job publishes an incremental refresh with the configured
lookback. If a publish crashes, a later run can take over after the lock expires.
The manifest is published last, so partial shard uploads are not exposed through
`/v2/bounds`.

The bucket manifest is an internal file index. The API uses it to resolve
deployment-scoped shard keys. It is not exposed as a public route; clients
should use `/v2/bounds` for published date discovery. When present,
`/v2/bounds` also returns the current `indexerDeploymentId` as an opaque data
version for debugging and stale-data checks.

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
- Cache `GET /v2/bounds` for a short TTL and allow stale revalidation.
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
