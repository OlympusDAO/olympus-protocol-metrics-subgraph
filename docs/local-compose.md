# Local Docker Compose Stack

`docker-compose.yml` runs the local Railway-like stack for integration testing.
By default, only `metrics-api` is reachable from the host at
`http://127.0.0.1:${METRICS_API_PORT:-3000}`. Hasura, Postgres, MinIO, the
indexer, publisher, and both RPC cache services stay internal to the Compose network.

Local databases use pinned official Alpine PostgreSQL 18.6, distinct from the
Railway SSL template used in production. Their default data directory is
`/var/lib/postgresql/18/docker`; volumes mount the parent `/var/lib/postgresql`.
The fresh ephemeral volume names are `postgres18-data` and
`rpc-cache-postgres18-data`. Older local clusters are not reused, migrated or
deleted by this change. No production volume or PGDATA setting changes.
API documentation is JSON-only at `/openapi.json`; `/docs` returns 404.

## Start

Install the command-line tools declared in `mise.toml` with `mise install node pnpm railway trivy jactionlint zizmor --locked`, then
run `pnpm install --frozen-lockfile`. A running Docker Engine with the Compose
plugin is required separately.

Optional: copy `.env.compose.sample` to `.env` and replace any values you need
to override locally. `ENVIO_API_TOKEN` is required because the current Envio
config uses HyperSync as the primary source on supported chains and RPCs as
fallbacks. Compose intentionally fails fast if the token is missing.

To start the full stack in the foreground:

```sh
docker compose up --build postgres hasura minio minio-init indexer metrics-api
```

The equivalent package script is:

```sh
pnpm run up:compose
```

The indexer is included in the default daemon stack and remains internal-only.
For a useful local backfill, set reliable archive RPC URLs in `.env` using
`UPSTREAM_RPC_URL_<chainId>`. If you
only want to start the API/storage/database path without local indexing, omit
the `indexer` service:

```sh
docker compose up --build postgres hasura minio minio-init metrics-api
```

Local indexer startup does not reset the Envio database. Compose sets
`ENVIO_PG_SCHEMA` to `public` by default and runs plain `envio start`, so local
work can resume from the existing Postgres volume. The RPC cache uses its own
Postgres service and volume, so rebuilding the Envio database preserves cached
RPC responses.

## Which Command to Run

Use `pnpm run up:compose:core` when working on indexer handlers, schemas, snapshot
logic, or Hasura-backed data shape. This is the default local development path
because Compose provides Postgres, Hasura, and the `ENVIO_PG_*` environment
variables the startup validation requires.

Use `pnpm run up:compose` when you also need the local artifact bucket and
metrics API, or when validating an end-to-end API flow after the publisher has
written artifacts.

Use `pnpm run up:compose:api` or `pnpm run up:compose:api:rebuild` when the indexing
core is already running and you are only iterating on storage/API behavior.

Use `pnpm run publish:compose` after the indexer has produced at least one
complete daily snapshot and you want to generate local `v2/` artifact shards for
the API.

Use `pnpm run dev:indexer` or `pnpm run start:indexer` only for direct host runs
against already reachable Postgres and Hasura services. These commands do not
start Docker services and do not receive Compose's local defaults. Before
running them, export `ENVIO_PG_HOST`, `ENVIO_PG_PORT`, `ENVIO_PG_USER`,
`ENVIO_PG_PASSWORD`, `ENVIO_PG_DATABASE`, `ENVIO_PG_SSL_MODE`,
`HASURA_GRAPHQL_ENDPOINT`, `HASURA_GRAPHQL_ADMIN_SECRET`, `ENVIO_API_TOKEN`, and
the per-chain `ENVIO_*_RPC_URL` variables. For the indexer,
`HASURA_GRAPHQL_ENDPOINT` is the Hasura metadata endpoint, usually
`/v1/metadata`, not the publisher's `/v1/graphql` endpoint.

## Split Workflow

For day-to-day development, keep the indexing core running separately because
Postgres, Hasura, and the indexer change less often:

```sh
pnpm run up:compose:core
```

This starts `postgres`, `hasura`, `rpc-cache-postgres`, `rpc-cache`, and
`indexer` in the foreground on the same private Compose network as the rest of
the stack.

Start or refresh the storage/API side when needed:

```sh
pnpm run up:compose:api
```

The API reads `v2/manifest.json` from the artifact bucket for `/v2/bounds` and
range validation. Before the publisher has written that manifest, these routes
return `503 manifest_not_published` instead of synthetic dates.
The publisher requires `INDEXER_DEPLOYMENT_ID`; `/v2/bounds` includes it as an
opaque data version.

After changing only the metrics API, rebuild just that container without
restarting MinIO or the indexing core:

```sh
pnpm run up:compose:api:rebuild
```

Run the publisher after the core and API/storage services are already running
and Hasura has indexed at least one complete daily snapshot:

```sh
pnpm run publish:compose
```

This rebuilds and starts only the one-shot `metrics-publisher` container with
`--no-deps` and sets `INDEXER_DEPLOYMENT_ID` to the current local
`git rev-parse HEAD` value. It assumes Postgres, Hasura, MinIO, and the bucket
initialization job are already available on the compose network. The publish
scripts include `--build`, so Docker Compose invokes a build before each
publish; Docker's layer cache may make that quick, but Compose does not reliably
build only when the local source has changed.
The command prints a JSON result containing `deploymentId` and
`indexingProgress.chains`, keyed by chain name with each chain's latest indexed
date and block.

