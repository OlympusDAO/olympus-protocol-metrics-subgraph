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

## Phase 3 — Recursive pricing port (done)

All commits on `envio-multichain-migration`. 21/21 tests pass.

- [x] `70a7316` — `feat(pricing): add ChainlinkPriceHandler` (with 3 unit tests). New `chainlink` kind on `LiquidityHandler`. CHAINLINK_PRIORITY (10^30) liquidity for oracle-over-pool tiebreaking.
- [x] `b9e7da3` + `c28d34d` — `feat(handlers): index Chainlink AnswerUpdated`. ChainlinkAggregator contract def + Arbitrum ETH/USD feed wiring + `applyAnswerUpdated` helper + 3 helper tests.
- [x] `340b571` — `fix(pricing): match legacy per-handler liquidity behavior`. PriceLookup signature change (returns PriceLookupResult). Remap pass-through, UniV3/Quoter/Kodiak use indexed `state.liquidity`, others remain ZERO matching legacy.
- [x] `2e7e1d4` — `test(pricing): explicit cycle/recursion guards for the router`. 3 synthetic-config tests pinning currentPool guard, hasSameTokenSet guard, broken-pool fallback.

Deferred to Phase 4: ERC4626 (Ethereum-only, U64.MAX_VALUE liquidity pattern). UniV3 token balance tracking via Mint/Burn/Swap deltas (TODO(univ3-balances)). UniV3 liquidity uses indexed `state.liquidity` proxy instead — tracks legacy selection in practice, documented divergence.

## Phase 4 — Per-chain rollout (in progress)

All commits on `envio-multichain-migration`. Validation: codegen + build + 21/21 tests green at every step.

