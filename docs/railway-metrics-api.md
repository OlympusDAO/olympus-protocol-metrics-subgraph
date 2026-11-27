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
- Railway IaC sets Hasura's `PORT=8080` in every environment. The Dockerfile
  maps `PORT` to `HASURA_GRAPHQL_SERVER_PORT` before Hasura starts.
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
- Leave `ENVIO_PG_SCHEMA` and `ENVIO_PG_PUBLIC_SCHEMA` unset on Railway so each
  deployment uses the same Envio schema. Native Envio checks
  `ENVIO_PG_SCHEMA` first, then the legacy `ENVIO_PG_PUBLIC_SCHEMA`, and
  defaults to `public`.
- Startup uses plain `envio start` and resumes compatible state from the
  committed checkpoint. Envio exits on fatal errors. Railway can retry those
  exits under its bounded `ON_FAILURE` policy.
- Required `ENVIO_PG_SSL_MODE`: set according to the Railway Postgres
  connection mode. Envio accepts `false`, `true`, `require`, `allow`, `prefer`,
  or `verify-full`; it does not accept libpq-style `disable`.
- Optional `ENVIO_PG_MAX_CONNECTIONS`: Envio Postgres pool size.
- Railway IaC sets the indexer's `PORT=9898` in every environment. Startup maps
  `PORT` to `ENVIO_INDEXER_PORT` before launching Envio.
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
`DATABASE_URL`, split the URL into the required `ENVIO_PG_*` settings.

Envio v3 supports fallback RPCs by adding multiple `rpc` entries in
`apps/indexer/config.yaml` with `for: fallback`. It does not consume
comma-separated fallback URL environment variables for event ingestion.
Envio's RPC schema supports batch/backoff/timeout/polling fields in
`config.yaml`; it does not consume `requests_per_second` environment variables
for event ingestion.

### Indexer monitor service

Railway runs the private `indexer-monitor` job every 15 minutes from its
dedicated Alpine-based image. Each invocation reads state, probes the native
`/metrics` endpoint once with a five-second timeout, and exits. HTTP 2xx means
the endpoint is reachable, including during backfill. The job measures
reachability only and never resets the indexer.