If no manifest exists, or the manifest has no snapshots for the current
`INDEXER_DEPLOYMENT_ID`, `pnpm run publish:compose` creates the initial
historical backfill from `2022-05-01` through Hasura's latest date where every
supported chain id is indexed. That latest all-chain date must also be within
one day of the current UTC date, otherwise the publisher exits successfully with
`skipReason: "not_data_ready"` and leaves any existing manifest untouched. After
that, the same command performs incremental catch-up by backfilling unpublished
months and regenerating at least the previous and current month based on Hasura's
latest complete date; incremental runs only require the Arbitrum/Ethereum
`crossChainComplete` gate.

To clear only the local artifact bucket while keeping the rest of the compose
stack running:

```sh
pnpm run clear:compose:bucket
```

This uses the `minio-init` container as a MinIO client with `--no-deps`, removes
objects from `local/${ARTIFACT_BUCKET:-metrics}`, and recreates the bucket if
needed.

Compose startup order is declared with `depends_on` health conditions:
`minio-init` waits for MinIO's readiness endpoint, `metrics-api` waits for
`minio-init` to finish bucket creation, Hasura waits for Postgres, and the
indexer waits for Postgres and Hasura to be healthy and for eRPC to start.
eRPC waits for its own Postgres health check.

## Local Variables

Most variables have local defaults. Override these when needed:

- `METRICS_API_PORT`: host port for the public API, default `3000`.
- `HASURA_GRAPHQL_ADMIN_SECRET`: local Hasura admin secret.
- `HASURA_PORT`: internal Hasura HTTP port, default `8080`. The Hasura image
  derives `HASURA_GRAPHQL_SERVER_PORT` from this value.
- `ARTIFACT_BUCKET`: MinIO bucket, default `metrics`.
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`: local MinIO credentials. Defaults
  avoid MinIO's built-in `minioadmin:minioadmin` warning.
- `ENVIO_API_TOKEN`: required. With the current Envio config, RPC entries are
  configured as fallbacks, not as the primary sync source.
- `UPSTREAM_RPC_URL_<chainId>`: per-chain archive provider URL used by eRPC.
  Existing `ENVIO_*_RPC_URL` values serve as upstream defaults. Inside the
  indexer container, those variables point to eRPC for both Envio fallback
  RPC and snapshot reads. eRPC persists eligible provider-finalized responses.
- `RPC_CACHE_POSTGRES_PASSWORD`: URL-safe password for the independent local
  RPC cache database.
- `RPC_CACHE_MAX_RPS`: aggregate upstream JSON-RPC request limit per second,
  default `100`.
- `ENVIO_RPC_HTTP_BATCH_SIZE`, `ENVIO_RPC_MULTICALL_BATCH_SIZE`, and
  `ENVIO_RPC_TIMEOUT_MS`: repository snapshot effect RPC tuning. These are not
  Envio event-ingestion settings.
- `INDEXER_HASURA_GRAPHQL_ENDPOINT`: Envio metadata endpoint used by the
  indexer, default `http://hasura:8080/v1/metadata`.
- `INDEXER_PORT`: internal Envio indexer HTTP port, default `9898`. Startup
  maps this value to `ENVIO_INDEXER_PORT`.
- `PUBLISHER_PUBLIC_START_DATE`, `PUBLISHER_LOCK_TTL_MS`,
  `PUBLISHER_START_DATE`, and `PUBLISHER_END_DATE`: publisher range controls. If
  no manifest exists, publishing starts at `2022-05-01`; otherwise it backfills
  unpublished months and regenerates at least the previous and current month. A
  fresh `v2/publisher.lock` makes overlapping publisher runs exit successfully
  without writing artifacts.
- `INDEXER_DEPLOYMENT_ID`: deployment identifier stamped into the internal
  manifest. `pnpm run publish:compose` sets it to the latest local git commit
  hash. If running Docker Compose directly, set it manually or provide
  `RAILWAY_GIT_COMMIT_SHA`. Data shards are written under
  `v2/deployments/<id>/...`, and successful publishes remove stale files from
  older deployment prefixes after the new manifest has been written.

Envio v3 fallback RPCs are configured in `apps/indexer/config.yaml` by adding
multiple `rpc` entries with `for: fallback`. It does not consume a
comma-separated fallback URL environment variable or `requests_per_second`
environment variables.

## Privacy Model

The compose stack intentionally does not publish host ports for Hasura,
Postgres, MinIO, the indexer, publisher, or the RPC cache services. Use `docker compose exec` for
local inspection rather than exposing those services by default.

## Validate images and persistence

Run the canonical checks from the repository root:

```sh
pnpm run validate:images
pnpm run test:integration
```

The first command gates the six owned service images and their Dockerfiles
using immutable image IDs and pinned Trivy. Railway PostgreSQL is optional
provider-advisory coverage; local PostgreSQL and MinIO/MC fixtures are excluded
from default scans. The second uses the built
images for cache persistence, real indexer restart/manual-reset isolation,
API/publisher behavior and Hasura health. Missing prerequisites fail.
The standalone `pnpm run test:rpc-cache` requires the eRPC, indexer and Hasura
images and both pinned PostgreSQL images from `.railway/images.json` in the
selected Docker or Podman runtime. It checks these images before creating the
fixture and always verifies indexer resume and reset. `pnpm run test:integration`
pulls the PostgreSQL prerequisites for Docker and expects the owned images to
be built already.

See [validation prerequisites and private evidence](validation.md). The
[benchmark report](performance/rpc-indexer.md) retains the devbox baseline
and measurement limits. Live Compose also requires the pinned MinIO and mc
images to be accessible from their registry; a rejected pull is a validation
blocker, not permission to replace the storage system or delete its data.
