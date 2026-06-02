# Railway Metrics API Deployment

This deployment keeps Envio, Hasura, Postgres, and the artifact publisher private
inside Railway. Only `metrics-api` should receive a public Railway domain.

## Services

| Service | Public domain | Purpose |
| --- | --- | --- |
| `metrics-api` | Yes | Public REST API, OpenAPI document, and readiness probe. |
| `metrics-publisher` | No | Scheduled artifact generation and upload. |
| `hasura` | No | Private GraphQL access for the publisher only. |
| `indexer` | No | Envio indexer process and Envio `/healthz` liveness probe. |
| Postgres | No | Railway private database service. |

Hasura must use Railway private networking only. Configure publisher-to-Hasura
traffic with the private service hostname, not the public internet hostname.

## Railway Variables

Set secrets only through Railway variables. Do not commit secrets to repository
files, Dockerfiles, OpenAPI output, or generated artifacts.

The examples below assume Railway service names of `Postgres`, `hasura`,
`indexer`, `metrics-publisher`, and `metrics-api`. Railway reference variables
are service-name sensitive; if your Railway service uses a different name,
replace the namespace in expressions such as `${{hasura.RAILWAY_PRIVATE_DOMAIN}}`.

Use Railway's Variables tab or raw editor for each service. Variables listed as
`Optional` can be omitted unless you need to override the documented default.

### Setup order

1. Create the Postgres, Hasura, indexer, metrics publisher, and metrics API
   services.
2. Add Postgres first so its generated variables are available for references.
3. Set Hasura variables, including `PORT`.
4. Set indexer variables, pointing `HASURA_GRAPHQL_ENDPOINT` at Hasura's private
   metadata endpoint.
5. Set publisher variables, pointing `HASURA_GRAPHQL_ENDPOINT` at Hasura's
   private GraphQL endpoint.
6. Set metrics API variables and give only `metrics-api` a public Railway
   domain.

### Postgres service

The Railway Postgres service should not receive any `ENVIO_*` variables. It is
the source of private connection values that other services reference.

- Required, Railway-provided `DATABASE_URL`: private Postgres connection
  string. Reference it from Hasura as `HASURA_GRAPHQL_DATABASE_URL` if the URL
  form is suitable.
- Required, Railway-provided host, port, user, password, and database
  variables: use these as references when setting the indexer service's
  `ENVIO_PG_*` variables.

### Hasura service

These variables belong on the private `hasura` service.

- Required `HASURA_GRAPHQL_DATABASE_URL`: private Postgres connection string,
  usually a Railway reference to the Postgres service's `DATABASE_URL`.
- Required `HASURA_GRAPHQL_ADMIN_SECRET`: high-entropy admin secret. Reuse the
  same value on the private indexer and publisher services so they can call
  Hasura.
- Required on Railway `PORT`: Hasura HTTP port. Use `8080` unless there is a
  specific reason to change it. The Dockerfile derives
  `HASURA_GRAPHQL_SERVER_PORT` from `PORT` before Hasura starts.
- Optional `HASURA_GRAPHQL_ENABLE_CONSOLE`: must be `false`. The Dockerfile also
  sets this as a default.
- Optional `HASURA_GRAPHQL_ENABLED_LOG_TYPES`: recommended
  `startup,http-log,webhook-log,websocket-log,query-log`.
- Optional `HASURA_GRAPHQL_CORS_DOMAIN`: omit or restrict to private service
  callers.

Do not set `HASURA_GRAPHQL_ENDPOINT` on the Hasura service. That variable is for
services that call Hasura.

Example Hasura raw variables:

```dotenv
HASURA_GRAPHQL_DATABASE_URL=${{Postgres.DATABASE_URL}}
HASURA_GRAPHQL_ADMIN_SECRET=<shared-hasura-admin-secret>
PORT=8080
```

### Indexer service