- [x] Generalize: introduced `ChainId` type alias (replaces inline `42161 | 80094` narrows) + `emitsTokenSupply` flag (Polygon/Fantom set false to match legacy no-emit). Wallets module mirrors shared `WALLET_ADDRESSES` for cross-chain reuse.
- [x] `93c0ea5` — `feat(chains): add Base (chainId 8453)`. 5 ERC20s, 1 wallet (DAO MS), 2 POL pools, Chainlink ETH/USD + USDC/USD feeds, OHM in DAO MS blacklisted from treasury balance.
- [x] `a875d14` — `feat(chains): add Polygon (chainId 137) + emitsTokenSupply flag`. 8 ERC20s + 1 POL (UniV2 wETH-gOHM), 36 inherited wallets, no Chainlink, KLIMA + Staked KLIMA carry 0.85 multiplier, Staked KLIMA remaps to KLIMA.
- [x] `00a86e9` — `feat(chains): add Fantom (chainId 250)`. 11 ERC20s + 1 POL (UniV2 wFTM-gOHM), 2 wallets, no Chainlink, fixed legacy abbreviation/name-map bugs (L2/L3) by using separate `names`/`abbreviations` maps.
- [x] `59d1539` — `feat(handlers): wire NativeBalanceState via snapshot-time getBalance`. Closes inherited TODO #2. Wires native ETH on Arbitrum + Base, native BERA on Berachain (was already configured but skipped), native FTM on Fantom. Polygon native MATIC deferred (no convenient WMATIC pricing pool currently in config).
- [x] Add Ethereum — largest surface, treated as its own sub-phase:
  - [x] `288bb04` — `feat(chains): add Ethereum baseline`. 13 tokens (7 stables + 4 bluechips + 2 OHMs + gOHM + native ETH), 36-wallet shared list, 7 Chainlink feeds (USDS reuses DAI feed), 3 UniV3 pricing pools (WETH-OHM, WETH-wstETH, weETH-WETH), native ETH remap to WETH. OHM tokens excluded from treasury MV pending Buyback MS / Bophades refinements.
  - [x] `d5e6d52` — `feat(chains-ethereum): add long-tail volatile tokens with UniV3 pricing`. FXS, LDO, LQTY, BTRFLY V1/V2, xBTRFLY remap, rlBTRFLY with 0.89 multiplier.
  - [x] `3e681dc` — `feat(chains-ethereum): add Aave receipt + variable-debt tokens`. aDAI + aEthUSDe receipts share their underlying Chainlink feeds; varDebtEthUSDC + varDebtEthUSDT carry `isLiability: true` so balances subtract from treasury MV. `token()` helper extended with `isLiability` option.
  - [x] `634112a` — `fix(chains-ethereum): restore Aave V3 start block to Olympus deployment`. ERC20_AAVE_V3_BLOCK = 24_707_147 (Olympus position deployment + legacy graft block per inventory §2). Reverts the earlier "fix" that conflated this with Aave V3 protocol launch.
  - [x] `109e583` — `feat(pricing): add GohmPriceHandler driven by sOHM V3 LogRebase`. New `OhmIndexState` entity + `SOhmV3.LogRebase` handler + `gohm` LiquidityHandler kind. gOHM price = OHM_price × index/1e9 via recursive lookup, GOHM_PRIORITY tiebreaker. 6 new tests.
  - [x] `751a47f` — `feat(handlers): event-driven Bophades module tracking via Kernel.ActionExecuted`. Redesigned BophadesModule (chainId-keycode) + ClearinghouseAddress entities; new `resolveBophadesKeycode` effect; Kernel handler writes BophadesModule on InstallModule/UpgradeModule; TRSRY V1.1 added to wallets. 7 new tests.
  - [x] `1036f4b` — `feat(chains-ethereum): port Cooler Loans receivables to snapshot`. `ChainConfig.coolerClearinghouses` + two cached effects (`readCoolerPrincipalReceivables`, `readMonoCoolerTotalDebt`) + `pushCoolerReceivables` snapshot hook. Ethereum registers V1/V1.1/V2/MonoCooler; MonoCooler carries `priceToken: ERC20_DAI` per Phase 1 decision #5 (USDS-debt-priced-as-DAI quirk).
  - [x] `a7f91df` — `feat(chains-ethereum): port Boosted Liquidity Vault supply tracking`. `ChainConfig.blvRegistry` + `snapshotBlvRegistry` effect iterates active vaults + reads `getPoolOhmShare()` per vault. `pushBlvSupply` writes one TokenSupply per vault with `type="Boosted Liquidity Vault"` and supplyBalance multiplier -1.
  - [x] `e1f39d3` — `feat(handlers): port Olympus V1 bond auction supply tracking`. GnosisAuction now chainId-scoped; BondManager.GnosisAuctionLaunched + GnosisEasyAuction.AuctionCleared handlers; `pushGnosisAuctionSupply` snapshot path emits PREMINTED/VESTING/DEPOSITS rows; `readBondManagerState` effect; BondManager OHM balance from TokenBalance for partial-burn adjustment. 4 new tests.
  - [x] `e8ee912` — `feat(chains-ethereum): port OHM V1→V2 migration offset`. `ChainConfig.migrationOffset` (start/end blocks + sOhmAddress + offsetOhm) → `pushMigrationOffsetSupply` writes one OHM_MIGRATION_OFFSET row sourced from OhmIndexState (no RPC).
  - [x] `b3eb3d9` — `feat(chains-ethereum): wrap Convex staked-LP positions via remap`. 3 Convex BaseRewardPool wrappers as remap → underlying Curve LP (no separate effect needed; transfers flow through TreasuryERC20 pipeline).
  - [x] `0e4f920` — `feat(chains-ethereum): wire Balancer POL pools + Aura BPT wrappers`. Extended BalancerPriceHandler.getPrice to return BPT price; 4 Balancer pools + 4 Aura vault wrappers registered as TreasuryERC20 + remap handlers.
  - [x] `c5e05f0` — `feat(pricing): add Erc4626PriceHandler for sDAI / sUSDe / sUSDS / Gauntlet sUSDS`. New `erc4626` LiquidityHandler kind + cached `readErc4626AssetsPerShare` effect + Ethereum config wiring for 4 vaults.
  - [x] `2f9bee9` — `feat(pricing): add Curve + FraxSwap LP pricing handlers`. New `curve` + `fraxswap` LiquidityHandler kinds; `snapshotCurvePool` + `snapshotFraxSwapPool` effects; Ethereum registers 3 Curve + 2 FraxSwap LPs. 4 new tests.
  - [x] `3985064` — `feat(chains-ethereum): port UniV3 NFT POL position enumeration`. `ChainConfig.univ3PositionManager` + `snapshotUniv3NftPositions` effect + `univ3PositionAmounts` math helper + `pushUniv3NftPol` snapshot path. Reads sqrtPriceX96 from indexed Univ3PoolState (no RPC). 4 new tests.
