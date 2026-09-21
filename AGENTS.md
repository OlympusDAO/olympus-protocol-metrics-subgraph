# AGENTS.md

## Project Overview

This repository indexes protocol-level metrics for Olympus contracts and Treasury/market activity to power operational dashboards.

## Contribution Guardrails

- This is an Envio HyperIndex TypeScript repository on `master`, not a legacy Graph/AssemblyScript subgraph. Follow the nearest current chain configuration and handler pattern.
- For a treasury wallet, token or chain, trace and test the complete path: chain configuration → protocol wallet registration → token definition and valuation → indexer/snapshot handling → publisher and published metric coverage.
- Use existing chain configuration and token-routing extension points. Keep the chain start block authoritative; do not add duplicate date calendars, timestamp lookups or date-specific publisher filters.
- Define valuation semantics explicitly for nonstandard assets, receipt tokens and redemption claims. Preserve liquid-backing versus economic-value distinctions, explain exceptional accounting guards and units, and avoid double counting.
- For historical balances, prices or contract state, prove reads at an anchored block with archive-capable infrastructure. A current RPC result is not historical evidence.
- Prefer supported native `viem` chain definitions over local definitions. Update version and changelog metadata only in the package being changed.
- Test pre-start and zero states, position transitions and exactly-once aggregation. After merge, verify indexed progress past the position start block, token records, price conversion and published/global inclusion.

## Node and Tooling

- Node.js must use version 24+.
- Use `.nvmrc` and `.node-version` files for version alignment.
- Run `pnpm install --frozen-lockfile` before dependency-dependent work.

## Common Commands

- `pnpm install --frozen-lockfile`: install dependencies
- `pnpm run lint` or repository lint equivalent: run project lint checks
- `pnpm run build` or repository build equivalent: validate builds succeed
- `pnpm test` or repository test equivalent: validate behavior changes
