# Railway infrastructure

The `treasury-subgraph` definition preserves existing services, database/volume
identities and credentials, and adds a private persistent RPC cache. Only
`metrics-api` may have HTTP domains. See [security posture](../docs/security-posture.md)
for exposure, storage and native CLI limits; this runbook does not certify live state.

## Preview the change

First follow [public-domain reconciliation](domain-reconciliation.md) if the
read-only inventory finds HTTP domains on any non-API service. Prepare and
review exact native `railway domain delete` commands, obtain separate live
approval, and verify their removal before generating the normal IaC plan.
CLI 5.75.0 does not declaratively delete those HTTP domains. The service-level
allowlist permits generated/custom domains on `metrics-api`; the desired source
hostname remains unchanged.

Run `mise install node pnpm railway trivy jactionlint --locked` to install the pinned Node, pnpm and Railway CLI versions. With a Railway login or token that can read the production project, link project `1eff0b7c-1ab5-4f50-8c0d-29086746a17b` and environment `34764411-35d7-466c-8249-612730c36c07`.

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
pnpm run railway:plan:bootstrap --environment 34764411-35d7-466c-8249-612730c36c07
```

The plan aliases write native `config plan --out railway-plan.json`. Review that
artifact and obtain separate live approval; do not regenerate it between review
and apply. `railway:apply` uses that pinned plan and requires the reviewed
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
3. Run `pnpm run railway:plan --environment 34764411-35d7-466c-8249-612730c36c07` to preview the seven indexer routes. Review this fresh artifact, obtain separate approval, then follow the apply acceptance below and verify indexer progress/publisher output.


Retain original RPC credentials in the team secret store for route rollback.
Rollback does not require an Envio reset or deleting the cache volume.

## Accept an apply result

Only after separate live approval, apply the reviewed artifact with the explicit
reviewed environment and native JSON output:

```sh
pnpm run railway:apply production --json
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
