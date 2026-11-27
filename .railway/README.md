# Railway infrastructure

The `treasury-subgraph` definition preserves existing services, database/volume
identities and credentials, and adds a private persistent RPC cache. Only
`metrics-api` may have HTTP domains. See [security posture](../docs/security-posture.md)
for exposure, storage and native CLI limits; this runbook does not certify live state.

Application sources follow `master` with `checkSuites: true` (Wait for CI).
The CI workflow applies infrastructure after source and owned-image/integration
checks, before GitHub-triggered app deployments proceed. Plan evaluates
executable authoring config and previews changes without provider writes. Apply
changes infrastructure and service source/image/env/build/network settings and
may redeploy or restart services; it is not a database migration.

Routine deployments are automatic: credential-free PR checks → reviewed
`master` merge → required checks → trusted production plan and automatic apply
inside CI → app deployment. The serialized `railway-apply` job reconciles every
reviewed merge, including docs-only changes. It waits for exact-SHA Dependency
Audit, managed CodeQL and external checks, rejects stale master revisions before
bootstrap and again before apply, and accepts only complete native applied/noop
results. Direct master pushes fail CI instead of bypassing IaC. Manual commands
below remain for separately authorized bootstrap, maintenance and recovery.

`master` is production. `develop` still exists as the GitHub default branch, but
there is no staging/develop environment. Merging into `develop` does not release
production. Retiring that branch and retargeting open PRs is separate work; never
map both branches to production.

Live activation first requires protected production branch/environment rules
and environment-only credentials, with repository-token fallback removed.
Production credentials must never reach PR jobs. In GitHub environment
`treasury-subgraph / production`, configure environment-only `RAILWAY_DEPLOY_TOKEN`.
The job maps it to `RAILWAY_API_TOKEN` only for native plan/apply against the exact
project/environment IDs below. It never falls back to `RAILWAY_TOKEN`. No live
secret, branch or environment settings are changed by these source edits.

Verify Wait for CI on every GitHub-backed service before activation. Production
push workflows and the infrastructure job do not automatically cancel older runs.
Manual cancellation is not a deployment stop: Railway can ignore a cancelled
workflow when another workflow succeeded. Native IaC may itself start builds or
restart services during apply; this is not an atomic infrastructure/code rollout.
Use compatible staged changes for dependent service replacements. Existing main
Postgres image changes still require separately approved rebuilds. No automatic
Envio reset or independent RPC cache deletion is added.

## Reconcile public domains

The public HTTP policy allows only `metrics-api`, on port `8080`. The Railway
service uses that port for its listener in every environment and for the
production custom domain. The local API and Compose still default to `3000`.
[Networking policy](networking.ts) and [service declaration](railway.ts).

