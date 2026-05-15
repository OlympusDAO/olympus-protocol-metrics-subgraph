# Envio multichain migration — todo

Tracking the migration described in `envio-multichain-migration-plan.md` (root). Update as we go; mark items `[x]` when actually done (tests/build/parity proof, not just code-written).

## Phase 0 — Baseline (done)

- [x] Verify branch `feat/envio` includes PR #313 merge (commit `330e9f3`)
- [x] `pnpm install` clean
- [x] `pnpm codegen` clean
- [x] `pnpm build` (tsc --noEmit) clean
- [x] `pnpm test` green (12/12 in `src/snapshot/pricing.test.ts`)
- [x] `pnpm format:check` clean
- [x] `pnpm lint:check` clean
- [x] Document inherited TODOs → `docs/envio-migration/inherited-todos.md`

## Phase 1 — Inventory legacy behavior (done)

- [x] `docs/envio-migration/inventory.md` — master cross-chain matrix + 8 open decisions (composed by user during Phase 1 review)
  - [x] Arbitrum → `inventory-arbitrum.md` (418 lines)
  - [x] Base → `inventory-base.md` (269 lines)
  - [x] Berachain → `inventory-berachain.md` (304 lines)
  - [x] Ethereum → `inventory-ethereum.md` (789 lines, biggest surface)
  - [x] Fantom → `inventory-fantom.md` (273 lines)
  - [x] Polygon → `inventory-polygon.md` (314 lines)
  - [x] Shared helpers → `inventory-shared.md` (599 lines)
- [x] Treasury-subgraph `metricHelper.ts` formula inventory → `inventory-treasury-subgraph.md` (proposes 26 + 6 ChainValues fields for `GlobalMetricSnapshot`)
- [x] Checkpoint with user — 10 decisions recorded below

Branch moved from `feat/envio` to `envio-multichain-migration` after Phase 2 commit 1 (per plan).

## Phase 2 — Schema + state scaffolding (done)

All commits on branch `envio-multichain-migration`:

- [x] `bb2f46e` — TokenRecord chainId + TokenSupply chainId/blockchain. Codegen + build + 12/12 tests green.
- [x] `4fbeafa` — `GlobalMetricSnapshot` + `GlobalMetricChainValues` + `GlobalMetricSupplyCategory` scaffold. Uses `@derivedFrom` for parent→child relations.
- [x] `49fe96a` — `NativeBalanceState` (closes inherited TODO #2) + `ChainlinkPriceState` (replaces snapshot-time Chainlink RPC).
- [x] `5ff5e1a` — Phase 0 + Phase 1 docs (4,100 lines) + `docs/envio-migration/schema.md`.
- [x] `01fa73a` — Remove 6 unused cache entities (ERC20TokenSnapshot, BalancerPoolSnapshot, PoolSnapshot, TokenPriceSnapshot, StakingPoolSnapshot, PriceSnapshot). Held: BophadesModule, ClearinghouseAddress, GnosisAuctionRoot, GnosisAuction, ProtocolMetric for Phase 4.

Deferred to Phase 4 (Ethereum porting): `BophadesAddressState`, `BlvVaultRegistry`, `MigrationOffsetState`, `CoolerLoanState`, GnosisAuction cross-data-source ordering markers. Their shape gets pinned by the actual porting work, not designed in a vacuum.

## Phase 3 — Recursive pricing port (TDD)

- [ ] Port L2 price-router tests to Vitest **first**
- [ ] Port `getPrice` / `getUSDRate` recursive lookup with `currentPool` guard + same-token-set guard
- [ ] Port handler interface (Stable, Remap, Chainlink, Univ2, Univ3, Balancer, Kodiak)
- [ ] Wire `ChainlinkPriceState` as base-token lookup
- [ ] Cycle/recursion tests for same-token-set pools

## Phase 4 — Per-chain rollout

- [ ] Generalize Arbitrum/Berachain into config-driven handlers
- [ ] Add Base
- [ ] Add Polygon
- [ ] Add Fantom
- [ ] Add Ethereum (last — Curve, FraxSwap, ERC4626, clearinghouse, boosted liq, custom mappings)
- [ ] `buildChainSnapshot(chainConfig, block)` per chain
- [ ] 8-hour snapshot cadence per chain

## Phase 5 — Global snapshot

- [ ] Port treasury-subgraph metric formulas
- [ ] Upsert `GlobalMetricSnapshot(YYYY-MM-DD)` on each chain snapshot
- [ ] Partial-chain completeness metadata
- [ ] Tests: complete / single-chain / late-day-update / missing-chain

## Phase 6 — Parity harness

- [ ] Diff script vs treasury endpoint
- [ ] Exact-match starting expectation; only relax with explicit approval

## Phase 7 — Performance validation

- [ ] Fresh DB backfill benchmark
- [ ] Confirm per-snapshot RPC count ≈ 0 except accepted timestamp/invariant effects
- [ ] Confirm BalancerVault + shared contracts filtered by poolId

---

## Inherited TODOs from PR #311 / #313 (carry through)

See `docs/envio-migration/inherited-todos.md`.

## Review notes

### Phase 1 decisions (2026-05-14)

1. **TokenSupply on Fantom/Polygon** — match legacy (no emit). Schema keeps the entity but per-chain handlers stay silent.
2. **Native asset balances (BERA/MATIC/FTM)** — **track** via bounded `getBalance` RPC per protocol wallet per snapshot. Closes inherited TODO #2. Adds slight parity divergence on the chains that hold native assets, but correct behavior. Schema needs `NativeBalanceState` (or fold into `TokenBalance` keyed by sentinel native address).
3. **Re-index scope** — re-index from genesis on all six chains. No grafts. Leverages HyperSync backfill speed; captures the data gap legacy grafts hid.
4. **Snapshot cadence** — per-chain block interval, calibrated to ~8h based on current chain block time. Matches existing Envio handler patterns; `GlobalMetricSnapshot` tolerates partial chains so cadence drift is acceptable.
5. **Latent legacy bugs** — fix during port, document each per-row delta in the Phase 6 changelog. Covers Fantom (wETH/abbreviation/wFTM), Arbitrum (DAO/CCB dedupe pending verification), Bera (iBGT/lBGT), Ethereum (CoolerV2 USDS, UniV3 float tick math), and the all-handler `liquidity` field fix.
6. **Treasury-subgraph metricHelper inventory** — do now as Phase 1 closeout. Repo cloned at `/Users/zach/Documents/repos/olympus/treasury-subgraph`. Inventory the whole `apps/server/src/core/` directory (8 helpers) since metricHelper depends on the others.
7. **`GlobalMetricSnapshot` shape** — nested `ChainValues` child entities (26 top-level scalars + 6 per-chain nested) to mirror the legacy endpoint exactly. Zero consumer changes. ~32 entities per day instead of one wide row.
8. **`ohmSupplyCategories`** — preserve nested with both `balance` (raw on-chain) and `supplyBalance` (signed contribution). Required for exact-match parity.
9. **Canonical chain for `protocolMetrics[0]`-derived fields** — Ethereum is canonical for `ohmIndex`/`ohmApy`/`ohmPrice`/`gOhmPrice`/`sOhmCirculatingSupply`/`totalValueLocked`. Schema reads these from the Ethereum-specific snapshot row, not from a merged array.
10. **`crossChainComplete: Boolean!`** — set at write time, true iff Arbitrum and Ethereum have both produced a snapshot for that UTC date (other chains optional). Mirrors legacy `crossChainDataComplete` query gate.

### Phase 2 decisions (2026-05-14)

11. **Legacy cache entity cleanup** — remove the 6 pure cache snapshots (ERC20TokenSnapshot, BalancerPoolSnapshot, PoolSnapshot, TokenPriceSnapshot, StakingPoolSnapshot, PriceSnapshot) — zero refs in `src/`, fully replaced by event-driven state. Keep BophadesModule, ClearinghouseAddress, GnosisAuctionRoot, GnosisAuction, ProtocolMetric for Phase 4.
12. **Branch hygiene** — work lives on `envio-multichain-migration` branched off `origin/feat/envio` (per plan). `feat/envio` rewound to remote after the first commit accidentally landed there.