- [x] `b5cf1d4` — `test(handlers): per-chain snapshot validation tests + fix EIP-55 checksums`. Smoke tests for Arbitrum / Base / Ethereum each wiring a minimal context + asserting one TokenRecord row builds correctly. Also fixed 4 ERC4626 addresses missing EIP-55 checksums in config.yaml.

## Phase 5 — Global snapshot

- [x] `b5dbd31` — `feat(snapshot): wire GlobalMetricSnapshot aggregation per-snapshot (Phase 5 v1)`. New `src/snapshot/global.ts` (pure functions) + `updateGlobalMetricSnapshot` in BlockHandlers + `date @index` on TokenRecord/TokenSupply. Per-chain MV/LB/supply aggregation, cross-chain summation with chainsIndexed/chainsMissing/crossChainComplete, derived ratios, Ethereum BLV inclusion-block rule, Buyback MS OHM-in-MV gate. 7 new tests.
- [x] `4fc070d` — `feat(snapshot): resolve canonical ohmPrice/gOhmPrice in GlobalMetricSnapshot`. Ethereum's recursive pricing router resolves OHM USD price; gOhmPrice = ohmPrice × ohmIndex. Wrapped in pricing cache.
- [x] `8decad7` — `feat(snapshot): sOhmCirculatingSupply + sOhmTotalValueLocked canonical fields`. `readSOhmCirculatingSupply` effect + sOhmTotalValueLocked = sOhmCirculatingSupply × ohmPrice. ohmApy still 0 with TODO (needs distributor.nextRewardFor + rebase tracking).
- [x] `eee4485` — `feat(snapshot): port ohmApy canonical field (sums staking V1/V2/V3 epochs)`. `readNextOhmDistribution` effect + `computeApy` pure helper + `stakingContracts` ChainConfig. All seven Phase-1 canonical fields now populated.
- [x] `dfe9e8c` — `test(snapshot): cover Phase 5 integration scenarios in aggregateAcrossChains`. All four named scenarios (complete / single-chain / late-day-update / missing-chain) covered. 61/61 tests green.

## Phase 6 — Parity harness

- [x] `8decad7` — `scripts/parity-diff.ts` lands the diff CLI. Fetches both endpoints' Metric arrays for a date or date range, normalizes numerics, emits CSV per (date, field) where the diff exceeds tolerance (default 0). Exit code 2 on any non-zero diff for CI gating. Needs deployment of the Envio indexer before it can run end-to-end.
- [ ] Run against the real endpoints (blocked on indexer deployment).
- [x] Exact-match starting expectation encoded as default `--tolerance 0`; relax only with explicit approval.

## Phase 7 — Performance validation