Keep a Railway-generated domain on the base environment's `metrics-api` service.
[Railway automatically generates PR domains](https://docs.railway.com/environments#domains-in-pr-environments)
only when the corresponding base service has a Railway-generated domain. A
custom domain alone does not enable this. Production custom domains are not
assigned to previews.

A preview may predate the base service's generated domain, or its generated
route may have been removed. Inspect the base and selected preview
`metrics-api` domain inventories first. Confirm the preview is missing its
generated domain and its API is listening with `PORT=8080`. After separate
approval, create the missing domain with explicit preview identifiers.

```sh
railway domain --project PROJECT_ID --environment PR_ENVIRONMENT_ID --service metrics-api --port 8080 --json
```

Request `/operations/health` through the generated preview domain and verify
HTTP 200.

Native config plan/apply does not provision generated domains; the IaC `domains`
field configures custom domains.

CLI 5.75.0 cannot delete existing HTTP domains through its native config diff.
Before planning, inventory the whole environment's services and HTTP/TCP exposure
with complete pagination, including cache services when provisioned. Unreadable
metadata is not evidence of absence. Preserve all domains on `metrics-api`.
Planning rejects explicit generated or custom API domain targets other than 8080.
Automatic/null targets remain allowed; verify their effective routing after apply.
Keep a private record of the target, timestamp, service/domain IDs and exact
scoped deletions; obtain separate live approval for those named operations.

These native command templates require exact reviewed IDs; do not loop over domains:

```sh
railway domain list --project PROJECT_ID --environment ENVIRONMENT_ID --service SERVICE_ID --json
railway domain delete DOMAIN_ID --project PROJECT_ID --environment ENVIRONMENT_ID --service SERVICE_ID --yes --json
```

Run deletion only after approval. If inventory changes or a command fails, stop
and re-inventory before continuing. Then verify zero generated/custom domains on
every non-API service, TCP proxies separately, and unchanged volume/resource
identities and private connectivity. Do not decrypt variables or log credentials.
Continue with a fresh native plan; domain deletion does not replace plan approval.
See the pinned [native domain command](https://github.com/railwayapp/cli/blob/v5.75.0/src/commands/domain.rs).

## Preview the change

Run `mise install node pnpm railway trivy jactionlint zizmor --locked` to install the pinned Node, pnpm and Railway CLI versions. With a Railway login or token that can read the production project, link project `1eff0b7c-1ab5-4f50-8c0d-29086746a17b` and environment `34764411-35d7-466c-8249-612730c36c07`.

Before the first plan in the current operator shell, restrict the output file.
Git ignore is not filesystem protection; native CLI writes inherit permissions.
Keep plans and private archives at 0600 and avoid shell logging/uploads.

```bash
umask 077
touch railway-plan.json
chmod 600 railway-plan.json
pnpm install --frozen-lockfile
railway status
railway config migrate status
pnpm run plan:railway:bootstrap --environment 34764411-35d7-466c-8249-612730c36c07
```

The plan aliases write native `config plan --out railway-plan.json`. Review that
artifact and obtain separate live approval; do not regenerate it between review
and apply. `apply:railway` uses that pinned plan and requires the reviewed
environment name or ID. Repeat the file preparation in a new shell or if the
artifact is removed. Keep plans, variable exports and credentials outside Git.

Bootstrap preserves existing indexer RPC URLs while provisioning the cache.
Review resource IDs, volumes/capacity, preserved passwords, private endpoints,
image pins and networking removals before approval. Preserve both databases’
existing TLS/PGDATA/mount contracts; see the security posture document.

If the plan is blocked by active Config as Code ownership, get approval for the ownership switch before publishing the legacy file removals. Use Railway's `config migrate cutover` in the verified production environment. Target only `hasura`, `indexer`, `metrics-api`, and `metrics-publisher`. Railway saves their previous config paths for `config migrate undo`. Generate a fresh plan after an ownership change.

## Provision and route

The application services build from `master`. Before applying the bootstrap
plan, verify that the approved release on `master` contains the Dockerfiles
and runtime files named in the plan.

1. After approval, apply the saved bootstrap plan manually. Bootstrap preserves the indexer's current RPC URLs. Configure `UPSTREAM_RPC_URL_<id>` on the new cache for chain IDs 1, 137, 250, 8453, 42161, 80094, and 4663, using each chain's archive provider. `preserve()` retains supplied values. Provisioning does not inject the provider secrets.
2. Verify the cache health endpoint and historical RPC reads over the Railway private network. Verify that the cache database has its own attached volume. Confirm that the existing indexer and scheduled publisher remain healthy.
3. Run `pnpm run plan:railway --environment 34764411-35d7-466c-8249-612730c36c07` to preview the seven indexer routes. Review this fresh artifact, obtain separate approval, then follow the apply acceptance below and verify indexer progress/publisher output.


Retain original RPC credentials in the team secret store for route rollback.
Rollback does not require an Envio reset or deleting the cache volume.

## Accept an apply result

Only after separate live approval, apply the reviewed artifact with the explicit
reviewed environment and native JSON output:

```sh
pnpm run apply:railway production --json
```

Substitute the reviewed preview name or environment ID when applicable; do not
append another `--environment` option. `--json` bypasses native confirmation:
it is a mutation, not a dry run, and does not replace separate live approval.

CLI 5.75.0 can exit zero and print success for a failed/partial pinned apply.
Inspect the native top-level `status`, every `changes[].status` and diagnostics:

- Require top-level `applied` and a complete change list with individual statuses
  `applied` or `noop`, with no failed/unresolved diagnostics.
- Top-level `noop` is acceptable only for the reviewed empty plan/result.
- `staged` is pending configuration, not completed deployment/cutover. Stop on
  `failed`, `partially_applied`, `applying`, missing/unknown statuses or any failed,
  pending, missing/unknown per-change status. Do not retry mutations blindly.

Inspect sensitive raw results locally without shell logging, uploads or commits.
Keep only a redacted status summary, reviewed target/plan identity and approval
reference in the private operator record. Do not decrypt variables.

After apply, inventory the whole environment’s HTTP/TCP exposure: no HTTP domains
on non-API services and no public TCP proxies. Verify preserved resource/volume
identities, private connectivity, health, indexed progress and published output.
Retain the consumed plan privately, then generate a fresh read-only plan for the
same target. Review remaining changes; a subsequent apply needs separate approval.
Saved-plan apply does not reevaluate the source guard. This manual procedure is
not an automated checker or proof of live success.

Native implementation: [runner](https://github.com/railwayapp/cli/blob/v5.75.0/src/commands/config/runner.rs),
[saved-plan path](https://github.com/railwayapp/cli/blob/v5.75.0/src/iac/saved_plan.rs),
[engine](https://github.com/railwayapp/cli/blob/v5.75.0/src/iac/engine.rs).

## Local validation

Use [canonical validation](../docs/validation.md) for commands, scan policy and
required integration. See [artifact permissions](../docs/artifact-permissions.md)
for provider IAM limitations and [cache capacity](../docs/cache-capacity.md).
No live plan/apply is part of local validation.
