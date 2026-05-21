# PR #311 — Review feedback from 0xJem (2026-05-19)

Source: 43 inline comments on https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/pull/311
Submitted: 2026-05-19T10:29:35Z (review id 4317496897, state COMMENTED)

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` wontfix (with reason)

---

## Sequencing

1. **Step 1 — nonStandardBalance audit** (correctness, may surface real bug). In progress.
2. Step 2 — branch hygiene (`.npmrc`, README, graph scripts, config.yaml description).
3. Step 3 — indexer perf: `where` filters on Staking / BophadesKernel / ChainlinkAggregator / KodiakLps.
4. Step 4 — schema renames + ID format + UTC docs + enum (single breaking-change commit, requires re-sync).
5. Step 5 — code structure (split `BlockHandlers.ts` and `contracts.ts`, named-param `token()`, dedupe wallets, magic numbers).
6. Step 6 — respond inline to open architectural questions (parallelize handlers, in-memory pricing, line 202 design).

## Open questions for the team

- nonStandardBalance audit: one-pass investigation, or fix as we go?
- Schema breaking changes: any consumers beyond the dashboard?
- Scope: must-fix correctness in this PR, refactors as follow-ups?

---

## Step 1 — nonStandardBalance audit (correctness, HIGHEST PRIORITY)

Jem is challenging most of our `nonStandardBalance: true` flags by pointing to actual on-chain event signatures. If correct, our snapshot-time `balanceOf` reads are unnecessary *and* may be masking a real event-handler bug.

### Findings so far (2026-05-18)

Two distinct root causes confirmed by tracing the on-chain `balanceOf` history vs the indexer's `TokenBalanceUpdate` ledger for each affected wallet+token:

**Class A — pre-existing balance at chain start block was never backfilled.** Indexer started with TokenBalance=0 but real on-chain balance was non-zero. Outflows accumulated negative drift = -(starting balance). Confirmed for:
- Arbitrum FRAX @ Cross-Chain Arbitrum — wallet held 18,072.805 FRAX at block 10,950,000 (chain start); current ledger = -18,072.805.
- Polygon sKLIMA @ Cross-Chain Polygon — wallet held 51,167.173 sKLIMA at block 23,000,000 (chain start); current real balance is 51.93, current ledger drifted.

**Class B — mid-stream state-read consistency bug.** Wallet had 0 at start AND 0 now, but the indexer's Transfer handler read a stale `previous` value when two updates happened close in time. After the first such race, the ledger acquires a permanent offset that every subsequent in/out cycle preserves. Confirmed for:
- Berachain USDC.e @ DAO MS — explicit trace shows blk 2,924,506 IN of +440M correctly set balance to +440M, then blk 2,927,801 OUT of -440M landed at -440M instead of 0 because the handler's `get(TokenBalance)` returned the empty value (`previous=0`) when it should have returned 440M. Every subsequent cycle settles at -440M instead of 0.
- Likely also: Berachain HONEY (mirror of USDC.e from the same swap tx), Fantom DAI / FRAX (start=0 / now=0 but ledger drifted).

### Proposed fixes

- **Class A fix**: implement balance backfill mechanism. At each chain's start block, seed `TokenBalance` from `balanceOf(token, wallet)` for every `(token, wallet)` pair before any Transfer events are processed. Drop `nonStandardBalance: true` for the affected tokens.
- **Class B fix**: separate investigation — likely a handler ordering / envio preload-vs-process gotcha. Until root cause is fixed, **keep `nonStandardBalance: true`** for these specific tokens with documented justification pointing to this entry.

### Full negative-balance scan (all 14 tokens, not just Jem's list)

Direct query of `TokenBalance(where: {balance: {_lt: "0"}})` post-sync surfaced 14 wallets with negative ledgers. Each was classified by comparing on-chain `balanceOf` at chain start vs now vs the indexer's ledger.

| # | Chain | Token | Wallet | At start | Now | Envio | Class |
|---|---|---|---|---|---|---|---|
| 1 | Eth | sDAI | TRSRY | 0 (predates) | 0 | -186.9M | B |
| 2 | Eth | aDAI v1 | AAVE_ALLOCATOR | 0 | 0.80 | -165K | C |
| 3 | Eth | aDAI v2 | AAVE_ALLOCATOR_V2 | 0 | 24.03 | -131K | C |
| 4 | Eth | WETH | LUSD_ALLOCATOR | 0 | 0 | -16,385 | B |
| 5 | Eth | xBTRFLY | TREASURY_V3 | predates | 0 | -391 | B |
| 6 | Arb | FRAX | XChain-Arb | 18,072.81 | 0 | -18,072 | **A** |
| 7 | Arb | MAGIC | XChain-Arb | 22,090.96 | 0 | -75,582 | A+B |
| 8 | Arb | Synapse gOHM | XChain-Arb | 2.51 | 0 | -2.5 | **A** |
| 9 | Fan | DAI | XChain-Fantom | 0 | 0 | -80,100 | B |
| 10 | Fan | FRAX | XChain-Fantom | 0 | 0 | -45,036 | B |
| 11 | Fan | wFTM | XChain-Fantom | 5,198.33 | 0.50 | -5,197 | **A** |
| 12 | Fan | gOHM | XChain-Fantom | 1.13 | 0.0001 | -1.13 | **A** |
| 13 | Pol | sKLIMA | XChain-Polygon | 51,167.17 | 51.93 | -339,077 | A+C (rebase) |
| 14 | Ber | USDC.e | DAO MS | 0 | 0 | -439,884 | B |

(Plus a positive mirror at Berachain HONEY @ DAO MS = +439,949 from the same Stargate swap, same Class B root cause.)

### Classification summary

- **Class A — missing backfill at chain start**: 6 tokens (Arb FRAX/MAGIC/Synapse-gOHM, Fan wFTM/gOHM, Pol sKLIMA partial). All have a clearly non-zero on-chain `balanceOf` at the configured chain start block; indexer starts from 0 and accumulates outflows into negative.
- **Class B — handler state-read race**: 6 tokens (Ber USDC.e/HONEY, Fan DAI/FRAX, Eth WETH/sDAI/xBTRFLY). All have on-chain start=0 and on-chain now=0, but the indexer's `TokenBalance` ledger drifted. Berachain USDC.e was traced explicitly: at blk 2,924,506 a `+440M` IN correctly set balance to +440M, then at blk 2,927,801 a `-440M` OUT landed at -440M instead of 0 because `applyTransferToWalletBalance`'s `context.TokenBalance.get(id)` read returned `previous=0` instead of `+440M`. Every subsequent in/out cycle now settles at -440M instead of 0. Likely related to envio's preload/process ordering or batch-commit semantics — not a missing event.
- **Class C — non-Transfer balance changes (rebase / interest accrual)**: 2-3 tokens (aDAI v1, aDAI v2, sKLIMA's rebase component). Aave V1 aTokens use a scaled-balance representation; `balanceOf` returns `scaledBalance × liquidityIndex` but Transfer events emit only the scaled amount. sKLIMA's rebase changes `balanceOf` without Transfer.

### Recommended fixes per class

- **Class A (6 tokens)**: implement a one-time balance backfill at the chain start block. Read `balanceOf(token, wallet)` for every `(token, wallet)` pair in `protocolAddresses × tokens`, write to `TokenBalance` before any Transfer events are processed. Drop `nonStandardBalance: true` for Class A tokens. Side benefit: `TokenBalance` becomes correct for any direct consumer, not just the snapshot path.
- **Class B (6 tokens)**: investigate the envio state-read race separately. Suspect `applyTransferToWalletBalance` reading stale state when prior `set` hasn't been flushed within a batch. Until root-caused, **keep `nonStandardBalance: true`** with a doc-comment pointing to this entry.

### Class B root-cause investigation — 2026-05-20

Traced Berachain USDC.e @ DAO MS at the two critical blocks where the indexer's ledger went from +440M to -440M (expected: 0).

**On-chain truth (verified via balanceOf at each block):**
- Block 2,924,505: 0 USDC.e
- Block 2,924,506: 439,884 USDC.e ← in via standard `Transfer(0x0, wallet, 440M)` (FiatTokenV1 mint, also emits a `Mint(minter, wallet, 440M)` event we ignore)
- Block 2,927,800: 439,884 USDC.e
- Block 2,927,801: 0 USDC.e ← out via standard `Transfer(wallet, 0xa700f8…, 440M)`

Both balance changes are pure standard Transfer events at the FiatToken contract. There are no non-Transfer events affecting the wallet's balance between these blocks. So this is NOT a missing-event problem.

**Indexer's `TokenBalanceUpdate` rows for the same period:**
- Block 2,924,506: delta=+440M, balance=+440M (handler correctly read previous=0 and set next=+440M)
- Block 2,927,801: delta=-440M, **balance=-440M** (handler read previous=0, not +440M; set next=-440M)

There are NO intermediate TokenBalanceUpdate rows between these two blocks. Our handler is the only writer of `TokenBalance` for this entity (Erc20Transfers.ts:applyTransferToWalletBalance), and `BackfillTokenBalances` only fires at chain start.

**Diagnosis: envio's `context.TokenBalance.get()` returned a stale (zero) value at block 2,927,801 even though `set()` at block 2,924,506 wrote +440M.** The drift is permanent — every subsequent in/out cycle for this entity now settles at -440M instead of 0.

**Likely root causes (in order of suspicion):**
1. **Cross-batch persistence gap**: blocks 2,924,506 and 2,927,801 are ~3,300 blocks (~2 hours real time) apart. They almost certainly fall in different HyperSync batches. If batch N's `set()` writes don't durably commit to DB before batch N+1 starts reading, the second batch's `get()` could see the pre-batch-N state.
2. **Handler invocation in preload-vs-process discrepancy**: envio runs handlers twice (preload to declare reads, process to apply writes). If our handler doesn't guard on `context.isPreload`, both phases run the full read-modify-write. If preload writes don't persist but process reads from a cache populated by preload, there could be ordering effects.
3. **In-memory entity cache eviction**: if the entity hasn't been touched in long enough, the in-memory cache evicts it; the next get() goes to DB and reads stale state (though DB should be correct).

**Next steps to confirm root cause:**
1. Check envio docs / GitHub issues for known read-your-writes guarantees across batches.
2. Add a smoke test: register a single contract with 2 Transfer events ~3,000 blocks apart and assert the ledger lands at the correct final value. Run against the deployed envio version.
3. If 1+2 confirm a real envio bug, file an upstream issue and document workarounds (could be `isPreload` guard, smaller batch sizes via `indexing-performance` skill knobs, or keeping `nonStandardBalance` indefinitely).

For now: keep `nonStandardBalance: true` on all Class B tokens with comments pointing to this entry.

---

## Class B — investigation plan (2026-05-20)

Goal restated: **avoid `nonStandardBalance` unless we truly have to.** For every currently-negative TokenBalance, find the event we're missing and subscribe to it. Only fall back to `nonStandardBalance` when no on-chain event for the balance change exists.

### Status check before starting

The earlier endpoint (`3d20ed8`) had Berachain USDC.e at -440K and HONEY at +440K, which triggered the "envio race" rabbit hole. On the current endpoint (`0f226cb`) USDC.e/HONEY are both 0 — apparently self-resolved between deploys, so the race hypothesis was wrong. Re-validation against current data leaves **6 truly Class B/C tokens** (have residual after backfill projection):

| Token | Wallet | Residual after backfill | Likely missing event |
|---|---|---|---|
| Eth sDAI | TRSRY (Bophades) | -186.9M sDAI (~$196M) | sDAI is ERC4626 (Transfer-only). Suspect: TRSRY-side module flow doesn't return sDAI to TRSRY via Transfer. Needs Bophades module trace. |
| Eth aDAI v1 | AAVE_ALLOCATOR | -165K aDAI | Aave V1 scaled balance × `liquidityIndex` — needs Aave's `BalanceTransfer` or `ReserveDataUpdated` index event. |
| Eth aDAI v2 | AAVE_ALLOCATOR_V2 | -131K aDAI | Same as v1. |
| Eth WETH | LUSD_ALLOCATOR | -16K wETH (~$65M) | Canonical WETH9 only emits Transfer. -16K phantom is suspicious — needs raw event trace. |
| Eth xBTRFLY | TREASURY_V3 | -391 xBTRFLY | Redacted V1 staking token; likely rebase mechanics. Needs contract inspection. |
| Fan DAI | Cross-Chain Fantom | -80K DAI | Multichain anyDAI bridge; `LogAnySwapIn`/`Out` events instead of (or in addition to) Transfer. |
| Pol sKLIMA | Cross-Chain Polygon | -287K (after backfill) | KLIMA rebase, like sOHM uses `LogRebase`. Index that, treat like the OhmIndexState pattern. |

(Berachain USDC.e and HONEY were originally the trigger but are currently correct — drop from active list, monitor.)

### Investigation procedure per token (repeatable)

1. **Verify it's still negative** on the latest endpoint — if it self-resolved like USDC.e, drop it.
2. **List the contract's emitted event topics** via on-chain log survey (100K-block sample) — same method I used for FiatToken USDC.e.
3. **Identify which events affect balance** — anything other than standard Transfer? Mint? Burn? Rebase? LogSwapIn?
4. **Trace one specific drift transition** at a block where the ledger went wrong — what event was emitted on-chain at that block that we don't subscribe to?
5. **Decide**:
   - If a clean event exists → add a handler subscribing to it, apply delta to TokenBalance
   - If no event (true on-chain non-event balance change) → document and keep `nonStandardBalance`
6. **Validate** the fix with a `createTestIndexer` test on the specific transition.

### Order of investigation

1. **Eth WETH @ LUSD_ALLOCATOR — ✅ root cause found (2026-05-20)**:
   - Per-block trace: 8 blocks where our handler recorded outflows, on-chain net at each = 0 (perfect in/out cancellation).
   - Inspecting block 14,915,630: 28 events touch the wallet. The two we care about: logIdx 35 = `Deposit(allocator, 771 wETH)` (WETH9 wrap), logIdx 36 = `Transfer(allocator, TREASURY_V3, 771 wETH)`.
   - **WETH9's `deposit()` and `withdraw()` emit only `Deposit`/`Withdrawal`, NOT `Transfer`.** Our handler only subscribes to Transfer, so wraps/unwraps are invisible. Every wrap+forward pattern records the outflow and misses the inflow.
   - **Fix**: index `Deposit(address indexed dst, uint256 wad)` (+delta) and `Withdrawal(address indexed src, uint256 wad)` (−delta) on WETH9 contracts.
   - **Applies to**: Ethereum WETH, Arbitrum WETH, Base WETH, Fantom wFTM (and same family on Polygon WETH if it shares WETH9 semantics — verify).
   - **After the fix**: drop `nonStandardBalance: true` on all WETH9-family tokens.
   - Implementation: define a new `Wrapped9` contract in `config.yaml` with `Deposit` + `Withdrawal` events, register WETH addresses under it per chain, add `Wrapped9.Deposit` / `Wrapped9.Withdrawal` handlers that route through `applyTransferToWalletBalance` with the wallet's address as the affected side.
2. **Eth aDAI v1 + v2 — ✅ investigated (2026-05-20), decision: KEEP nonStandardBalance**
   - Aave V2 aTokens store SCALED balance internally. `balanceOf = scaledBalance × liquidityIndex`. Mint/Burn events DO fire, but emit the USER-FACING amount (deposit/withdrawal value at time of action), not the scaled amount.
   - A wallet that deposits 100 DAI then withdraws 110 DAI (interest accrued) emits Transfer +100 then Transfer -110; our Transfer-only ledger lands at -10 (phantom). Indexing Mint/Burn alone doesn't fix this — both emit the same user-facing amount as Transfer.
   - A proper fix would index `LendingPool.ReserveDataUpdated` for `liquidityIndex` and recompute `balance = scaledBalance × index` at snapshot. This is non-trivial (per-asset state, requires pool address registration). For ~3 wallets holding aDAI at low volume, the cost of `nonStandardBalance` (1 RPC per snapshot per wallet) is much cheaper than the build.
   - Updated comments in ethereum.ts to spell out the reasoning precisely. Same justification applies to aEthUSDe and variableDebtEthUSDC/USDT (Aave V3, same mechanism with `variableBorrowIndex` for debt tokens).
   - **Action**: documented; no code change to indexing. The flag stays.
3. **Eth sDAI @ TRSRY — ✅ root cause found & fixed (2026-05-20)**:
   - Traced the first ledger entry (block 18,142,516, delta=-96.7 sDAI with ledger=0). Found TRSRY had received 96.7 sDAI somewhere earlier we hadn't indexed.
   - Binary search located the inflow at block 18,164,221: a single tx with ONE sDAI log = `Deposit(sender=DAO MS, owner=TRSRY, assets=20M DAI, shares=19.3M sDAI)` (ERC4626 Deposit event, topic0 `0xdcbc1c05...`). NO Transfer-from-zero in the entire tx.
   - **Root cause**: sDAI's `deposit()` emits only the ERC4626 `Deposit` event on share mint; no Transfer-from-zero. Same for `redeem()` → only `Withdraw`. Our handler only subscribed to Transfer.
   - **Fix shipped**: new `Erc4626Vault` contract type indexing `Deposit(sender,owner,assets,shares)` and `Withdraw(sender,receiver,owner,assets,shares)`. Handlers credit/debit `owner`'s TokenBalance with `shares` (not assets) via the existing helper. Registered on Ethereum for sDAI, sUSDe, sUSDS, Gauntlet sUSDS Vault. `nonStandardBalance` dropped on all 4.
   - 6 new tests cover both directions, full cycle, no-op for non-treasury owners.
   - **Same fix applies opportunistically to**: sUSDe, sUSDS, Gauntlet sUSDS — they likely had the same drift pattern even if not visible as negative balances (drift could be positive depending on net deposit/withdraw history).
4. **Eth xBTRFLY @ TREASURY_V3** — small magnitude, low priority but cheap to investigate.
5. **Fan DAI** — Multichain bridge event subscription.
6. **Pol sKLIMA** — sOHM-style rebase event. Mirrors existing OhmIndexState pattern.

Track per-token findings + fix shipped under the table above as we work through each.

### Open mid-work items (don't lose track)

- [ ] Two local commits ready to push: `3e0e42a` (backfill) + `e193d99` (drop 3 nonStandardBalance flags). Push when ready — they fix the 7 pure Class A tokens.
- [ ] After push + re-sync, re-run the 14-token scan to confirm the pure-A list resolves to zero remaining negatives for those rows.
- [ ] Then start Class B investigation per the procedure above.
- **Class C (2-3 tokens)**: keep `nonStandardBalance: true` as the cleanest path; document that aDAI / sKLIMA fundamentally have non-Transfer balance mutations. Alternative is to index Aave `ReserveDataUpdated` + sOHM-style index entity, but the RPC fallback is cheaper for these low-touch wallets.

### Per-token status (Jem's original 8 + new)

- [x] **arbitrum.ts:196 — FRAX** — Class A. Wallet held 18,072.805 FRAX at chain start; fix via backfill.
- [x] **arbitrum.ts:215 — MAGIC** — Class A (primary). Wallet held 22,091 MAGIC at chain start; some Class B contribution from later activity.
- [x] **berachain.ts:154 — USDC.e** — Re-verified 2026-05-20: TokenBalance entity matches on-chain balanceOf exactly across all 5 Berachain treasury wallets via plain Transfer indexing alone. The earlier -440K trace was reading older deploy state. Dropped `nonStandardBalance: true`. The "Class B race" hypothesis was wrong.
- [x] **berachain.ts:154 — HONEY** — Same as USDC.e — entity matches on-chain across all wallets. Dropped `nonStandardBalance: true`.
- [ ] **berachain.ts:184 — Beradrome reward vaults** — distinct from the 14 negative ledgers; the vault token "balance" is internal staking state, not standard ERC20. Jem suggests indexing `Staked` events. Confirmed Beradrome's StakingRewards.sol emits `Staked(user, amount)` — viable path. Trade-off: keep current `nonStandardBalance` (works, 1 RPC per snapshot) OR add `Staked`/`Withdrawn` event handlers (event-driven, more code).
- [x] **fantom.ts:182 — wETH** — Class A. Wallet had 5,198 wFTM at start (note: separate from wETH at same wallet; need to recheck wETH specifically).
- [x] **fantom.ts:182 — wFTM** — Class A. Wallet held 5,198.33 wFTM at chain start.
- [x] **fantom.ts:182 — gOHM** — Class A. Wallet held 1.13 gOHM at chain start.
- [x] **polygon.ts:118 — sKLIMA** — Class A + C. Pre-existing 51,167 at start AND rebases over time. Backfill addresses the A part; nonStandardBalance still needed for the rebase part.
- [x] **polygon.ts:131 — gOHM** — already nonStandardBalance from prior commits; verify if Class A or C after backfill.
- [x] **polygon.ts:131 — WETH** — already nonStandardBalance from prior commits.

### Newly-discovered (beyond Jem's list)

- [ ] **Ethereum sDAI @ TRSRY (-186.9M)** — Class B, huge magnitude. Investigate as part of Class B fix.
- [ ] **Ethereum aDAI @ AAVE_ALLOCATOR v1 + v2 (-165K + -131K)** — Class C (rebase). Add `nonStandardBalance: true`.
- [ ] **Ethereum WETH @ LUSD_ALLOCATOR (-16,385 wETH = ~$65M nominal)** — Class B. WETH9 emits standard Transfer on deposit/withdraw, so this is the state-read race.
- [ ] **Ethereum xBTRFLY @ TREASURY_V3 (-391)** — Class B (small).
- [ ] **Arbitrum Synapse gOHM @ XChain-Arb (-2.5 gOHM)** — Class A.
- [ ] **arbitrum.ts:215 — MAGIC** — Jem: does emit `Transfer` (ERC20Upgradeable line 241, https://arbiscan.io/address/0x3f770ac673856f105b586bb393d122721265ad46#code). Check why our handler missed it.
- [ ] **berachain.ts:154 — USDC** — Jem: has `Mint` and `Transfer` events (FiatTokenV1.sol, https://berascan.com/address/0xa272ffe20cffe769cdfc4b63088dcd2c82a2d8f9#code). Verify.
- [ ] **berachain.ts:154 — HONEY** — Jem: emits `Transfer` (ERC20.sol line 584, https://berascan.com/address/0x96b1a552a97da5503343d0f9ff2766c616e62905#code).
- [ ] **berachain.ts:184 — Beradrome reward vault** — Jem: `Staked` event (StakingRewards.sol line 180, https://berascan.com/address/0x017B4DD27782E2FE3421e71F33ce54801aF696F8#code) + the underlying stakeToken transfer.
- [ ] **fantom.ts:182 — wETH / wFTM / gOHM** — Jem: double-check assumptions, likely incorrect.
- [ ] **polygon.ts:118 — sKLIMA** — Jem: is there a rebase event to monitor (similar to sOHM LogRebase pattern)?
- [ ] **polygon.ts:131 — gOHM / WETH** — Jem: double-check assumptions.

**Audit deliverable per token**: (a) confirm/refute event presence on the verified source contract, (b) check our handler subscription for that event, (c) propose either drop the flag + index the event, or keep flag with documented justification.

---

## Step 2 — Branch hygiene

- [ ] **.npmrc:1** — removed on master; pull master in.
- [ ] **config.yaml:3** — update description.
- [ ] **package.json:17** — remove graph-specific scripts and `bin/subgraph/` directory.
- [ ] **README.md:52** — needs updating.

---

## Step 3 — Indexer performance (event filters)

- [ ] **BlockHandlers.ts:168** — sequential handler calls; could be parallel.
- [ ] **BlockHandlers.ts:476** — nested loop in `pushTokenBalanceRecords`; should be single pass over token defs filtering by category.
- [ ] **BlockHandlers.ts:579 (a)** — per-chain `protocolAddresses` should be trimmed (Arbitrum was iterating mainnet addresses).
- [ ] **BlockHandlers.ts:579 (b)** — add per-protocol-address `startBlock` to skip pre-deployment scans.
- [ ] **BophadesKernel.ts:56** — add `where` clause to filter events.
- [ ] **ChainlinkAggregator.ts:85** — add `where` clause.
- [ ] **KodiakLps.ts:53** — add `where` clause.
- [ ] **Staking.ts:72 — Staked event** — currently indexing all staking events; filter.
- [ ] **Staking.ts:72 — Withdraw event** — same.
- [ ] **Staking.ts:123** — filter by depositor/recipient.
- [ ] **pricing/chainlink.ts:24** — aggregator detection slow; cache aggregator addresses or pre-record + monitor for `AggregatorUpdated` events.
- [ ] **pricing/index.ts:78** — in-memory price storage vs entity-stored: measure and discuss.

---

## Step 4 — Schema improvements (breaking changes, batch into one commit)

- [ ] **schema.graphql:11 — date field** — be explicit it's UTC (rename or doc-comment).
- [ ] **schema.graphql:16 — chainsIndexed/chainsMissing** — switch from chain name → `chainId` (case-sensitivity risk).
- [ ] **schema.graphql:54 — `MetricValues`** — rename to `ChainMetricValues`.
- [ ] **schema.graphql:55 — `MetricValues` ID** — consistent format `YYYY-MM-DD/<chainId>`.
- [ ] **schema.graphql:76 — `SupplyCategory`** — add `chainId`, rename to `ChainSupplyCategory`.
- [ ] **schema.graphql:80 — `category` field** — convert string to enum type.
- [ ] **schema.graphql:86** — add `chainId` for consistency.
- [ ] **schema.graphql:113 — `TokenRecord` ID** — change to `YYYY-MM-DD/<chainId>/<block>/<source>/<token>`.
- [ ] **schema.graphql:135 — `TokenSupply` ID** — change to `YYYY-MM-DD/<chainId>/<block>/<token>/<type>/<pool>/<source>`.
- [ ] **schema.graphql:163** — drop the `GnosisAuction-` prefix.

---

## Step 5 — Code structure / cleanup

- [ ] **wallets.ts:1** — dedupe addresses (most addresses are per-chain unique).
- [ ] **contracts.ts:1** — split into cache file + RPC client file.
- [ ] **BlockHandlers.ts:1** — split per-protocol handlers out of the ~1.4K-line file.
- [ ] **berachain.ts:188 (token() factory)** — replace positional args with named-parameter object so optional params don't require floating `undefined`.
- [ ] **BlockHandlers.ts:300 — `toString(10)`** — extract to a named constant; reconsider whether it should be 18 for accuracy.
- [ ] **BlockHandlers.ts:346** — chainId literal; use a constant.
- [ ] **BlockHandlers.ts:845** — magic number; name it.

---

## Step 6 — Architectural questions (respond inline first)

- [ ] **BlockHandlers.ts:202** — why are chainId/blockchain set post-creation instead of by the factory that creates `TokenRecord` / `TokenSupply`? (Jem asks for justification.)
- [ ] **BlockHandlers.ts:168 (revisit)** — confirm whether parallel execution is safe (shared `context`?).
- [ ] **pricing/index.ts:78** — perf comparison: in-memory vs stored price entity.