- [ ] Fresh DB backfill benchmark (blocked on deployment)
- [x] Confirm per-snapshot RPC count ≈ 0 except accepted timestamp/invariant effects — audited in `docs/envio-migration/phase-7-audit.md`. All RPC paths go through cached effects or `withContractReadCache`; the one exception is `getNativeBalance` (inherited TODO, documented).
- [x] Confirm BalancerVault + shared contracts filtered by poolId — audited in `docs/envio-migration/phase-7-audit.md`. `buildBalancerPoolIdWhere` filter is wired on all three BalancerVault events; per-address registration covers the rest.

---

## Inherited TODOs from PR #311 / #313 (carry through)

See `docs/envio-migration/inherited-todos.md`.

## Railway self-hosted metrics API (`feat/railway-metrics-api`)

Current objective: replace public Hasura exposure with private Railway
Envio/Hasura/Postgres plus a public artifact-backed REST API. New API is `/v2`;
legacy Wundergraph-style `/operations/*` remains as a deprecated compatibility
surface.

### Branch and scaffolding

- [x] Create branch `feat/railway-metrics-api` before implementation.
- [x] Add red-test scaffolding for shared artifacts, API routes, publisher,
      client package, OpenAPI, and Railway config-as-code.
- [x] Move Envio indexer config, schema, source, and tests into
      `apps/indexer`.
- [ ] Keep the red-test list current as implementation proceeds; do not remove a
      test unless the corresponding product requirement is explicitly dropped.

### Shared artifact and metric logic

- [x] Implement UTC date parsing and inclusive range resolution.
- [x] Default missing `end` to `manifest.latestDate`.
- [x] Reject `end < start` with `invalid_date_range`.
- [x] Enforce `METRICS_API_MAX_RANGE_DAYS` on `/v2/*` only.
- [ ] Ignore legacy `dateOffset` everywhere.
- [x] Generate month shard keys across month/year boundaries.
- [x] Implement exact legacy chain keys and zero defaults:
      `Arbitrum`, `Ethereum`, `Fantom`, `Polygon`, `Base`, `Berachain`.
- [x] Implement exact legacy `SupplyCategoryValues` keys and zero defaults.
- [x] Map incomplete chain data to `crossChainComplete=false`, zero component
      values, empty chain record arrays, `chainsIndexed`, `chainsMissing`, and
      `_meta.chainsFailed`.
- [x] Preserve aggregate/component/record triplets such as
      `treasuryMarketValue`, `treasuryMarketValueComponents`, and
      `treasuryMarketValueRecords`.
- [x] Keep `TreasuryAsset` and `OhmSupply` as the v2 names while preserving
      legacy `TokenRecord` / `TokenSupply` shape aliases for `/operations/*`.
- [x] Normalize legacy numeric values to JS numbers, not strings.
- [x] Normalize legacy `TokenSupply.source` and `sourceAddress` to non-null
      strings; keep `pool` and `poolAddress` nullable.

### Publisher

- [x] Implement Hasura GraphQL publisher source using
      `HASURA_GRAPHQL_ENDPOINT` and `HASURA_GRAPHQL_ADMIN_SECRET`.
- [ ] Verify `HASURA_GRAPHQL_ENDPOINT` uses a Railway private hostname in
      deployment.
- [x] Generate monthly artifacts:
      `v2/metrics/daily/YYYY-MM.json`,
      `v2/treasury-assets/daily/YYYY-MM.json`,
      `v2/ohm-supply/daily/YYYY-MM.json`.
- [x] Generate schemas under `v2/schemas/`.
- [x] Generate manifest with `earliestDate`, `latestDate`, schema version,
      generated timestamp, artifact keys, hashes, and row counts.
- [x] Publish metric, treasury asset, and OHM supply shard keys before
      `v2/manifest.json` in the publisher contract.
- [x] Upload all shards and schemas before `v2/manifest.json`.
- [x] Implement full publish mode for initial deployment.
- [x] Implement incremental publish mode with configurable lookback.
- [x] Require a full publisher run to create the initial manifest; incremental
      mode fails if the manifest is missing.
