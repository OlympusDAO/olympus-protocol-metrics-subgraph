# AGENTS.md

## Project Overview

This repository indexes protocol-level metrics for Olympus contracts and Treasury/market activity to power operational dashboards.

## Contribution Guardrails

- This is an Envio HyperIndex TypeScript repository on `master`, not a legacy Graph/AssemblyScript subgraph. Follow the nearest current chain configuration and handler pattern.
- For a treasury wallet, token or chain, trace and test the complete path: chain configuration → protocol wallet registration → token definition and valuation → indexer/snapshot handling → publisher and published metric coverage.
- Use existing chain configuration and token-routing extension points. Keep the chain start block authoritative; do not add duplicate date calendars, timestamp lookups or date-specific publisher filters.
- Define valuation semantics explicitly for nonstandard assets, receipt tokens and redemption claims. Preserve liquid-backing versus economic-value distinctions, explain exceptional accounting guards and units, and avoid double counting.
- Classify liquidity with `.agents/skills/asset-liquidity/SKILL.md` whenever you add or change `isLiquid`, `multiplier` or `illiquidWallets`, or assess whether an asset is liquid. The definition it applies is `docs/asset-liquidity-rubric.md`.
- For historical balances, prices or contract state, prove reads at an anchored block with archive-capable infrastructure. A current RPC result is not historical evidence.
- Prefer supported native `viem` chain definitions over local definitions. Update version and changelog metadata only in the package being changed.
- Test pre-start and zero states, position transitions and exactly-once aggregation. After merge, verify indexed progress past the position start block, token records, price conversion and published/global inclusion.

## Node and Tooling

- Node.js must use version 24+.
- Run `mise install node pnpm railway trivy jactionlint zizmor --locked` to install the tools declared in `mise.toml` and `mise.lock`.
- Keep `.nvmrc`, `.node-version`, Dockerfiles and `package.json` aligned with the mise tool versions.
- Run `pnpm install --frozen-lockfile` before dependency-dependent work.

## Local Validation Before Commit and Push

Invoke canonical scripts unchanged. Use tool-level working-directory, output-limit
and polling controls. Do not append redirection, `tee`, `tail`, environment
assignments or shell wrappers merely to manage output. Durable logging belongs
inside the canonical script and must preserve its exit status.

Use the [canonical validation command table](docs/validation.md):

- `pnpm run validate`: required source checks; no Docker.
- `pnpm run validate:images` and `pnpm run test:integration`: required for
  container/deployment/runtime changes; build owned images before integration.
- `pnpm run validate:all`: all applicable groups. Optional
  `pnpm scan:docker:provider` reports provider vulnerabilities separately.

Before committing code, dependencies or CI changes, run `pnpm run validate`.
For container, deployment or runtime changes, also run image and integration
validation. Do not repeat unchanged successful checks without a reason.
For documentation-only changes, run `pnpm run check` and inspect command/link
examples. For manifest/lock policy changes, clear generated root/workspace `node_modules`
and any repository-local package store, then run `pnpm install --no-frozen-lockfile`
followed by `pnpm install --frozen-lockfile`. Preserve unrelated global caches.
Use `pnpm run check:runtime-versions` and `pnpm run lint:actions` for focused checks.

For nontrivial changes, use the `autoreview` skill unless the task explicitly
prohibits extra agents or assigns review to a coordinator. Correct accepted
findings and repeat affected validation. Run `git diff --check`, invoke the
`privacy-gate` skill and run `privacy-gate pre-commit` before each Git commit.
Never bypass installed hooks.

For indexing performance changes, measure the baseline first and repeat the same
workload after implementation using `pnpm run benchmark:rpc`; see
[benchmark limitations](docs/performance/rpc-indexer.md). Do not claim savings
from a synthetic cache hit alone. For IaC, inspect a native Railway plan using
[the runbook](.railway/README.md); live application requires separate approval.

Before pushing, confirm validation covers the exact content, use
`coderabbit-local-review`, complete the privacy-gate push procedure and ask for
publication approval. Before any PR operation, invoke `github-account`.
Report performed checks, skips and blockers; never claim unrun checks passed.
Ask before rewriting, discarding or publishing history or changing PR state.

