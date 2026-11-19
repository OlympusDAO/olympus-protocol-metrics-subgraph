# Reconcile public domains

Only the `metrics-api` service may have public generated or custom HTTP domains.
Its desired source hostname remains `treasury-subgraph-api.olympusdao.finance`
on port 8080. The exposure guard permits other valid hostnames on that service;
it imposes no additional hostname or target-port restriction. All other
application services and databases must have neither HTTP domain kind.

Railway CLI 5.75.0 excludes HTTP domains from its native config networking diff.
An empty desired domain map cannot remove an existing domain. Its supported
`railway domain delete` command provides the narrow removal operation. The
IaC definition remains side-effect-free apart from read-only resource queries.
It blocks unexpected exposure during evaluation and retains database resource
identities, volumes, passwords, mounts and private endpoints.

## Prepare the review without changes

Use the pinned CLI. Set the reviewed target explicitly; these values identify
the existing Metrics production environment:

```sh
PROJECT_ID=1eff0b7c-1ab5-4f50-8c0d-29086746a17b
ENVIRONMENT_ID=34764411-35d7-466c-8249-612730c36c07
railway domain list --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service indexer --json
railway domain list --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service hasura --json
railway domain list --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service metrics-publisher --json
railway domain list --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service Postgres --json
railway domain list --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service metrics-api --json
```

Also inventory the whole environment's service identities and HTTP/TCP exposure,
with complete pagination, so an unlisted service cannot escape review. Include
`rpc-cache` and `rpc-cache-postgres` when provisioned. Their absence before
provisioning is expected; never treat an unreadable existing service as absent.
Do not decrypt variables or export credentials for this review.

Prepare a private review artifact containing the inventory timestamp, target
project/environment, service names and IDs, each exact domain ID/type/hostname,
the exact native deletion commands, preserved API domains and expected final
exposure. Keep live inventory and approval records outside Git. This is a domain-reconciliation
review artifact; it is separate from native `railway-plan.json`.

Stop for explicit live approval of those named deletions. Approval to prepare
source or run a read-only plan does not approve domain removal. If the current
inventory differs from the reviewed artifact, obtain a fresh review before
performing changed operations. Do not edit a native config change set to inject
unsupported HTTP-domain operations.

## Execute only approved deletions

The following are templates, not authorized operations. Replace each uppercase
domain-ID placeholder with the exact reviewed ID. The private review artifact
must contain executable commands with explicit service IDs and no placeholders.
Do not target the API's domains. Do not loop over or delete all returned domains.

```sh
railway domain delete REVIEWED_INDEXER_DOMAIN_ID --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service indexer --yes --json
railway domain delete REVIEWED_HASURA_DOMAIN_ID --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service hasura --yes --json
railway domain delete REVIEWED_PUBLISHER_DOMAIN_ID --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service metrics-publisher --yes --json
railway domain delete REVIEWED_POSTGRES_DOMAIN_ID --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" --service Postgres --yes --json
```

The native command resolves the scoped service, finds the requested domain only
within that service, deletes that domain ID, refetches the domain list and fails
if the ID remains. It performs a domain-specific operation; no database
recreation, volume detach, credential update or private-endpoint change is
part of this procedure. Commands are sequential, not an atomic transaction.
On failure, stop and re-inventory completed and remaining operations before
continuing. A newly generated replacement hostname would be a separate change;
do not treat domain recreation as an automatic rollback.

## Verify and continue

Repeat the complete read-only inventory after approved deletions. Require zero
generated/custom domains on every non-API service, preserve API domains, and
check TCP proxies separately: domain deletion does not remove them. Verify
unchanged resource/volume identities and private connectivity without exposing
a database. Fresh drift requires a new review, not a blanket deletion.

Then follow the [native plan/apply runbook](README.md#preview-the-change), including
private plan-file permissions, exact environment, separate approval, JSON status
review and complete postapply inventory/fresh plan. Keep the consumed artifact
private. No native config plan can substitute for unsupported domain deletion.

## Local validation scope

`pnpm run test:root` covers both domain kinds on every private service, alternate
API hostnames, drift and reconciled state in the installed SDK authoring callback
with a read-only plan context. Saved-plan apply does not execute that callback. Provider responses are
fixtures; these are not native CLI/backend evaluation or deployed-removal tests.
Native deletion behavior is grounded
in the pinned CLI source and its help, not a simulated backend or compiler.

See [native domain commands](https://github.com/railwayapp/cli/blob/v5.75.0/src/commands/domain.rs),
[Railway domain API documentation](https://docs.railway.com/integrations/api/manage-domains),
the [deployment runbook](README.md) and [security posture](../docs/security-posture.md).
