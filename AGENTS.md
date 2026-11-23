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
  `pnpm docker:scan:provider` reports provider vulnerabilities separately.

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

## Maintenance conventions

- Configure Dependabot daily with `open-pull-requests-limit: 0`: security updates only, no routine version-update PRs.
- Schedule weekly image security scans for Monday at 00:00 UTC.
- Write documentation as the current repository contract; avoid temporary phrases such as “this branch”.
- Keep Markdown table cells unpadded to avoid alignment-only churn.
- Use the existing Biome package.json sorting action for manifest keys.
