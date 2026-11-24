# Railway Metrics API Deployment

Railway runs Envio, Hasura, Postgres, a persistent RPC cache, and the scheduled
artifact publisher. The metrics API serves published snapshots and its
`/openapi.json` specification, with no HTML documentation site (`/docs` is 404).
REST endpoints remain available. Domain reconciliation requires its separate
review and live approval. See the
[Railway infrastructure definition and plan procedure](../.railway/README.md).

## Services

| Service | Public domain | Purpose |
| --- | --- | --- |
| `metrics-api` | Yes | Public REST API, OpenAPI document, and readiness probe. |
| `metrics-publisher` | No | Scheduled artifact generation and upload. |
| `hasura` | No | Private GraphQL access for the publisher only. |
| `indexer` | No | Envio indexer process and Envio `/healthz` liveness probe. |
| `indexer-monitor` | No | Checks native Envio metrics reachability and sends Discord alerts. |
| Postgres | No | Envio and Hasura database. |
| `rpc-cache` | No | eRPC archive provider routing and finalized-read caching. |
| `rpc-cache-postgres` | No | Persistent cache database on a dedicated volume. |

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

1. Review the whole-project plan and confirm the existing database, bucket, and
   services retain their identities. Follow the [IaC plan procedure](../.railway/README.md).
2. Configure the cache with the seven archive endpoints and verify private
   routing before switching the indexer to the cache.
3. Verify Hasura and indexer readiness, then verify the publisher can produce a
   complete artifact set and the metrics API serves it.

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
- Do not set `ENVIO_PG_SCHEMA` on Railway. The indexer intentionally uses
  Envio's default schema, currently `public`, so each deployment operates on the
  same Envio schema instead of accumulating deployment-specific schemas.
- Startup and crash recovery use plain `envio start` and resume from the
  committed checkpoint. After an unexpected exit, the wrapper waits up to ten
  minutes for Postgres to accept connections before retrying.
- Required `ENVIO_PG_SSL_MODE`: set according to the Railway Postgres
  connection mode. Envio accepts `false`, `true`, `require`, `allow`, `prefer`,
  or `verify-full`; it does not accept libpq-style `disable`.
- Optional `ENVIO_PG_MAX_CONNECTIONS`: Envio Postgres pool size.
- Required on Railway `PORT`: Railway HTTP target port for Envio. Use `9898` unless you intentionally need a different port. The
  indexer startup wrapper derives `ENVIO_INDEXER_PORT` from Railway's runtime
  `PORT` before Envio starts.
- Required `HASURA_GRAPHQL_ENDPOINT`: private Hasura metadata endpoint, for
  example `http://hasura.railway.internal:8080/v1/metadata`.
- Required `HASURA_GRAPHQL_ADMIN_SECRET`: same value used by Hasura.
- The seven `ENVIO_<CHAIN>_RPC_URL` values point to the private cache.
  The same values serve Envio's fallback RPC configuration and snapshot reads.
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
ENVIO_ETHEREUM_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/1
ENVIO_ARBITRUM_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/42161
ENVIO_BASE_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/8453
ENVIO_BERACHAIN_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/80094
ENVIO_POLYGON_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/137
ENVIO_FANTOM_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/250
ENVIO_ROBINHOOD_RPC_URL=http://${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/4663
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

### Indexer monitor service

Railway starts `indexer-monitor` from a dedicated Alpine-based Node image. The
service watches its Dockerfile and monitor script. The monitor needs no
inbound port or indexer credentials. IaC sets `INDEXER_METRICS_URL` to
`http://${{indexer.RAILWAY_PRIVATE_DOMAIN}}:${{indexer.PORT}}/metrics` and labels
messages with Metrics and the Railway environment name.

Set the environment's shared `DISCORD_WEBHOOK_URL` to the intended Discord
webhook before deploying the monitor. Both URLs are required and must use HTTP
or HTTPS without embedded usernames or passwords. Startup validates them before
any requests. Missing or invalid values cause exit status 1 without logging their
values. The optional `MONITOR_INTERVAL_SECONDS` defaults to 60 and accepts whole
numbers from 1 to 2,147,483. The optional `MONITOR_NAME` defaults to `Indexer`;
IaC supplies the project and environment label.

Each probe has a five-second timeout. Two consecutive failed probes trigger one
outage alert per incident in the running monitor process.
The next HTTP 2xx response sends one recovery alert. Active means the native
`/metrics` endpoint is reachable. A backfilling indexer can be active, and
reachability alone provides no evidence of indexing progress or sync. The
monitor never resets the indexer. If the monitor is down or the webhook is
unavailable, Discord can receive no alert. Invalid configuration exits with a
nonzero status. Failed delivery, including a five-second timeout, logs a fixed
message and retries on the next polling interval while the alert remains
relevant. Successful deliveries are not repeated. A lost webhook response can
cause a duplicate message on retry.

