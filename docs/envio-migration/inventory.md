# Envio multichain migration — legacy behavioral inventory

This is the master index. Per-chain detail (with file:line citations for every rule) lives in the linked files. Phase 1 deliverable per [envio-multichain-migration-plan.md](../../envio-multichain-migration-plan.md).

## Per-chain inventories

- [arbitrum](inventory-arbitrum.md) — 9 ERC20s + OHM/gOHM, 12 LP pools (4 Balancer / 5 V2-variants / 2 V3 / 1 disabled), 35+ wallets with per-token blacklists/whitelists
- [base](inventory-base.md) — 4 tokens, 1 wallet (DAO multisig), 2 pools (V2 OHM/WETH, V3 OHM/USDC)
- [berachain](inventory-berachain.md) — 5 Kodiak Island reward vault wrappers, recursive Chainlink → Kodiak quoter pricing
- [ethereum](inventory-ethereum.md) — ~54 ERC20s + 4 ERC4626 vaults, 18 POL pools, ~27 static wallets + dynamic Bophades-resolved TRSRY/clearinghouse, 5 OHM-price pools, 12 Chainlink feeds
- [fantom](inventory-fantom.md) — 10 ERC20s + 1 POL (wFTM-gOHM V2), 2 wallets, no Chainlink, native FTM untracked
- [polygon](inventory-polygon.md) — 7 ERC20s + 1 POL (wETH-gOHM V2), 35 inherited wallets (most empty), no Chainlink, native MATIC untracked
- [shared](inventory-shared.md) — 8 `PriceHandler` implementations, recursive `getUSDRate` router, AS→TS porting hazards

## Cross-chain pattern matrix

| Aspect | Ethereum | Arbitrum | Base | Berachain | Fantom | Polygon |
|---|---|---|---|---|---|---|
| Data-source model | 3 sources (block + 2 event) | event-driven (dead `handleBlock`) | block poll | block poll | block poll | block poll |
| Block interval | varies | n/a | 7,200 | 7,200 | 24,000 | 14,400 |
| Chainlink feeds | 12 | yes | yes | yes (BERA, etc.) | **none** | **none** |
| Native asset tracked | yes (ETH) | yes (ETH) | yes (ETH) | **no (BERA)** | **no (FTM)** | **no (MATIC)** |
| `TokenSupply` emitted | yes | yes (lender supply) | yes | yes | **no — declared, never emitted** | **no — declared, never emitted** |
| Dynamic address resolution | yes (Bophades Kernel) | no | no | no | no | no |
| ERC4626 vaults | yes (4: sFRAX, sUSDS, etc.) | no | no | no | no | no |
| Cross-data-source state | yes (GnosisAuction) | no | no | no | no | no |
| Manual offsets | yes (OHM v1→v2, BLV vaults) | no | no | no | no | no |
| Per-token wallet whitelists/blacklists | yes (extensive) | yes | minimal | minimal | minimal | minimal (KLIMA 0.85 multiplier) |
| Pool types beyond V2/V3 | Curve, FraxSwap, Balancer/Aura, Convex, ERC4626 | Balancer (4) | none | Kodiak, Balancer | none | none (Balancer ABI loaded but unused) |

**Architectural takeaway:** Ethereum is the only chain with truly chain-specific complexity. The other five chains fit a single config-driven pattern: block-polled snapshot of (static wallets × static tokens × static pools) with a recursive price router. Envio handler interface should treat Bophades resolution, GnosisAuction state, OHM migration offsets, BLV registry enumeration, and ERC4626 vaults as **Ethereum-only plugins layered on the generic base**, not as core abstractions.

## Latent legacy bugs flagged during inventory

Each one is a parity decision (preserve vs fix on day-one with documented divergence). All are cited in the per-chain files.

