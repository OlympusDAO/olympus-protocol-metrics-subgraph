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

```sh
docker compose up --build postgres hasura minio minio-init indexer metrics-api
```

The indexer is included in the default daemon stack and remains internal-only.
For a useful local backfill, set reliable archive RPC URLs in `.env`. If you
only want to start the API/storage/database path without local indexing, omit
the `indexer` service:

```sh
docker compose up --build postgres hasura minio minio-init metrics-api
```

Run the publisher after Hasura has indexed at least one daily snapshot:

```sh
pnpm run compose:publish
```

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
- `PUBLISHER_MODE`, `PUBLISHER_LOOKBACK_DAYS`, `PUBLISHER_START_DATE`, and
  `PUBLISHER_END_DATE`: publisher range controls.

Envio v3 fallback RPCs are configured in `apps/indexer/config.yaml` by adding
multiple `rpc` entries with `for: fallback`. It does not consume a
comma-separated fallback URL environment variable or `requests_per_second`
environment variables.

## Privacy Model

The compose stack intentionally does not publish host ports for Hasura,
Postgres, MinIO, the indexer, or the publisher. Use `docker compose exec` for
local inspection rather than exposing those services by default.
