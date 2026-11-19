# Local validation

Install the exact tools in `mise.toml`/`mise.lock` with `mise install --locked`.
Use the pinned Node and pnpm versions. Docker must be running for image and
integration checks. No cloud login, provider token or live database is required
for these checks.

| Command | Required work |
| --- | --- |
| `pnpm run validate` | Runtime alignment, frozen install, codegen, Biome, actionlint, typecheck/build, ordinary tests and dependency audit. Does not use Docker. |
| `pnpm run validate:images` | Build all five service images; scan their immutable identities, both database images and the local object-store/client images; scan all five Dockerfiles. |
| `pnpm run test:integration` | Use the built images to check persistent cache hits, cache restart, real indexer restart and manual reset isolation, template PostgreSQL TLS/data path, compiled API/publisher behavior and Hasura health. |
| `pnpm run validate:all` | Run all three groups, collecting failures without suppressing the remaining groups. |

Build images before integration. Missing Docker, images or other required
prerequisites fail the check. The integration fixtures create fresh databases
and containers, then remove only those containers and networks. They do not
touch existing volumes or developer caches. The API/publisher round trip uses
a bounded local HTTP S3 fixture; it does not certify a provider's IAM enforcement.
The isolated PostgreSQL compatibility test starts the previous template on a
fresh named volume, then checks the candidate on that same volume. It verifies
cluster identity, nonempty data, TLS certificate, PGDATA and restart persistence.
The old image is an isolated comparison input in `.railway/images.json`, not a
shipped release image; its identity is recorded separately from release scans.
Live-provider indexer tests remain separate opt-in tests in the ordinary suite.

Each canonical command prints a private temporary evidence directory containing
step logs and `report.json`: revision, dirty state, exit codes and image identities.
Image scans retain all severities, including unfixed findings. The gate fails on
fixable MEDIUM/HIGH/CRITICAL findings except the existing reviewed picomatch
exception in `.trivyignore`. The matching pnpm advisory exception is in
`pnpm-workspace.yaml`. A successful audit or policy gate does not mean zero
vulnerabilities. Unavailable image pulls fail validation; they are not skipped.

CI runs source validation once, and builds/scans images once before using those
same images for integration. The separate dependency-audit workflow is manual.
There is no Metrics handover command; that rehearsal belongs to protocol-indexer.

Before committing, run source validation and the image/integration groups for
container, deployment or runtime changes. Before pushing, verify that evidence
matches the content being pushed, run the required local review and privacy gate,
and obtain publication approval. Infrastructure plan/apply is separate from
these local checks; see [the Railway runbook](../.railway/README.md).
