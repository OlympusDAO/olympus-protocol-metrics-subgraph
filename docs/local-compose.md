# Local Docker Compose Stack

`docker-compose.yml` runs the local Railway-like stack for integration testing.
By default, only `metrics-api` is reachable from the host at
`http://127.0.0.1:${METRICS_API_PORT:-3000}`. Hasura, Postgres, MinIO, the
indexer, and the publisher stay internal to the compose network.

## Start

```sh
docker compose up --build postgres hasura minio minio-init metrics-api
```

The indexer is included in the compose file but can produce a large historical
backfill. Start it when you explicitly want local indexing:

```sh
docker compose up --build indexer
```

Run the publisher after Hasura has indexed at least one daily snapshot:

```sh
docker compose --profile publish run --rm metrics-publisher
```

## Local Variables

All variables have local defaults. Override these when needed:

- `METRICS_API_PORT`: host port for the public API, default `3000`.
- `HASURA_GRAPHQL_ADMIN_SECRET`: local Hasura admin secret.
- `ARTIFACT_BUCKET`: MinIO bucket, default `metrics`.
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`: local MinIO credentials.
- `ENVIO_*_RPC_URL`: per-chain archive RPC URLs for indexer backfills.
- `PUBLISHER_MODE`, `PUBLISHER_LOOKBACK_DAYS`, `PUBLISHER_START_DATE`, and
  `PUBLISHER_END_DATE`: publisher range controls.

## Privacy Model

The compose stack intentionally does not publish host ports for Hasura,
Postgres, MinIO, the indexer, or the publisher. Use `docker compose exec` for
local inspection rather than exposing those services by default.
