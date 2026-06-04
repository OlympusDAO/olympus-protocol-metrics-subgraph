# Olympus Protocol Metrics Indexer

Treasury and protocol metrics indexer for Olympus DAO. Powers the
[Olympus Treasury Dashboard](https://app.olympusdao.finance/).

Built on [Envio HyperIndex](https://docs.envio.dev/) (v3, multichain).
The previous implementation used The Graph Protocol with separate
subgraphs per chain; that code has been replaced by the single Envio
indexer in this repository (see `apps/indexer/config.yaml`,
`apps/indexer/schema.graphql`, and `apps/indexer/src/`). The Graph
deployments are no longer maintained.

## Chains indexed

| Chain     | Chain ID | Start block | Source           |
| --------- | -------- | ----------- | ---------------- |
| Ethereum  | 1        | 12,000,000  | HyperSync + RPC  |
| Polygon   | 137      | 23,000,000  | HyperSync + RPC  |
| Fantom    | 250      | 37,320,000  | HyperSync + RPC  |
| Base      | 8453     | 13,204,827  | HyperSync + RPC  |
| Arbitrum  | 42161    | 10,950,000  | HyperSync + RPC  |
| Berachain | 80094    | 799,194     | HyperSync + RPC  |

## Setup

```sh
pnpm install
cp apps/indexer/.env.sample apps/indexer/.env  # then fill in RPC URLs and Envio token
pnpm codegen         # generates types from the indexer schema/config
```

## Running locally

```sh
pnpm envio:dev   # boots a local indexer + Postgres + Hasura via Docker
pnpm envio:start # runs the indexer against an existing Postgres
```

Per-chain RPC endpoints come from `apps/indexer/.env`:

- `ENVIO_ETHEREUM_RPC_URL`, `ENVIO_ARBITRUM_RPC_URL`,
  `ENVIO_POLYGON_RPC_URL`, `ENVIO_FANTOM_RPC_URL`,
  `ENVIO_BASE_RPC_URL`, `ENVIO_BERACHAIN_RPC_URL`
- `ENVIO_API_TOKEN` — required for HyperSync access

HyperSync is the primary data source for supported chains; the
configured RPC is the fallback (and the source for snapshot-time
`balanceOf` / pricing reads).

## Snapshots

The indexer runs an 8-hour-cadence block handler (`EightHourSnapshot`)
on every chain that produces three entity types per snapshot:

- `TokenRecord` — one row per (token, wallet) the treasury holds, with
  price, balance, and USD value.
- `TokenSupply` — OHM supply attribution rows (Total Supply, Treasury
  holdings, Liquidity-bound, Lending-bound, etc.) that compose into
  circulating / floating / backed supply at the global level.
- `GlobalMetricSnapshot` — cross-chain rollup keyed by UTC date. Holds
  `treasuryMarketValue`, `treasuryLiquidBacking`, OHM price, supply
  derivations, etc. Per-chain breakdowns live in
  `GlobalMetricChainValues`.

The intervals are tuned per chain (see `BLOCK_HANDLERS` in
`apps/indexer/src/handlers/BlockHandlers.ts`) so each chain emits ~3
snapshots per UTC day.

## Tests

```sh
pnpm test           # vitest, all handler tests
pnpm test -- --watch
pnpm build          # tsc --noEmit
pnpm check          # biome (lint + format)
pnpm validate       # check + build + test (CI parity)
```

Indexer tests use Envio's `createTestIndexer()` to drive handlers against
real block ranges sourced via HyperSync — no mocks for on-chain state. See
`apps/indexer/tests/handlers/` for examples.

## Repository layout

```
apps/indexer/
  config.yaml            Envio contract/chain config (handlers register against it)
  schema.graphql         Entity schema; runs through `pnpm codegen`
  src/
    handlers/            Event + onBlock handlers
    snapshot/
      chains/            Per-chain config (tokens, wallets, pricing handlers)
      *.ts               Cross-chain primitives (math, types, pricing helpers)
    effects/             Envio Effect API wrappers for cached RPC reads
    pricing/             Per-pool pricing logic (UniV2, UniV3, Balancer, Kodiak,
                         Curve, Chainlink, ERC4626, remap)
  tests/                 Vitest handler tests
apps/metrics-api/        Public REST API
apps/metrics-publisher/  Artifact publisher
apps/client/             Published TypeScript API client
packages/                Shared non-app packages
scripts/parity-diff.ts   Compare Envio output to the legacy treasury endpoint
docs/envio-migration/    Migration notes + per-chain inventory of what we index
```

## Adding tokens / wallets / pools

The per-chain config in `apps/indexer/src/snapshot/chains/<chain>.ts` is
the single source of truth. Each chain config exports:

- `tokens`: token definitions (category, decimals, optional
  `nonStandardBalance: true` for tokens whose `balanceOf` is the truth
  rather than the event-accumulated ledger)
- `protocolAddresses`: wallets we treat as treasury for that chain
- `liquidityHandlers`: pools used for pricing
- `ownedLiquidityHandlers`: pools where the treasury holds POL (POL
  totals contribute to TokenSupply Liquidity category)
- `names`, `abbreviations`: human labels for the dashboard

Then add the contract address to the relevant `address` list in
`apps/indexer/config.yaml` if the new token/pool isn't already covered by
an existing `contracts:` entry. Run `pnpm codegen` after any
`apps/indexer/config.yaml` or `apps/indexer/schema.graphql` change.

## Parity with the legacy endpoint

`scripts/parity-diff.ts` diffs `GlobalMetricSnapshot` against the
treasury-subgraph aggregator at
`https://olympus-treasury-subgraph-prod.web.app/graphql`:

```sh
pnpm exec tsx scripts/parity-diff.ts \
  --start 2026-05-15 --end 2026-05-20 \
  --envio https://your-envio-endpoint.example/v1/graphql \
  --treasury https://olympus-treasury-subgraph-prod.web.app/graphql
```

CSV-style output, one line per (date, field) divergence beyond the
tolerance (default 0 — exact match).