- [x] Default full publisher runs to the public start date, `2022-05-01`.
- [x] Coordinate overlapping cron runs with an S3-compatible
      `v2/publisher.lock`; fresh locks skip cleanly, stale locks are taken over.
- [x] Clamp public manifest bounds to the public start date instead of raw
      Hasura source bounds.
- [x] Ensure upload/validation failure exits non-zero and does not publish a new
      manifest.

### Public API

- [x] Implement `/ready`; do not add `/healthz`.
- [x] Implement CORS for `GET`, `HEAD`, and `OPTIONS`.
- [x] Reject request bodies on `GET` and `HEAD`.
- [x] Implement `/openapi.json` and `/docs`.
- [x] Implement `/v2/bounds` without exposing `availableMonths`.
- [x] Implement `/v2/manifest`.
- [x] Implement `/v2/metrics/daily`.
- [x] Implement `/v2/treasury-assets/daily`.
- [x] Implement `/v2/ohm-supply/daily`.
- [x] Support `includeRecords=true` on `/v2/metrics/daily` using the legacy
      metric-specific `*Records` fields.
- [x] Return consistent v2 `{ data, meta }` success envelopes and
      `{ error: { code, message, details? } }` error envelopes.
- [x] Add cache headers for range routes, manifest/bounds, and readiness.

### Legacy `/operations/*` compatibility

- [x] Implement Wundergraph response wrapper `{ data, errors? }`.
- [x] Parse raw and URL-encoded `wg_variables`.
- [x] Mark `/operations/*` as deprecated with response headers and OpenAPI
      `deprecated: true`.
- [x] Implement latest, earliest, and paginated metrics.
- [x] Implement latest, earliest, and paginated treasury assets via legacy
      `tokenRecords` route names.
- [x] Implement latest, earliest, and paginated OHM supply via legacy
      `tokenSupplies` route names.
- [x] Do not expose raw legacy Wundergraph routes such as
      `/operations/tokenRecordsLatest` or chain-specific response keys such as
      `treasuryEthereum_tokenRecords`.
- [x] Accept and ignore `ignoreCache`.
- [x] Accept and ignore `dateOffset`.
- [x] Apply no max range limit on `/operations/*`.
- [x] Support `crossChainDataComplete=true` filtering.
- [x] Support `includeRecords=true` on paginated metrics.
- [x] Implement `atBlock/*` route parity with `501` Wundergraph-style errors.
- [x] Return narrow legacy `ProtocolMetric` shape; return empty arrays rather
      than synthesizing unsupported values.

### Client package

- [x] Continue publishing `@olympusdao/treasury-subgraph-client` as a major
      version.
- [x] Preserve `createClient`, `TreasurySubgraphClient`, and legacy
      `query({ operationName, input })`.
- [x] Add v2 methods:
      `getBounds`, `getDailyMetrics`, `getDailyTreasuryAssets`,
      `getDailyOhmSupply`.
- [x] Keep the package framework-agnostic; no TanStack Query dependency.
- [x] Include `openapi.json` in package output.
- [x] Export legacy and v2-compatible TypeScript types.
- [ ] Add package scripts for client release preparation:
      clean/build type declarations, copy OpenAPI output, run package-focused
      tests, and produce a dry-run `npm pack` tarball for inspection.
- [ ] Add an explicit client publish script that publishes
      `@olympusdao/treasury-subgraph-client` from `apps/client` only after
      validation passes.
- [ ] Document the versioning/release workflow for the client package,
      including when to bump major/minor/patch for legacy `/operations/*` and
      v2 API changes.
- [ ] Add CI or a local validation gate that compares packed tarball contents
      against the intended allowlist (`dist`, `openapi.json`, package metadata)
      before publishing.

### Railway config-as-code and containers

- [x] Add Railway config-as-code file stubs for indexer, Hasura, publisher, and
      API.
- [x] Add Dockerfile stubs for indexer, Hasura, publisher, and API.
- [x] Replace Dockerfile stubs with pinned, production-ready images modeled on
      `protocol-visualizer`.
