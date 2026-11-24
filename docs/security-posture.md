# Security posture

This document describes the intended source configuration. It does not certify
the live Railway environment. Deployment, domain removal, credential changes
and database maintenance require separate operator approval.

## Exposure and trust boundaries

| Component | Intended exposure | Authentication and trust boundary | Documentation owner |
| --- | --- | --- | --- |
| metrics-api | Public HTTPS; desired hostname `treasury-subgraph-api.olympusdao.finance`, target port 8080. Generated/custom domains on this service are allowed | Anonymous read API over published artifacts; no indexer, Hasura or database access | OpenAPI JSON only at `/openapi.json`; `/docs` returns 404; REST remains available |
| indexer and snapshot handlers | Private, no generated/custom HTTP domains or TCP proxies | HyperSync token and archive RPC credentials outbound; database credentials and Hasura admin secret internally | No ingestion docs site or public specification; `/docs`, `/openapi.json`, `/llms.txt` must return 404 |
| Hasura | Private | Admin secret; trusted indexer and publisher callers | No public docs or console; internal GraphQL/metadata endpoints |
| metrics-publisher | Private scheduled process | Reads Hasura using admin secret; writes published S3 artifacts | No HTTP docs site |
| rpc-cache (eRPC) | Private port 4000 | No client authentication; private-network callers are trusted; upstream RPC credentials outbound | No public docs site |
| Postgres | Private port 5432 | Database password; template TLS; trusted internal clients | No HTTP docs site |
| rpc-cache-postgres | Private port 5432, separate volume | Database password; template TLS; eRPC client | No HTTP docs site |
| Artifact bucket | Private authenticated objects; provider S3 endpoint is network reachable | Publisher writes; API reads. Railway bucket credentials are bucket-wide, so source cannot enforce an API read-only IAM identity | [Artifact permission policies](artifact-permissions.md) |
| Local MinIO and initialization client | Compose network only, no host ports | Local development credentials; initialization client provisions the local bucket | No public docs site |

The public API serves published snapshots. It sits downstream of indexer →
Hasura → publisher → bucket; it does not proxy ingestion or database requests.
Snapshots execute inside the indexer, not a second public service.
The bucket's provider endpoint is distinct from anonymous application exposure.
Production IAM restrictions need provider support and separately approved
credential provisioning; local S3 fixtures cannot prove provider IAM enforcement.

Compose publishes only the API at `127.0.0.1:${METRICS_API_PORT:-3000}`. Databases,
Hasura, indexer, eRPC and object storage have no host mappings. The bridge permits
outbound HyperSync, RPC and S3 traffic; it is not an egress firewall. Private
networking does not authenticate trusted service callers.

## Railway enforcement and acceptance

The definition preserves the imported `database.Postgres` resource, volume
identity, credentials, mount path and template behavior. After SDK project
normalization it emits explicit domain allowlists and null TCP tombstones for
canonical ports and all current proxy ports found by the read-only preflight.
With a real environment ID, the preflight reads `config(decryptVariables:false)`,
service identities/domains and volume metadata. Config values remain in memory;
they are not logged or stored. Incomplete pages, malformed identities/ports,
unknown services, unaccounted config IDs and unexpected HTTP domains fail closed.
Offline evaluation permits missing resources so new-resource previews still work.

