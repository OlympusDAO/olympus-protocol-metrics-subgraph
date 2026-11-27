# Local validation

Install the exact tools in `mise.toml`/`mise.lock` with `mise install node pnpm railway trivy jactionlint zizmor --locked`.
Use the pinned Node and pnpm versions. Docker must be running for image and
integration checks. No cloud login, provider token or live database is required
for these checks.

The indexer and Envio 3.19.0 handler checks use the root TypeScript 7.0.2 CLI.
The native compiler regression and storage refusal behavior are described
in [security posture](security-posture.md#shared-tooling-and-intentional-differences).

| Command | Required work |
| --- | --- |
| `pnpm run check:runtime-versions` | Verify exact Node/pnpm runtimes, locked Railway CLI/Trivy/jactionlint/Zizmor and Docker Node/pnpm source pins; no Docker required. |
| `pnpm run lint:actions` | Run jactionlint correctness/offline with permission/checkout errors, then Zizmor 1.32.0 offline audits with persona `auditor` at medium severity/low confidence. Online audits are not run. |
| `pnpm run codegen` | Generate Envio types offline, before typechecking or ordinary tests. |
| `pnpm run check` | Read-only Biome formatting/code checks and workflow lint, once. |
| `pnpm run lint` | Apply safe Biome fixes and formatting, then workflow lint. |
| `pnpm run typecheck` | Whole-workspace TypeScript check without emitting artifacts. |
| `pnpm run build` | Build client, API, publisher, and monitor artifacts. Reject committed OpenAPI drift before regeneration. |
| `pnpm run test` | Run all ordinary suites, including the monitor CLI tests against its compiled entry point. Prepare codegen and build artifacts first. |
| `pnpm run validate` | Frozen install → runtime versions → codegen → check → typecheck → build → tests → moderate dependency audit. Does not use Docker. |
| `pnpm run validate:images` | Build and scan the six repository-owned application images and Dockerfiles. Record Railway PostgreSQL as advisory-provider/not-run and explicit local/historical exclusions; no provider or fixture pulls/scans. |
| `pnpm scan:docker:provider` | Optional advisory scan of configured Railway PostgreSQL template images only; no app builds or local fixtures. Vulnerabilities do not fail the command; registry/scanner errors do. |
| `pnpm run test:integration` | Use the built images to check persistent cache hits, cache restart, real indexer restart and manual reset isolation, template PostgreSQL TLS/data path, compiled API/publisher behavior and Hasura health. |
| `pnpm run validate:all` | Run all three groups, collecting failures without suppressing the remaining groups. |

Builds, scans and integration use the configured `:local` application tags.
The root TypeScript project checks client, API, publisher, indexer, shared package
sources and tests in one pass. The standalone monitor uses its own NodeNext
project. Use `pnpm build:indexer-monitor`, `pnpm test:indexer-monitor`, and
`pnpm typecheck:indexer-monitor` for that app. `pnpm build:client`,
`pnpm build:metrics-api`, and `pnpm build:metrics-publisher` also have explicit
entry points. Envio executes indexer TypeScript natively after codegen.
Owned fixture containers use `--pull=never`; build the images before integration.
Recorded image IDs are diagnostic snapshots, not an immutable handoff protocol.
Missing Docker, images or other required
prerequisites fail the check. The integration fixtures create fresh databases
and containers, then remove only those containers and networks. They do not
touch existing volumes or developer caches. The API/publisher round trip uses
a bounded local HTTP S3 fixture; it does not certify a provider's IAM enforcement.
The isolated PostgreSQL compatibility test starts the previous template on a
fresh named volume, then checks the candidate on that same volume. It verifies
cluster identity, nonempty data, TLS certificate, PGDATA and restart persistence.
The old image is an isolated comparison input in `.railway/images.json`, not a
shipped release image. Integration independently prepares the exact current
provider PostgreSQL 18.6, official local Alpine PostgreSQL 18.6 and historical PostgreSQL 18 refs
it consumes; unavailable prerequisites
fail. MinIO/MC are Compose fixtures and are not used by this HTTP S3 integration.
Live-provider indexer tests remain separate opt-in tests in the ordinary suite.
The indexer fixture checks that a changed `chainIdMode` causes a nonzero native
exit and preserves the stored configuration and sentinel. It resets the verified
indexer schema from the PostgreSQL host, starts normal ingestion, and requires
HTTP 200 from `/healthz`. The eRPC fixture verifies the cached keys and values
survive this reset.

The inventory has fixed `built`, `provider`, `local` and `comparison` groups.
Every built application is built and gated, without classification/deduplication
rules. A whole-project SDK/inventory test checks complete membership and that
provider entries are exactly the configured Railway PostgreSQL resources.
Provider images are advisory-provider/not-run by default: upstream maintains
their contents, while this repository selects pinned refs. Optional provider
scans allow vulnerabilities but fail execution/registry errors.

Local PostgreSQL and MinIO/MC are local development/test fixtures, not deployed
by Railway IaC, excluded by explicit user policy. Historical fixtures are also
excluded. Excluded/not-run rows have reasons, never scanned/clean claims. Even
if a reference is shared, every built app remains gated. No gosu CVEs are ignored.

Canonical commands print a private temporary evidence directory with native
step logs and `report.json`: command/exit/timing, revision/dirty state, group
outcomes, exclusions, image IDs, scan policy and cache metadata. Test/scan detail
stays in native output rather than parallel counters or parsed skip summaries.
Docker groups check stable context/daemon identity. Trivy uses its shared native
cache; `TRIVY_CACHE_DIR` may select an existing shared cache without duplication.
Native scanner table output stays in the step log; no raw ImageConfig, environment
or image-history JSON artifact is retained.

Owned image scans use native Trivy table output and exit status.
Trivy loads `trivy.yaml` from the repository root and filters unfixed
vulnerabilities by default. Fixable MEDIUM/HIGH/CRITICAL vulnerabilities
and secrets at those severities fail the gate.
Each approved CVE exception has its own `.trivyignore` entry in the form
`CVE-… exp:YYYY-MM-DD`, with comments recording the affected package and
version, rationale, and explicit user approval. Remove the entry when fixed.
Trivy enforces expiration. The separate pnpm audit exception is in
`pnpm-workspace.yaml`.

Optional provider scans report vulnerabilities at every severity and use
`--ignore-unfixed=false` to include unfixed findings. They use `--exit-code 0`
and no ignorefile entries. Scanner errors and failed image pulls fail
validation. Reports distinguish local and historical exclusions and provider
scans that were not run from passed scans.

CI has five independent source matrix checks: Runtime versions, Format and lint,
Typecheck, Build and Tests. Each has a 20-minute timeout. Typecheck and Tests run
offline codegen; Tests builds artifacts first in its isolated checkout. The dedicated
Dependency Audit PR workflow owns the moderate+ audit. Same-repository PRs use
the pinned pnpm audit action for findings and comments; fork PRs skip the entire
job before checkout or token use. Non-PR runs use native `pnpm audit`, including
the Monday 00:00 UTC schedule shared by all three protocol repositories.
Local source validation still includes the audit.

Image CI has six independent matrix cells with separate native build, image
scan and Dockerfile-check steps and a 45-minute timeout. PRs run it directly;
non-PR source CI calls the reusable workflow, avoiding duplicate push builds.
Superseded PR source/image runs are cancelled independently. The RPC cache + integration cell builds five
companions using the existing build scripts, then runs the full integration
suite even after scan failures if all its builds succeeded. This is eleven builds
total: five inexpensive companion duplicates, with no second eRPC build or image
transfer. Integration prepares only its required fixture images. Local aggregates
remain available.
`validate:all` uses the same owned-app selection and excludes the optional provider
group. No aggregate scans local fixtures by default. The explicit
`scan:docker <image>` convenience command scans an operator-selected image with
pinned Trivy's native `vuln,secret` default and the filtering from
`trivy.yaml`. Callers can select `--scanners`.
There is no Metrics handover command; that rehearsal belongs to protocol-indexer.

Before committing, run source validation and the image/integration groups for
container, deployment or runtime changes. Before pushing, verify that evidence
matches the content being pushed, run the required local review and privacy gate,
and obtain publication approval. Infrastructure plan/apply is separate from
these local checks; see [the Railway runbook](../.railway/README.md).

See [security posture](security-posture.md) for exposure acceptance layers, database blockers, and intentional Envio/compiler differences. Image integration requires ingestion `/healthz` 200 and `/docs`, `/openapi.json`, `/llms.txt` 404.