| # | Chain | Bug | Suggested |
|---|---|---|---|
| L1 | Fantom | Imports wETH address from Arbitrum's `Constants` — wrong address; breaks wETH pricing | **Fix** (no parity loss; wETH price was already broken) |
| L2 | Fantom | `CONTRACT_ABBREVIATION_MAP` declared but entries land in `CONTRACT_NAME_MAP` | **Fix** (cosmetic, no value impact) |
| L3 | Fantom | Duplicate wFTM name-map entry — "Wrapped ETH" overwritten by "Wrapped Fantom" | **Fix** (cosmetic) |
| L4 | Arbitrum | `DAO_MULTISIG` and `CROSS_CHAIN_ARBITRUM` may be the same address → double-counting in balance sums | **Verify on-chain, then dedupe** |
| L5 | Berachain | iBGT/lBGT address collision in handler tie-breaking | **Fix** (likely a typo; verify with Olympus team) |
| L6 | Ethereum | `getCoolerV2Receivables()` calls `getUSDRate(DAI)` but receivable is USDS | **Verify intent** (may be intentional given USDS≈DAI peg) |
| L7 | Ethereum | UniV3 `getSqrtRatioAtTick()` uses float64 (`u64(sqrt(1.0001 ** tick))`) | **Fix** (use exact integer math from `@uniswap/v3-sdk`) |
| L8 | All chains | `liquidity` field is the priority signal in the recursive router but most handlers return zero | **Fix per-handler** — required for "highest liquidity wins" to work as documented |
| L9 | Polygon | KLIMA / sKLIMA carry a `liquidBackingMultiplier = 0.85` (15% discount) | **Verify intent** — likely intentional but document why; if the discount has been removed in newer treasury policy, this is a parity drift waiting to happen |

## Cross-cutting open questions blocking Phase 2

These need decisions from you before schema work, because the answers shape the entity design.

### Q1. Replicate `TokenSupply`-not-emitted on Fantom/Polygon, or fix?
The legacy Fantom and Polygon subgraphs declare `TokenSupply` in the manifest but **never emit a single row**. The new schema adds `chainId`/`blockchain` to `TokenSupply`. Two options:
- (a) Match legacy: `TokenSupply` exists on the entity but never written for these chains. Treasury endpoint stays parity.
- (b) Start emitting `TokenSupply` for cross-chain OHM/gOHM holdings on these chains. Improves coverage but breaks aggregate parity for any consumer that filtered on `TokenSupply` and assumed Fantom/Polygon contributed zero.

### Q2. Track native assets (BERA, MATIC, FTM) or skip?
Inherited TODO #2 (native-balances). Legacy Berachain/Polygon/Fantom did not track native asset balances. Treasury holds non-trivial native BERA on Berachain. Per the plan, one bounded RPC `getBalance` per protocol wallet per snapshot is acceptable. Confirm we **add** native-balance tracking in the new code (slight parity divergence on those chains, but correct behavior).

### Q3. Re-index from genesis or graft?
Several legacy subgraphs (Arbitrum, Base) use grafts to skip backfill from genesis. Envio with HyperSync makes full backfill cheap. Re-index from genesis (clean slate, real history) vs accept the legacy graft boundaries (faster initial sync, preserves the existing data gap)?

### Q4. 8-hour cadence — block-interval or wall-clock?
Legacy uses per-chain block intervals (Base 7,200, Bera 7,200, Fantom 24,000, Polygon 14,400). The plan calls for "every 8 hours" — preferable to convert to a wall-clock cadence so all six chains line up at the same UTC slots (good for `GlobalMetricSnapshot`), but Envio's `onBlock` is block-driven. Options:
- (a) Keep per-chain block intervals (fast to implement, snapshot times drift)
- (b) Use a per-chain block interval **calibrated** to ~8h based on chain block time (still drifts on chain-time variance)
- (c) Inside the block handler, only emit a snapshot if `block.timestamp - lastSnapshotTimestamp >= 8h` (snapshot times stable; some block ticks become no-ops)

### Q5. Liquidity-priority handlers — fix all or fix as needed?
Current shared router uses `liquidity` to pick the winning price quote, but most handlers return zero. Under-the-radar bug: when two handlers both quote a token, ordering is effectively undefined. Fixing all handlers to compute meaningful liquidity values is required by the plan ("Choose the valid price result with highest liquidity") but is more work. Confirm we **fix all** during the Phase 3 pricing port.