These variables belong on the private `indexer` service. The indexer preflight
check requires the core variables below before Envio starts.

- Required `ENVIO_API_TOKEN`: Envio/HyperSync API token.
- Required `ENVIO_PG_HOST`, `ENVIO_PG_PORT`, `ENVIO_PG_USER`,
  `ENVIO_PG_PASSWORD`, and `ENVIO_PG_DATABASE`: Envio's Postgres connection
  settings, usually references to Railway Postgres private-network variables.
- Automatically set on Railway `ENVIO_PG_SCHEMA`: the indexer startup wrapper
  copies Railway's runtime `RAILWAY_DEPLOYMENT_ID` into `ENVIO_PG_SCHEMA` before
  validation and Envio startup. Do not define `ENVIO_PG_SCHEMA` as a Railway
  variable unless you are intentionally overriding this behavior; if
  `RAILWAY_DEPLOYMENT_ID` is present, the preflight check requires the two
  values to match.
- Required `ENVIO_PG_SSL_MODE`: set according to the Railway Postgres
  connection mode. Envio accepts `false`, `true`, `require`, `allow`, `prefer`,
  or `verify-full`; it does not accept libpq-style `disable`.
- Optional `ENVIO_PG_MAX_CONNECTIONS`: Envio Postgres pool size.
- Required on Railway `PORT`: Railway HTTP target port for the indexer
  healthcheck. Use `9898` unless you intentionally need a different port. The
  indexer startup wrapper derives `ENVIO_INDEXER_PORT` from Railway's runtime
  `PORT` before Envio starts.
- Required `HASURA_GRAPHQL_ENDPOINT`: private Hasura metadata endpoint, for
  example `http://hasura.railway.internal:8080/v1/metadata`.
- Required `HASURA_GRAPHQL_ADMIN_SECRET`: same value used by Hasura.
- Required `ENVIO_ETHEREUM_RPC_URL`, `ENVIO_ARBITRUM_RPC_URL`,
  `ENVIO_BASE_RPC_URL`, `ENVIO_BERACHAIN_RPC_URL`, `ENVIO_POLYGON_RPC_URL`, and
  `ENVIO_FANTOM_RPC_URL`: primary per-chain archive RPC URLs.
- Optional `ENVIO_MAX_PARTITION_CONCURRENCY`: Envio concurrency setting.

Example indexer raw variables:

```dotenv
ENVIO_API_TOKEN=<envio-api-token>
ENVIO_PG_HOST=${{Postgres.PGHOST}}
ENVIO_PG_PORT=${{Postgres.PGPORT}}
ENVIO_PG_USER=${{Postgres.PGUSER}}
ENVIO_PG_PASSWORD=${{Postgres.PGPASSWORD}}
ENVIO_PG_DATABASE=${{Postgres.PGDATABASE}}
ENVIO_PG_SSL_MODE=prefer
PORT=9898
HASURA_GRAPHQL_ENDPOINT=http://${{hasura.RAILWAY_PRIVATE_DOMAIN}}:${{hasura.PORT}}/v1/metadata
HASURA_GRAPHQL_ADMIN_SECRET=${{hasura.HASURA_GRAPHQL_ADMIN_SECRET}}
ENVIO_ETHEREUM_RPC_URL=<ethereum-archive-rpc-url>
ENVIO_ARBITRUM_RPC_URL=<arbitrum-archive-rpc-url>
ENVIO_BASE_RPC_URL=<base-archive-rpc-url>
ENVIO_BERACHAIN_RPC_URL=<berachain-archive-rpc-url>
ENVIO_POLYGON_RPC_URL=<polygon-archive-rpc-url>
ENVIO_FANTOM_RPC_URL=<fantom-archive-rpc-url>
```

Railway Postgres variable names can differ depending on how the database service
was created. Use the names exposed by your Postgres service. If it only exposes
`DATABASE_URL`, either split it into the `ENVIO_PG_*` variables above or add a
startup wrapper that derives them before running Envio.