- [x] Add local Docker Compose stack for Postgres, Hasura, indexer, MinIO,
      publisher, and API with only `metrics-api` exposed on localhost by
      default.
- [x] Configure publisher cron as `15 * * * *` with `restartPolicyType: NEVER`.
- [x] Configure API healthcheck as `/ready` with `restartPolicyType: ALWAYS`.
- [x] Document Railway variables for Postgres, Hasura admin secret, RPC URLs,
      bucket credentials, publisher mode, and API max range.
- [x] Document Cloudflare cache and WAF rules.
- [ ] Ensure Hasura/Postgres/indexer/publisher remain private and only
      `metrics-api` has a public domain.

### Security and supply-chain validation

- [ ] Run `pnpm audit --audit-level moderate` and resolve or explicitly justify
      findings.
- [ ] Review new production dependencies for necessity and maintenance posture.
- [ ] Keep new runtime dependency footprint minimal; avoid framework dependencies
      unless they remove meaningful risk.
- [ ] Secure the client package release path: require npm 2FA / trusted
      publisher or provenance where available, avoid publishing from dirty
      working trees, and record the exact git commit/tag used for each release.
- [ ] Make client publishing reproducible: run release from a pinned Node/pnpm
      toolchain, `pnpm install --frozen-lockfile`, and a generated tarball whose
      contents can be reviewed before `npm publish`.
- [ ] Add pre-publish checks for supply-chain risk: dependency audit, license
      review for runtime deps, package script review, and verification that no
      secrets or environment files are included in the npm tarball.
- [ ] Document maintainer permissions and token handling for npm publishing:
      least-privilege access, no long-lived local automation tokens where
      possible, and no committed `.npmrc` secrets.
- [x] Build all Docker images locally.
- [ ] Scan Docker images for vulnerabilities before deployment.
- [ ] Resolve or explicitly document Docker image findings.
- [ ] Confirm runtime images run as non-root where practical.
- [x] Confirm public API rejects unsupported methods and request bodies.
- [x] Confirm Hasura console is disabled.
- [ ] Confirm Hasura has no public domain.
- [ ] Confirm secrets are only supplied through Railway variables and are not
      printed in logs.

### Validation gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm run check`
- [x] `pnpm run build`
- [x] `pnpm test`
- [x] Targeted metrics API red/green test suite passes.
- [x] `docker build -f Dockerfile-indexer .`
- [x] `docker build -f Dockerfile-hasura .`
- [x] `docker build -f Dockerfile-metrics-publisher .`
- [x] `docker build -f Dockerfile-metrics-api .`
- [ ] Deployment smoke checks for `/ready`, `/v2/bounds`, `/v2/metrics/daily`,
      `/v2/metrics/daily?includeRecords=true`, and
      `/operations/paginated/metrics`.

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

## Open issues to investigate

- [x] **Cooler V1.1 receivable: $4.9M new vs $9.15M legacy.** **FALSE ALARM.** Same-date diff on 2026-05-17 (legacy @ block 25,115,600, envio @ 25,116,000): V1.1 legacy=$4,898,041 vs envio=$4,897,705 — $337 gap, pure block-timing noise. All 4 clearinghouses match within $9K total (V1: $2, V1.1: $337, V2: $42, MonoCooler: $8,373). The original "$9.38M mystery" came from comparing pre-deploy snapshots — the deployed endpoint (`84753f4`) predates commits 8f9e85b/1d2bc88/e255be6/2e3c87e.

