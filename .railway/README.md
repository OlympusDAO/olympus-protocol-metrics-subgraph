# Railway infrastructure

The whole-project definition covers the `treasury-subgraph` production environment. It retains the imported application services, database, database volume, PostgreSQL group, and bucket. It adds the private `rpc-cache` service and an independent, image-backed PostgreSQL 18 service and volume. The image-backed database avoids the managed template's public TCP proxy. Application limits, schedules and artifact variables retain the imported deployment settings. Only `metrics-api` has a public custom domain. Main Postgres, cache Postgres, eRPC, Hasura, indexer and scheduled publisher explicitly remove public service/custom domains and TCP proxies; private endpoints remain available. The indexer has no docs site or public ingestion specification endpoint. Optional operator variables remain available through the ignore list.

## Preview the change

Run `mise install --locked` to install the pinned Node, pnpm and Railway CLI versions. With a Railway login or token that can read the production project, link project `1eff0b7c-1ab5-4f50-8c0d-29086746a17b` and environment `34764411-35d7-466c-8249-612730c36c07`.

```bash
pnpm install --frozen-lockfile
railway status
railway config migrate status
plan_dir="$(mktemp -d)"
pnpm railway:plan:bootstrap --environment 34764411-35d7-466c-8249-612730c36c07 --out "$plan_dir/bootstrap.json"
```

The package scripts call Railway's native read-only `config plan` command. Bootstrap preserves the current indexer RPC URLs while adding the cache stack. Review the saved change set and confirm the existing resource IDs, database image and mount, volume size, bucket, and domains before approval. Both production databases use the same verified upstream PostgreSQL 18.6 template digest from `.railway/images.json`. Keep the template entrypoint, TLS behavior, PGDATA, existing mount paths and volume identities. Digest pinning does not establish a clean vulnerability scan; inspect the canonical image-validation evidence before approval. Keep plans, CLI variable exports, and provider credentials outside Git.

If the plan is blocked by active Config as Code ownership, get approval for the ownership switch before publishing the legacy file removals. Use Railway's `config migrate cutover` in the verified production environment. Target only `hasura`, `indexer`, `metrics-api`, and `metrics-publisher`. Railway saves their previous config paths for `config migrate undo`. Generate a fresh plan after an ownership change.

## Provision and route

The application services build from `master`. Before applying the bootstrap
plan, verify that the approved release on `master` contains the Dockerfiles
and runtime files named in the plan.

1. After approval, apply the saved bootstrap plan manually. Bootstrap preserves the indexer's current RPC URLs. Configure `UPSTREAM_RPC_URL_<id>` on the new cache for chain IDs 1, 137, 250, 8453, 42161, 80094, and 4663, using each chain's archive provider. `preserve()` retains supplied values. Provisioning does not inject the provider secrets.
2. Verify the cache health endpoint and historical RPC reads over the Railway private network. Verify that the cache database has its own attached volume. Confirm that the existing indexer and scheduled publisher remain healthy.
3. Run `pnpm railway:plan --environment 34764411-35d7-466c-8249-612730c36c07 --out <private-plan-path>` to preview the seven indexer RPC routes. Approve and apply that fresh plan manually, then verify indexer progress and publisher output. For each approved apply, use `railway config apply --environment 34764411-35d7-466c-8249-612730c36c07 --plan <private-plan-path>`. The plan etag prevents applying against a changed environment.

Retain the original RPC credentials in the team's secret store so the seven direct indexer URLs can be restored if cutover fails. A route rollback does not require an Envio reset or removal of the cache volume. The approved source removes non-API public domains/proxies on a future apply. Verify the saved plan removes only those networking resources, preserves private communication, and retains the bucket mapping and existing data/volume bindings. These are prepared source changes, not a statement that production has already been changed.

[Railway CLI IaC and Config as Code migration](https://github.com/railwayapp/cli/blob/v5.75.0/assets/iac/README.md)

## Storage and local checks

Use native `railway config plan`/`railway config apply` with the explicit environment
and reviewed saved plan above. There is no custom plan/apply wrapper. The
bootstrap alias only preserves upstream routes during cache provisioning; it
does not bypass resource lookup, password preservation, capacity or target checks.
No live plan or apply is part of local validation.

See [canonical validation](../docs/validation.md),
[artifact permissions and provider limitations](../docs/artifact-permissions.md)
and [cache capacity](../docs/cache-capacity.md). True API read-only credentials
need provider support and separately approved live provisioning. Do not put
provider credentials or plan contents in Git.