Envio v3 supports fallback RPCs by adding multiple `rpc` entries in
`apps/indexer/config.yaml` with `for: fallback`. It does not consume
comma-separated fallback URL environment variables for event ingestion.
Envio's RPC schema supports batch/backoff/timeout/polling fields in
`config.yaml`; it does not consume `requests_per_second` environment variables
for event ingestion.

This repository's snapshot effect RPC client does consume optional runtime
tuning variables:

- Optional `ENVIO_RPC_HTTP_BATCH_SIZE`, `ENVIO_RPC_MULTICALL_BATCH_SIZE`, and
  `ENVIO_RPC_TIMEOUT_MS`.
- Optional `ENVIO_RPC_REQUESTS_PER_SECOND`, plus chain-specific overrides such
  as `ENVIO_ETHEREUM_RPC_REQUESTS_PER_SECOND`.
- Optional `ENVIO_<CHAIN>_FALLBACK_RPC_URLS`, for example
  `ENVIO_ETHEREUM_FALLBACK_RPC_URLS`, as comma-separated snapshot effect
  fallbacks. These are viem fallback transports for snapshot reads, not Envio's
  primary sync source.

### Metrics publisher service

These variables belong on the private `metrics-publisher` cron service. The
publisher writes immutable monthly JSON shards before publishing the manifest.

- Required `HASURA_GRAPHQL_ENDPOINT`: private Railway URL for Hasura GraphQL,
  for example
  `http://${{hasura.RAILWAY_PRIVATE_DOMAIN}}:${{hasura.PORT}}/v1/graphql`.
- Required `HASURA_GRAPHQL_ADMIN_SECRET`: same value used by Hasura.
- Required `ARTIFACT_BUCKET`: bucket name.
- Required `ARTIFACT_ENDPOINT`: S3-compatible endpoint, for example Cloudflare
  R2.
- Required `ARTIFACT_REGION`: S3 region. Use `auto` for Cloudflare R2.
- Required `ARTIFACT_ACCESS_KEY_ID`: bucket access key.
- Required `ARTIFACT_SECRET_ACCESS_KEY`: bucket secret key.
- Optional `PUBLISHER_PUBLIC_START_DATE`: first public API date, default
  `2022-05-01`.
- Optional `PUBLISHER_LOOKBACK_DAYS`: number of already-published days to
  regenerate when catching up from the existing manifest latest date.
- Optional `PUBLISHER_LOCK_TTL_MS`: S3 lock timeout for overlapping cron runs. The
  documented default is 12 hours (`43200000`) so a slow first bootstrap is not
  overtaken by the next hourly cron.
- Required `INDEXER_DEPLOYMENT_ID`: current indexer deployment identifier. Set
  this on the `metrics-publisher` service as a Railway reference variable to the
  indexer service deployment id, for example
  `${{indexer.RAILWAY_DEPLOYMENT_ID}}` if the Railway service is named
  `indexer`. The publisher writes data shards under `v2/deployments/<id>/...`,
  records those file keys in the internal manifest, and deletes stale deployment
  prefixes after the new manifest is published.
- Optional `PUBLISHER_START_DATE`: UTC calendar date for full backfills.
- Optional `PUBLISHER_END_DATE`: UTC calendar end date for controlled
  backfills or re-publishing a bounded window.
- Optional `PUBLISHER_CRON`: documented value is `15 * * * *`; the Railway
  config sets this schedule directly.

Example metrics publisher raw variables:

```dotenv
HASURA_GRAPHQL_ENDPOINT=http://${{hasura.RAILWAY_PRIVATE_DOMAIN}}:${{hasura.PORT}}/v1/graphql
HASURA_GRAPHQL_ADMIN_SECRET=${{hasura.HASURA_GRAPHQL_ADMIN_SECRET}}
ARTIFACT_BUCKET=<bucket-name>
ARTIFACT_ENDPOINT=<s3-compatible-endpoint>
ARTIFACT_REGION=auto
ARTIFACT_ACCESS_KEY_ID=<bucket-access-key>
ARTIFACT_SECRET_ACCESS_KEY=<bucket-secret-key>
INDEXER_DEPLOYMENT_ID=${{indexer.RAILWAY_DEPLOYMENT_ID}}
```

The publisher writes `v2/publisher.lock` before reading Hasura. If a new cron
run starts while a previous publish still holds a fresh lock, the new run exits
successfully without writing artifacts. If no manifest exists, the publisher
creates the initial backfill from `PUBLISHER_PUBLIC_START_DATE`; once a manifest
exists, the same cron job publishes an incremental refresh with the configured
lookback. If a publish crashes, a later run can take over after the lock expires.
For the first publish of an `INDEXER_DEPLOYMENT_ID`, publisher bounds require
every supported chain id to be present in `chainsIndexed`. Once that deployment
has published snapshots, incremental bounds use `crossChainComplete=true`, which
means Arbitrum and Ethereum have both indexed that UTC date. If Hasura has no
eligible bounds yet, the publisher exits successfully with
`skipReason: "not_data_ready"` and leaves the current manifest and snapshots
untouched.
The first publish for a deployment also requires that latest all-chain date to
be within one day of the publisher's current UTC date. This prevents a new
indexer deployment from taking over the manifest while it is still several days
behind the existing published snapshots.
The manifest is published last, so partial shard uploads are not exposed through
`/v2/bounds`.

The publisher logs one JSON object per run. It includes `deploymentId` and
`indexingProgress` whether the publish writes artifacts or skips. Progress
is intentionally small: `indexingProgress.chains` is keyed by chain name and
each present chain has `{ date, block }` for the latest indexed
`ChainMetricValues` row.

Each Railway config declares `build.watchPatterns` for its runtime ownership.
The indexer watches `apps/indexer/**`; the API watches `apps/metrics-api/**`
and `packages/metrics-artifacts/**`; Hasura watches only its Dockerfile/config.
The publisher also watches indexer source/config/Dockerfile changes in addition
to publisher and shared artifact code. This causes normal monorepo code changes
that redeploy the indexer to redeploy the publisher too, so the referenced
`INDEXER_DEPLOYMENT_ID` is refreshed before the next cron run. If the indexer is
manually redeployed without a code change, verify the rendered publisher
variable or redeploy the publisher before allowing new snapshots.

The bucket manifest is an internal file index. The API uses it to resolve
deployment-scoped shard keys. It is not exposed as a public route; clients
should use `/v2/bounds` for published date discovery. When present,
`/v2/bounds` also returns the current `indexerDeploymentId` as an opaque data
version for debugging and stale-data checks.

### Metrics API

These variables belong on the public `metrics-api` service. The API reads from
the same bucket the publisher writes to.

- Optional `PORT`: Railway normally provides this.
- Optional `METRICS_API_MAX_RANGE_DAYS`: maximum inclusive v2 range. The
  documented default is `366`.
- Optional `METRICS_API_PORT`: port override if the runtime does not provide
  `PORT`.
- Required `ARTIFACT_BUCKET`, `ARTIFACT_ENDPOINT`, `ARTIFACT_REGION`,
  `ARTIFACT_ACCESS_KEY_ID`, and `ARTIFACT_SECRET_ACCESS_KEY`: read-only
  artifact access.

Example metrics API raw variables:

```dotenv
ARTIFACT_BUCKET=<bucket-name>
ARTIFACT_ENDPOINT=<s3-compatible-endpoint>
ARTIFACT_REGION=auto
ARTIFACT_ACCESS_KEY_ID=<read-only-bucket-access-key>
ARTIFACT_SECRET_ACCESS_KEY=<read-only-bucket-secret-key>
```

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
