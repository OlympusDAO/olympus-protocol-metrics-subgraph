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
- Run `mise install --locked` to install the tools declared in `mise.toml` and `mise.lock`.
- Keep `.nvmrc`, `.node-version`, Dockerfiles and `package.json` aligned with the mise tool versions.
- Run `pnpm install --frozen-lockfile` before dependency-dependent work.

## Common Commands

- `pnpm install --frozen-lockfile`: install dependencies
- `pnpm run check`: run Biome and actionlint without modifying files
- `pnpm run validate`: run checks, type checking, builds and the unit test suite
- `pnpm audit --audit-level moderate`: run the dependency vulnerability check

## Local Validation Before Commit and Push

Run existing package and repository scripts unchanged. Use tool-level working-directory, output-limit and polling controls.
Do not append redirection, `tee`, environment assignments or shell wrappers to manage output.
For durable logs, implement logging in the canonical script and preserve its exit status.

### Before a commit

For code, dependency, build or CI changes, run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run codegen
pnpm run validate
pnpm audit --audit-level moderate
```

`validate` includes Biome, actionlint, type checking, builds and unit tests. Do not repeat these checks separately without a reason.

- For manifest, lockfile or workspace policy changes, first clear the repository's generated install state.
  Remove the root and workspace `node_modules` directories and any repository-local pnpm store.
  Run `pnpm install --no-frozen-lockfile`.
  Clear that install state again.
  Run `pnpm install --frozen-lockfile`.
- For nontrivial code or CI changes, use the `autoreview` skill before the commit.
  Correct accepted findings and repeat the affected validation.
- For documentation-only changes, run `pnpm run check` and review the changed links and command examples.
- For Git checkouts, run `git diff --check`.
- Invoke the `privacy-gate` skill before each Git commit.
  Run `privacy-gate pre-commit` before committing.

### Additional checks for affected components

- For Dockerfile, container startup or dependency changes, validate each affected image.
  The image names are `indexer`, `hasura`, `metrics-api`, `metrics-publisher` and `rpc-cache`.
  Build the current source with `pnpm run docker:build:<image>`.
  Tag that image with `pnpm run docker:tag:scan:<image>`.
  Scan that image with `pnpm run docker:scan:<image>`.
- For RPC cache or cache integration changes, build the cache image and run `pnpm run test:rpc-cache`.
  This test requires Docker, or the documented Podman override.
- For indexing performance changes, measure the baseline before implementation.
  After implementation, repeat the benchmark with the same workload.
  Compare the results before claiming an improvement.
  Use `pnpm run benchmark:rpc` as described in `docs/performance/rpc-indexer.md`.
- For IaC changes, generate and inspect a native Railway plan as described in `.railway/README.md`.
  Infrastructure application requires separate approval and is not a validation command.

### Before a push

- Verify that the checks cover the exact changes to push.
  If the validated content is unchanged, reuse the successful results.
- Use the `coderabbit-local-review` skill before pushing or updating a PR.
  Correct accepted findings and repeat the affected validation.
- Before any PR operation, invoke the `github-account` skill.
- Complete the `privacy-gate` push procedure.
  Keep the installed hooks enabled.
- Ask before pushing or changing PR state.
- Report the checks performed, skipped checks and unresolved blockers.
  Do not report an unperformed check as passed.