CLI 5.75.0's normal plan/apply uses graph change sets. Empty `tcpProxies` is a
sparse no-op; `"5432": null` removes that named proxy. HTTP custom/generated
domains follow separate paths: the native networking diff excludes them and
does not establish removal of existing HTTP exposure. An unexpected domain
therefore requires a separately authorized provider removal and fresh exposure
verification before planning. Source omission or an empty map is not evidence
that a live endpoint was removed. See the upstream
[engine](https://github.com/railwayapp/cli/blob/v5.75.0/src/iac/engine.rs) and
[change-set implementation](https://github.com/railwayapp/cli/blob/v5.75.0/src/iac/change_set.rs).

Use the [domain-reconciliation procedure](../.railway/README.md#reconcile-public-domains)
for exact-ID deletion review and the [native plan/apply runbook](../.railway/README.md)
for private artifacts, approval and JSON status acceptance. The public allowlist
is service-level: valid generated/custom domains on `metrics-api` pass regardless
of hostname/port; desired source hostname stays configured. Saved-plan apply
does not reevaluate the source guard, and CLI5.75 may exit zero for failed/partial
applies, so postapply inventory and a fresh plan remain required. No custom
mutation wrapper or automatic apply workflow is used.

Repository tests evaluate the installed SDK/project and serialize the emitted
desired resources, including null entries and provider-response negative cases.
Independent characterization of the exact upstream Rust networking function
checks sparse TCP semantics; it is not a full native CLI/backend apply test.
There is no supported offline native plan evaluator in this CLI. Future
acceptance must inspect a real native plan and a fresh provider exposure query;
no live plan, apply or exposure mutation is part of local validation.

Image-bound integration checks the actual ingestion server's health and absence
of docs/spec/text routes. API documentation checks belong to the separate API.
See [validation](validation.md) and the [Railway runbook](../.railway/README.md).

## Database image policy and operator follow-up

All local PostgreSQL instances use official Alpine `18.6-alpine3.24` at the exact
multi-platform digest in [the image inventory](../.railway/images.json), with parent mount
`/var/lib/postgresql` and default `PGDATA=/var/lib/postgresql/18/docker`.
Compose uses fresh versioned ephemeral `postgres18-data` and
`rpc-cache-postgres18-data` volumes. Existing older local clusters are not
migrated or deleted. Both production PostgreSQL 18 databases use the same pinned
`postgres-ssl:18.6` image in that inventory. Preserve template TLS, environment variables,
PGDATA, mount paths and volume identities. No custom image, major upgrade or
storage migration is introduced.

[Validation](validation.md) owns the scan policy: all five built applications and
Dockerfiles are gated; configured provider PostgreSQL is optional/advisory;
local development/test and historical fixtures are excluded, with explicit
reasons. Fixed inventory membership is checked against the whole evaluated
project. Database refs/resources and required functional integration remain
unchanged. Historical scan findings remain historical, not clean-image claims.

For a future approved minor update, review the
[18.7/17.12 release notice](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/)
and skipped minor release notes. No `pg_upgrade` or dump/reload is needed for
same-major updates. Inventory affected indexes before targeted maintenance:
suspect GIN indexes, pg_trgm GiST indexes, unbounded `bpchar` B-tree indexes and
tables affected by the prior `REINDEX CONCURRENTLY` TOAST issue may need REINDEX.
Inspect affected partition NOT NULL/NO INHERIT constraints where applicable.
If incremental backups are used, start a new full backup base after updating.
The repository does not establish which of these features production uses;
no live REINDEX, backup, constraint repair or production update was performed.

## Shared tooling and intentional differences

[mise.toml](../mise.toml) and [mise.lock](../mise.lock) own tool pins;
[package.json](../package.json) and [the indexer manifest](../apps/indexer/package.json)
own direct package versions. The Railway CLI and TypeScript SDK are separate
dependencies. [Validation](validation.md) owns runtime-alignment checks.

Metrics pins Envio 3.18.1. Native startup refuses incompatible configuration or
addresses before storage takeover. The wrapper retains its bounded retry policy
then keeps private reset control alive after terminal nonzero results, including
failures unrelated to compatibility. An operator must inspect and explicitly
restart or reset it; Railway `ON_FAILURE` does not restart a paused wrapper.
Ingestion's native health port is unavailable while paused, and source IaC has
no indexer healthcheck. It does not reset automatically. Persisted configuration
includes the Envio version, so this upgrade can refuse an older cluster: rehearse
on a clone before separately approving a live reset. The private reset command
and stopped-app maintenance alternative are in [the runbook](railway-metrics-api.md#manual-indexer-reset).
Main TypeScript is exactly 7.0.2 for build/typecheck and Envio's native handler-check CLI.

The pnpm policy uses preferred `audit.ignore`. pnpm 11.28.13 still recognizes
the deprecated `auditConfig.ignoreGhsas`, but the former takes precedence.
The pnpm audit ignore for picomatch and the range-scoped overrides remain.
The explicitly selected Envio 3.18.1 and its five exact platform packages alone
have release-age exceptions; the global 10080-minute age gate remains enabled.
