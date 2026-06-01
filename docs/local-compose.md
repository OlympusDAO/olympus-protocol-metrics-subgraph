# Local Docker Compose Stack

`docker-compose.yml` runs the local Railway-like stack for integration testing.
By default, only `metrics-api` is reachable from the host at
`http://127.0.0.1:${METRICS_API_PORT:-3000}`. Hasura, Postgres, MinIO, the
indexer, and the publisher stay internal to the compose network.

## Start

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
pnpm run compose:up
```

The indexer is included in the default daemon stack and remains internal-only.
For a useful local backfill, set reliable archive RPC URLs in `.env`. If you
only want to start the API/storage/database path without local indexing, omit
the `indexer` service:

```sh
docker compose up --build postgres hasura minio minio-init metrics-api
```

## Split Workflow

For day-to-day development, keep the indexing core running separately because
Postgres, Hasura, and the indexer change less often:

```sh
pnpm run compose:core
```

This starts `postgres`, `hasura`, and `indexer` in the foreground. They share
the same private compose network and volumes as the rest of the stack.

Start or refresh the storage/API side when needed:

```sh
pnpm run compose:api
```

The API reads `v2/manifest.json` from the artifact bucket for `/v2/bounds` and
range validation. Before the publisher has written that manifest, these routes
return `503 manifest_not_published` instead of synthetic dates.
The publisher requires `INDEXER_DEPLOYMENT_ID`; `/v2/bounds` includes it as an
opaque data version.

After changing only the metrics API, rebuild just that container without
restarting MinIO or the indexing core:

```sh
pnpm run compose:api:rebuild
```

Run the publisher after the core and API/storage services are already running
and Hasura has indexed at least one daily snapshot:

```sh
pnpm run compose:publish
```

This rebuilds and starts only the one-shot `metrics-publisher` container with
`--no-deps` and sets `INDEXER_DEPLOYMENT_ID` to the current local
`git rev-parse HEAD` value. It assumes Postgres, Hasura, MinIO, and the bucket
initialization job are already available on the compose network. The publish
scripts include `--build`, so Docker Compose invokes a build before each
publish; Docker's layer cache may make that quick, but Compose does not reliably
build only when the local source has changed.

If no manifest exists, `pnpm run compose:publish` creates the initial historical
backfill from `2022-05-01` through Hasura's latest indexed date. After that, the
same command performs incremental catch-up from the existing manifest latest
date with the configured lookback overlap.

To clear only the local artifact bucket while keeping the rest of the compose
stack running:

```sh
pnpm run compose:bucket:clear
```

This uses the `minio-init` container as a MinIO client with `--no-deps`, removes
objects from `local/${ARTIFACT_BUCKET:-metrics}`, and recreates the bucket if
needed.

Compose startup order is declared with `depends_on` health conditions:
`minio-init` waits for MinIO's readiness endpoint, `metrics-api` waits for
`minio-init` to finish bucket creation, Hasura waits for Postgres, and the
indexer waits for both Postgres and Hasura to be healthy.

## Local Variables

Most variables have local defaults. Override these when needed:

- `METRICS_API_PORT`: host port for the public API, default `3000`.
- `HASURA_GRAPHQL_ADMIN_SECRET`: local Hasura admin secret.
- `ARTIFACT_BUCKET`: MinIO bucket, default `metrics`.
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`: local MinIO credentials. Defaults
  avoid MinIO's built-in `minioadmin:minioadmin` warning.
- `ENVIO_API_TOKEN`: required. With the current Envio config, RPC entries are
  configured as fallbacks, not as the primary sync source.
- `ENVIO_*_RPC_URL`: per-chain archive RPC URLs for indexer backfills and
  snapshot-time contract reads.
- `ENVIO_RPC_HTTP_BATCH_SIZE`, `ENVIO_RPC_MULTICALL_BATCH_SIZE`, and
  `ENVIO_RPC_TIMEOUT_MS`: repository snapshot effect RPC tuning. These are not
  Envio event-ingestion settings.
- `INDEXER_HASURA_GRAPHQL_ENDPOINT`: Envio metadata endpoint used by the
  indexer, default `http://hasura:8080/v1/metadata`.
- `PUBLISHER_PUBLIC_START_DATE`, `PUBLISHER_LOOKBACK_DAYS`,
  `PUBLISHER_LOCK_TTL_MS`, `PUBLISHER_START_DATE`, and
  `PUBLISHER_END_DATE`: publisher range and overlap controls. If no manifest
  exists, publishing starts at `2022-05-01`; otherwise it uses the manifest
  latest date plus the lookback overlap. A fresh `v2/publisher.lock` makes
  overlapping publisher runs exit successfully without writing artifacts.
- `INDEXER_DEPLOYMENT_ID`: required deployment identifier stamped into the
  internal manifest. `pnpm run compose:publish` sets it to the latest local git
  commit hash. If running Docker Compose directly, set it manually. Data shards
  are written under `v2/deployments/<id>/...`, and successful publishes remove
  stale files from older deployment prefixes after the new manifest has been
  written.

Envio v3 fallback RPCs are configured in `apps/indexer/config.yaml` by adding
multiple `rpc` entries with `for: fallback`. It does not consume a
comma-separated fallback URL environment variable or `requests_per_second`
environment variables.

## Privacy Model

The compose stack intentionally does not publish host ports for Hasura,
Postgres, MinIO, the indexer, or the publisher. Use `docker compose exec` for
local inspection rather than exposing those services by default.
