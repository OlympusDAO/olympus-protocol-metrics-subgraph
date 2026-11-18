# Railway infrastructure

The whole-project definition covers the `treasury-subgraph` production environment. It retains the imported application services, database, database volume, PostgreSQL group, and bucket. It adds the private `rpc-cache` service and an independent, image-backed PostgreSQL 18 service and volume. The image-backed database avoids the managed template's public TCP proxy. Application limits, schedules, public domains, and artifact variables follow the imported deployment and its service config files. Optional operator variables remain available through the ignore list.

## Preview the change

Use Node 24, the repository's pinned Railway SDK, and Railway CLI 5.75.0. With a Railway login or token that can read the production project, link project `1eff0b7c-1ab5-4f50-8c0d-29086746a17b` and environment `34764411-35d7-466c-8249-612730c36c07`.

```bash
pnpm install --frozen-lockfile
railway status
railway config migrate status
pnpm railway:plan --bootstrap
```

The plan command checks the linked project and selects production by ID. It saves a Railway-native plan in a private temporary directory and rejects deletions, replacements, volume changes, database changes, and unrelated drift. Review the saved change set and confirm the existing resource IDs, database image and mount, volume size, bucket, and domains before approval. The original Postgres image was observed as PostgreSQL 18 at digest `sha256:14bece74105090e05d4eb57c075442cb2057e899cd8858b508c5eafda3fe725f`. Keep plans, CLI variable exports, and provider credentials outside Git.

If the plan is blocked by active Config as Code ownership, get approval for the ownership switch before publishing the legacy file removals. Use Railway's `config migrate cutover` in the verified production environment. Target only `hasura`, `indexer`, `metrics-api`, and `metrics-publisher`. Railway saves their previous config paths for `config migrate undo`. Generate a fresh plan after an ownership change.

## Provision and route

The application services build from `master`. Before applying the bootstrap
plan, verify that the approved release on `master` contains the Dockerfiles
and runtime files named in the plan.

1. After approval, apply the saved bootstrap plan manually. Bootstrap preserves the indexer's current RPC URLs. Configure `UPSTREAM_RPC_URL_<id>` on the new cache for chain IDs 1, 137, 250, 8453, 42161, 80094, and 4663, using each chain's archive provider. `preserve()` retains supplied values. Provisioning does not inject the provider secrets.
2. Verify the cache health endpoint and historical RPC reads over the Railway private network. Verify that the cache database has its own attached volume. Confirm that the existing indexer and scheduled publisher remain healthy.
3. Run `pnpm railway:plan` without `--bootstrap` to preview the seven indexer RPC routes. Approve and apply that fresh plan manually, then verify indexer progress and publisher output. For each approved apply, use `railway config apply --environment 34764411-35d7-466c-8249-612730c36c07 --plan <private-plan-path>`. The plan etag prevents applying against a changed environment.

Retain the original RPC credentials in the team's secret store so the seven direct indexer URLs can be restored if cutover fails. A route rollback does not require an Envio reset or removal of the cache volume. Keep existing service domains and the bucket mapping until an independently approved change.

[Railway CLI IaC and Config as Code migration](https://github.com/railwayapp/cli/blob/v5.75.0/assets/iac/README.md)