Before deploying, configure the production service's `DISCORD_WEBHOOK_URL` and
shared `DISCORD_WEBHOOK_URL_PREVIEW` for other environments. IaC preserves the
production value and declares the preview reference. It
binds `INDEXER_METRICS_URL` to the indexer's private host and port and
references `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, and
`SECRET_ACCESS_KEY` from the dedicated private `monitor-state` bucket. All are required.
Startup validates these values before any requests and exits nonzero with
a fixed diagnostic on invalid configuration. `MONITOR_NAME` is optional
and defaults to `Indexer`. IaC supplies `Metrics`; the runtime appends Railway's
actual environment name outside production. The supplied
project/environment label must fit within 1024 characters. The supplied
`RAILWAY_ENVIRONMENT_NAME` must not be blank. Outside Railway it is optional;
without it the explicit `DISCORD_WEBHOOK_URL` and base label are used.
Only the exact environment name `production` uses the production webhook.
Renamed environments use preview routing. A supplied runtime ID must not be blank
and requires a name; it does not select the Discord destination.
`MONITOR_COOLDOWN_MINUTES` is optional and defaults to `60`. When set, use
a positive whole number that can be represented safely in milliseconds.

Configure the production service value and preview reference once in the base environment.
Automatic PR deployments copy the preview reference and select it at startup;
no plan or apply is required for each PR. Only the selected webhook is required,
and missing preview configuration fails without a production fallback. Seal the
production service value to keep it out of preview copies. Replace any existing
shared production reference with the service-level secret before sealing, and
review the old shared secret separately; `preserve()` does not migrate an alias.
See [Railway's sealed-variable rules](https://docs.railway.com/variables#sealed-variables).
Source changes do not perform or verify live secret setup or sealing.

The job persists state at `indexer-monitor/state.json`, separately from
snapshot keys. A successful Discord error notification starts the configured
cooldown across invocations and redeploys. The first eligible run after the
cooldown can alert again if the indexer remains unreachable. A healthy run
sends one recovery for a previously alerted outage and keeps its cooldown,
so a new outage within that window stays suppressed.

Discord notifications include the project, status, and timestamp. Logs record
the probe result, cooldown suppression, and acknowledged alerts.
Delivery and storage failures exit nonzero. Failed delivery leaves state
intact so the next scheduled run can retry a relevant alert. A successful
delivery followed by a failed state write can cause a duplicate notification.

### Manual indexer reset

Envio exits nonzero when it refuses incompatible stored configuration or
addresses. Startup never resets storage. Inspect the indexer logs and restore
the compatible configuration if possible. Use this procedure only after an
operator approves a rebuild from the configured chain start blocks.

1. Verify the Railway project and environment IDs. Record the main indexer's
   Postgres service, `ENVIO_PG_DATABASE`, `ENVIO_PG_PORT`, and effective schema.
   Check both `ENVIO_PG_SCHEMA` and `ENVIO_PG_PUBLIC_SCHEMA` in the indexer's
   runtime environment. Proceed only when the effective schema is `public`.
   Perform the reset on the main `Postgres` service. The separate eRPC database
   is outside this procedure.
2. Stop all writers to the indexer schema, including every indexer replica,
   and prevent automatic restarts until the reset finishes. Stop Hasura when
   it uses this schema. Pause publisher runs until the rebuilt dataset is ready.
3. Use the verified IDs to open a shell on the main `Postgres` service. Complete
   normal SSH host verification during this interactive connection.

   ```sh
   railway ssh --project PROJECT_ID --environment ENVIRONMENT_ID --service Postgres
   ```

   From that shell, substitute the verified port and database name, and an
   authorized role that can drop and recreate the schema.

   ```sh
   psql -X -v ON_ERROR_STOP=1 --host 127.0.0.1 --port VERIFIED_DB_PORT --dbname VERIFIED_DB_NAME --username VERIFIED_DB_ROLE
   ```

   Confirm the connection with `\conninfo` and
   `SELECT current_database(), current_user;`. Check
   `pg_stat_activity` for remaining writer sessions. Inspect all schema
   objects and dependencies, and record the owner and grants with `\dn+ public`.
   Stop if any unrelated objects or dependencies would be dropped. Take a
   database backup and verify it is available for recovery.
4. Exit the interactive session. From the repository root, run the
   [checked-in reset script](../scripts/reset-indexer-schema.sql) with the same
   verified IDs, database port, database name, and role. The streamed command
   uses the service's existing `POSTGRES_PASSWORD` for its verified
   `POSTGRES_USER` role. A different role requires separately approved noninteractive
   authentication.

   ```sh
   railway ssh --project PROJECT_ID --environment ENVIRONMENT_ID --service Postgres -- \
     'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w -v ON_ERROR_STOP=1 --host 127.0.0.1 --port VERIFIED_DB_PORT --dbname VERIFIED_DB_NAME --username VERIFIED_DB_ROLE --file=-' \
     < scripts/reset-indexer-schema.sql
   ```

   The script requires `public.envio_info` and the standard PostgreSQL
   `public` schema owned by `pg_database_owner`, with `USAGE` granted to
   `PUBLIC`. It also preserves a direct `USAGE` and `CREATE` grant from the
   schema owner to the database owner when present. It checks the recreated
   owner and grants before committing. For other owners or grants, keep the
   services stopped and use a separately reviewed manual restore that recreates
   the recorded owner and exact grants. Verify the grants before committing
   that restore.

5. Start Hasura if you stopped it, then redeploy the indexer normally. Envio
   initializes the empty schema and starts indexing. Check the native
   `/healthz` response for HTTP 200 and verify chain progress before resuming
   downstream work.

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

- Railway IaC sets `PORT=8080` for the public `metrics-api` listener in every
  environment. The production custom domain uses the same port.
  [Service declaration](../.railway/railway.ts).
- Optional `METRICS_API_MAX_RANGE_DAYS`: maximum inclusive v2 range. The
  documented default is `366`.
- Optional `METRICS_API_PORT`: local port override when the runtime does not
  provide `PORT`. Local API and Compose default to `3000`.
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