### Q6. Bophades dynamic address resolution timing
Ethereum's TRSRY and clearinghouse addresses are resolved from the Bophades Kernel and cached. In event-driven Envio: re-resolve on every snapshot tick, on every Kernel event, or only on `ModuleInstalled`/`PolicyInstalled`? Cleanest is event-driven re-resolution into a `BophadesAddressState` entity that snapshot reads.

### Q7. AssemblyScript → TypeScript port hazards
Three known foot-guns from the shared inventory:
- `BigDecimal.toString()` may emit scientific notation in TS; legacy AS does not. Affects `toBigInt(decimal)`.
- UniV3 `getSqrtRatioAtTick` is float64 in legacy; replace with exact `@uniswap/v3-sdk` math (improves correctness, breaks bit-exact parity).
- `BigDecimal` precision differs slightly between AS and TS implementations.

These will produce small numeric drifts vs the treasury endpoint. Plan calls for **exact match** as the parity target. If we want exact match, we may need to deliberately reproduce some AS behaviors. Recommend: fix correctness and accept tiny drifts with documented per-handler tolerances, then surface significant deltas in the Phase 6 diff harness.

### Q8. Circular dependencies before Phase 3
Shared `PriceHandlerBalancer` imports from `ethereum/src/utils/Constants`, and `TokensForChain.ts` reverse-imports `ERC20_TOKENS_*` from all six chain dirs. These build but produce a dependency cycle. The new Envio code should invert these (handler receives token map as constructor arg). Pure refactor, but must happen before Phase 3 pricing port.

## Inherited TODOs from PR #311 / #313

See [inherited-todos.md](inherited-todos.md). Five items: timestamp source, native-balances, univ3-balances, kodiak-reserves, lender-deployedOhm semantics.

## Treasury-subgraph metricHelper inventory

Deferred. Lives in a separate repo: https://github.com/OlympusDAO/treasury-subgraph. Will inventory in Phase 5 (global snapshot port) once we know which formulas to port.

## What Phase 1 did NOT cover

- **On-chain verification of suspected duplicate addresses** (Q L4). Needs an `eth_call` or block-explorer check, not a code read.
- **Confirmation of CoolerV2 USDS-vs-DAI intent** (Q L6). Needs Olympus contract team confirmation.
- **Treasury-endpoint output schema** (deferred to Phase 5/6).
- **Backfill-time benchmarking** (Phase 7).

## Phase-2 blockers — answers needed before schema work begins

| Decision | Affects | Default if unanswered |
|---|---|---|
| Q1 (Fantom/Polygon `TokenSupply` parity) | `TokenSupply` schema, ID format | (a) match legacy — don't emit |
| Q2 (native-asset tracking) | Chain config schema (need `protocolWallets`), per-snapshot RPC budget | Add native-balance tracking as bounded RPC |
| Q3 (re-index from genesis vs graft) | Indexer start blocks, backfill time, history fidelity | Re-index from genesis (Envio HyperSync fast enough) |
| Q4 (8h cadence: block-interval vs wall-clock) | Snapshot ID format (`block` vs `timestamp` derived `date`), depends on inherited TODO #1 | (c) wall-clock guard inside block handler; requires timestamp fix |
| Q5 (fix all handler liquidity values) | Phase 3 pricing port scope | Yes, fix all — required for "highest liquidity wins" |
| Q6 (Bophades resolution timing) | Ethereum-only chain config, Phase 4 work | Event-driven `BophadesAddressState` entity, snapshot reads |
| Q7 (AS→TS port hazards) | Phase 6 parity tolerance policy | Fix correctness, accept tiny drifts with documented per-handler tolerances |
| Q8 (circular deps) | Phase 3 module layout | Fix as part of Phase 3 pricing port |
| L4 (DAO_MULTISIG dedup) | Arbitrum chain config | Investigate before Phase 4 Arbitrum sign-off |
| L6 (CoolerV2 USDS intent) | Ethereum chain config | Replicate (assume USDS≈DAI peg) until Olympus confirms |
| L9 (KLIMA 0.85 multiplier intent) | Polygon chain config | Replicate until Olympus confirms |
| Treasury-subgraph metricHelper inventory timing | Phase 5 scope | Defer to Phase 5 (don't clone repo yet) |