### Manual indexer reset

Native Envio refuses incompatible stored configuration or addresses without
resetting them. After the existing database wait and bounded retry policy ends
in a nonzero result, the wrapper keeps its private reset control and container
alive so an operator can SSH in and recover it. This applies to all terminal
nonzero results, including exhausted errors, database-wait failure and spawn
failure; a native exit code does not identify incompatibility specifically.
These paused failures await an explicit restart or reset rather than triggering
Railway's `ON_FAILURE` restart policy. Inspect and fix the cause before restarting;
reset only when a deliberate rebuild is required. Clean completion and intentional
shutdown still terminate the wrapper.

While ingestion is stopped, its native `/healthz` port is unavailable. Source
IaC does not configure an indexer healthcheck, so a running container does not
establish that ingestion is ready.

For an already-running wrapper, reset is an explicit operator action for a
deliberate historical rebuild or a schema-incompatible deployment. It recreates the Envio schema and starts
indexing at the configured chain start blocks. Verify the deployment and
database target before executing the command from the indexer service shell
as the same operating-system user as the running indexer (`node`).

```bash
cd /app/apps/indexer
tsx src/start-envio.ts reset
```

The command uses the wrapper's local Unix socket. The supervisor stops the
ingestion process group, runs Envio's local migration, and starts ingestion
after migration succeeds. If migration fails, ingestion stays paused. Resolve
the failure before retrying the reset. The RPC cache uses its own database
and remains available across an indexer reset.

If the wrapper is fully stopped, native `envio local db-migrate setup` remains
an offline maintenance option with the same config, environment and verified
database target. Start normal ingestion afterwards. Never run it alongside an
active indexer; no deployment or startup resets storage automatically.

A hard kill during stale-socket recovery can leave `reset.sock.recovery-lock`
behind and block a replacement wrapper. Stop the wrapper and confirm no other
wrapper is running before removing only that empty recovery-lock directory and
restarting. Never remove a recovery lock while a wrapper is running.

The metrics API serves the current published manifest during the rebuild. Before
publication resumes after an explicit reset, set the publisher
`INDEXER_DEPLOYMENT_ID` to a fresh value so it regenerates the full historical
range. A reset on the same commit does not change that identity; retaining it
would refresh only recent and unpublished months. The publisher waits for complete,
fresh all-chain data and uploads the regenerated shards before switching the
manifest. Keep the default Envio schema on Railway so every deployment uses the
existing index database.

### RPC cache service

Set `UPSTREAM_RPC_URL_<chain ID>` on `rpc-cache` for chain IDs 1, 137, 250,
8453, 42161, 80094, and 4663. Use archive endpoints that serve the indexer's
historical blocks. `RPC_CACHE_DATABASE_URL` references the dedicated cache
Postgres service. Keep the RPC and metrics ports private.

eRPC permanently stores eligible historical reads only when the provider
reports them finalized. Providers without a usable finalized tag can still
serve reads, with no permanent cache entries for unconfirmed data. Cache
capacity and index database capacity are independent.

The snapshot effect RPC client accepts these optional runtime settings.

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
- Optional `PUBLISHER_LOCK_TTL_MS`: S3 lock timeout for overlapping cron runs. The
  documented default is 12 hours (`43200000`) so a slow first bootstrap is not
  overtaken by the next hourly cron.
- Optional `PUBLISHER_REQUEST_TIMEOUT_MS`: per Hasura GraphQL or S3 request
  timeout. The documented default is 60 seconds (`60000`) so network stalls fail
  with an explicit timeout instead of leaving the one-shot publisher process
  pending.
- Automatically set on Railway `RAILWAY_GIT_COMMIT_SHA`: Railway provides this
  to GitHub-triggered deployments. The publisher uses it as the indexer artifact
  deployment id because the publisher watches indexer source and redeploys from
  the same commit when indexer code changes.