- [x] **Post-deploy MV gap on 2026-05-17 (full-sync verified): $145,235 (envio over).** Down from $11,997,221 pre-deploy. All originally-flagged items resolved or accounted for:
  - Ethereum gap closed to $99K (envio over, layout-difference noise — legacy emits single combined POL row, envio splits into per-token rows; sums within 0.7%).
  - Base gap closed to $414 (essentially identical).
  - Polygon gap closed to $2 (essentially identical).
  - Arbitrum +$259K — confirmed legacy is wrong (legacy doesn't snapshot Arbitrum; envio correctly tracks Camelot OHM-wETH LP + JONES staking).
  - Berachain residual $222K → fixed in 2026-05-18 commit (Kodiak POL pricing + Stargate USDC/HONEY nonStandardBalance).

- [ ] **Original $11.99M same-date MV gap (pre-deploy, 2026-05-17).** Resolved on full sync. Original itemization preserved below for reference:
  - **Ethereum: -$11.04M** (will mostly close on next deploy):
    - `Uniswap V3 OHM-sUSDS POL @ Treasury MS = $10,936,429` — fixed in unmerged commit 8f9e85b (config.yaml + ethereum.ts).
    - `veFXS staked-FXS = $81,011` — fixed in unmerged 1d2bc88.
    - `cvxCRV @ vlCVX Allocator = $17,817` — fixed in unmerged 2e3c87e.
    - `wETH-OHM UniV3 POL`: layout difference (legacy=1 combined row $4.50M, envio=2 split rows summing to $4.49M); ~$5K block-timing noise.
    - Remaining $20K spread across block-timing rate drift (DAI/USDS rate moved 0.0001 between blocks 25,115,600 and 25,116,000).
  - **Base: -$921,482** — `Uniswap V3 OHM-USDC LP @ DAO MS = $921,781` missing from deployed envio. **Already fixed** in unmerged commit 8f9e85b (`univ3PositionManager` wiring for `pushUniv3NftPol`); closes on next deploy.
  - **Berachain: -$274,530** — `Beradrome Kodiak OHM-HONEY LP @ DAO MS = $268,566` fixed in unmerged commit e255be6; will close on next deploy. Tiny $6K of additional iBERA/BERA price-timing noise.
  - **Arbitrum: +$259,366 (envio OVER) — LEGACY is wrong here, not envio.** Verified on-chain at block 463,907,057 that Cross-Chain Arbitrum (`0x012BBf04…`) holds: 100% of the Camelot OHM-wETH LP (6,963 OHM + 54.6 WETH ≈ $309K) and 333,000 JONES in the JonesStaking contract. Envio correctly tracks both; legacy doesn't snapshot Arbitrum at all on this date (`legacy block: (none)`). The only true envio-side bug here was phantom-negative FRAX/MAGIC, **fixed this session** by flagging both as `nonStandardBalance: true`.
  - **Polygon: +$15,102 (envio negative)** — sKLIMA phantom-negative $-15K, **fixed in this session's commit ca7cec3** (nonStandardBalance flag); will close on next deploy.

- [x] **Fantom/Polygon gOHM `TokenBalance` drift.** Confirmed same root cause as the broader non-standard-balance class (bridge mint credits balance without a standard Transfer event). Worked around 2026-05-17 by flagging `ERC20_GOHM` as `nonStandardBalance: true` on both chains and threading the flag through `pushTreasuryOhm` so snapshot-time `balanceOf` (cached via `readErc20BalanceOf` effect) replaces the drifting `TokenBalance` entity. See 2026-05-17 entry in `tasks/lessons.md`.
  - **Note: the underlying ledger is still wrong.** `nonStandardBalance` is a snapshot-time read-around, not a fix — `TokenBalance` rows for bridged gOHM on Fantom/Polygon (and the bridge-mint sources on those chains: WETH, DAI, FRAX, sKLIMA) remain incorrect for any consumer that queries them directly. The snapshot path is the only consumer today, so this is acceptable, but a real fix would require either (a) indexing the bridge-mint events that mutate balance, or (b) deriving `TokenBalance` from `balanceOf` instead of from Transfer accumulation. Track if a downstream consumer ever needs raw `TokenBalance` correctness.