## Service environment variables

Treat service environment variables as required unless the runbook explicitly
marks them optional and states their default or behavior when absent.
Validate required values at service startup before network or database requests.
Exit nonzero on missing or invalid configuration. Log the variable name or a
fixed diagnostic, never its value. Validate optional values when supplied.

## Image Security Policy

- Scan owned images with Trivy `vuln,secret` at `MEDIUM,HIGH,CRITICAL`.
  The native default in `trivy.yaml` filters unfixed vulnerabilities.
  Keep the default in that file. Fixable vulnerabilities and secrets at
  those severities fail with exit code 1. Scanner errors fail. Do not add
  status filters.
- Each CVE exception requires explicit user approval. Record the affected
  package and version, rationale, and approval in comments above the native
  `.trivyignore` entry `CVE-… exp:YYYY-MM-DD`. Remove it when fixed. Trivy
  enforces expiration.
- Provider scans use `--scanners vuln` at all severities and
  `--ignore-unfixed=false` to include unfixed findings. Findings are advisory
  with `--exit-code 0`. Native execution errors fail. Default scans exclude
  local and historical fixtures. Record exclusions and provider scans that
  were not run separately from passed scans.

## Maintenance conventions

- Configure Dependabot daily with `open-pull-requests-limit: 0`: security updates only, no routine version-update PRs.
- Schedule weekly image security scans for Monday at 00:00 UTC.
- Write documentation as the current repository contract; avoid temporary phrases such as “this branch”.
- Keep Markdown table cells unpadded to avoid alignment-only churn.
- Use the existing Biome package.json sorting action for manifest keys.

## Package commands and indexer monitoring

- Name repository commands action-first: `dev:indexer`, `start:indexer`,
  `build:docker:indexer`, `scan:docker`, `plan:railway`, and `check:openapi`.
  Keep native package-manager lifecycle names such as `pretest` unchanged.
  Update every tracked caller when renaming a command; do not retain duplicate aliases.
- Run the repository-level `pnpm lint` for formatting and manifest sorting.
- Keep the indexer monitor in `apps/indexer-monitor`, with its own compiled
  TypeScript app and dedicated non-root Docker image. Use the same pinned Alpine
  multi-stage `pnpm --filter indexer-monitor deploy --prod /deploy` packaging;
  do not include the indexer runtime or development tools in its production image.
- Give the monitor its own private `monitor-state` bucket and native bucket
  credential references. Keep alert state separate from application artifacts.
- Discord routing uses the actual Railway environment name: exactly `production`
  selects the production service webhook and omits the environment label; every
  other named environment requires the preview webhook and keeps its name.
  Do not add production-ID or renamed-environment exceptions to Discord routing.
  Preserve the documented explicit local mode when Railway identity is absent.

## Error reasons

Give thrown errors meaningful, nonempty reasons. Use fixed descriptions or
configuration names; never include credentials or private request values.
The existing Biome checks enforce `suspicious/useErrorMessage` as an error
within their configured source scopes. This policy also applies to scripts
outside those scopes; do not add empty messages to satisfy the rule.

## Infrastructure release eligibility

Use the same visible CI labels across the indexing repositories: `Release images
and integration`, `Dependency audit`, `<service> image`, and `Railway infrastructure
apply`. Preserve job IDs and gate ordering when changing display names.

When CI automatically applies infrastructure, keep event, ref, repository and
merged-commit eligibility checks inline in the workflow. Checked-out scripts
must not grant their own apply eligibility. Gate later helpers on the eligibility
output and keep provider credentials behind the required status checks.
Production IaC applies inside the same CI workflow after source, image/integration
and required external checks. Fail closed for direct or untrusted production
pushes. Do not automatically cancel production workflows or active applies.
Keep Railway GitHub sources on `checkSuites: true`; verify live Wait for CI before
activation. Native apply can itself trigger builds, so use compatible staged
service changes. Preserve separately approved database reset/rebuild procedures.
Manual maintenance apply still requires explicit operator approval.