- Optional `INDEXER_DEPLOYMENT_ID`: manual override for the artifact deployment
  id, useful for forced full regenerations or local/manual runs. When set, it
  takes precedence over `RAILWAY_GIT_COMMIT_SHA`. The publisher writes data
  shards under `v2/deployments/<id>/...`, records those file keys in the
  internal manifest, and deletes stale deployment prefixes after the new manifest
  is published.
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
```

The publisher writes `v2/publisher.lock` before reading Hasura. If a new cron
run starts while a previous publish still holds a fresh lock, the new run exits
successfully without writing artifacts. If no manifest exists, the publisher
creates the initial backfill from `PUBLISHER_PUBLIC_START_DATE`; once a manifest
exists, the same cron job backfills any unpublished months and regenerates at
least the previous and current month based on Hasura's latest complete date. If a
publish crashes, a later run can take over after the lock expires.
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
Published bounds never move backwards. If Hasura reports a latest date earlier
than the published manifest's `latestDate`, the publisher exits successfully
with `skipReason: "reindex_in_progress"` and leaves the manifest untouched. That
covers a reindex triggered by an indexer restart on the same deployment id,
where the freshness gate above does not apply because the deployment already has
published artifacts.
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
that redeploy the indexer to redeploy the publisher too, so the publisher's own
`RAILWAY_GIT_COMMIT_SHA` matches the indexer code version before the next cron
run. If the indexer is manually redeployed without a code change, the artifact
deployment id does not change. To force a fresh artifact namespace, set
`INDEXER_DEPLOYMENT_ID` to a new explicit value for the publisher run.

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

Create cache rules in this order:

1. Bypass non-data routes.

   Expression:

   ```text
   http.host eq "treasury-subgraph-api.olympusdao.finance"
   and (
     http.request.uri.path eq "/ready"
     or http.request.uri.path eq "/v2/bounds"
   )
   ```

   Settings:

   - Cache eligibility: Bypass cache.

2. Cache every other `GET` and `HEAD` route on the API hostname.

   Expression:

   ```text
   http.host eq "treasury-subgraph-api.olympusdao.finance"
   and http.request.method in {"GET" "HEAD"}
   ```

   Settings:

   - Cache eligibility: Eligible for cache.
   - Edge TTL: Override origin and use a default TTL of 1 hour.
   - Browser TTL: Respect origin.
   - Cache key: include query string parameters.
   - Query string sort: enabled, if available.

The API currently returns `Cache-Control: public, max-age=3600` for data
routes and `Cache-Control: no-store` for `/ready` and `/v2/bounds`. The
Cloudflare cache rule should still set an explicit 1-hour edge TTL for cacheable
routes. That prevents callers from bypassing the edge cache with request cache
headers or by omitting client-side caching behavior. Keep query strings in the
cache key because `start`, `end`, `includeRecords`, and legacy `wg_variables`
change the response body.

The API rejects unsupported query string keys and duplicate supported keys with
`400` responses. That keeps cacheable URLs constrained to documented request
shapes and prevents arbitrary query parameters from creating unbounded origin
work or cache-key variants.

## Cloudflare Compression Rules

The `metrics-api` origin intentionally does not gzip or Brotli-compress JSON
responses. This keeps compression CPU off the Railway Node.js process and lets
Cloudflare compress cached responses at the edge.

If Cloudflare's default compression is not applied to API responses, create a
Compression Rule for the API data surface.

Expression:

```text
(starts_with(http.request.uri.path, "/v2/")
or starts_with(http.request.uri.path, "/operations/")
or starts_with(http.request.uri.path, "/openapi.json"))
```

Settings:

- Compression algorithms: Brotli and Gzip.
- Do not add `Cache-Control: no-transform` at the origin, because that prevents
  Cloudflare from modifying the response for compression.

Verify with:

```sh
curl -I --compressed 'https://treasury-subgraph-api.olympusdao.finance/v2/metrics/daily?start=2026-05-20'
```

After the second request, expect Cloudflare cache headers such as
`CF-Cache-Status: HIT` for cacheable data routes. If compression is applied,
the response should include `Content-Encoding: br` or `Content-Encoding: gzip`.

Relevant Cloudflare references:

- Cache Rules settings:
  <https://developers.cloudflare.com/cache/how-to/cache-rules/settings/>
- Cache key settings:
  <https://developers.cloudflare.com/cache/how-to/cache-keys/>
- Query String Sort:
  <https://developers.cloudflare.com/cache/advanced-configuration/query-string-sort/>
- Compression Rules:
  <https://developers.cloudflare.com/rules/compression-rules/>

## Cloudflare WAF Rules

Use WAF rules to keep the public surface narrow:

- Allow `GET`, `HEAD`, and `OPTIONS`; block other methods before they reach
  Railway.
- Block requests with bodies for `GET` and `HEAD`.
- Rate-limit abusive traffic by IP and path.
- Rate-limit malformed URLs and cache-busting probes. Railway logs showed
  requests such as `///////this-should-not-exist,.%3C%3E%21@` and
  `///%5Coast.me`; the API now returns `400 invalid_request_url` for these,
  but Cloudflare should absorb repeat traffic before it reaches Railway.
- Block obvious path traversal and non-API paths.
- Keep Hasura, Postgres, the indexer, and the publisher without public domains;
  WAF rules are not a substitute for private Railway networking.
