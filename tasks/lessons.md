# Lessons

Patterns and gotchas worth remembering across sessions. Append at the bottom; date-stamp each entry. Prioritize *why* over *what* — the code shows what, the comment shows why it caught us by surprise.

---

## 2026-05-16 — Promise-cache deadlocks when storing unsettled Promises

**Pattern that bit us:** A memoize-the-promise cache keyed off lookup arguments. The intent was to dedup concurrent identical lookups within a snapshot. Implementation:

```ts
const cached = cache.get(key);
if (cached) return await cached;
const result = lookup();  // unsettled Promise
cache.set(key, result);   // ← stored before it settles
return await result;
```

A recursive lookup that hits the same cache key during its own resolution awaits a Promise that's transitively awaiting itself. Silent infinite deadlock — no rejection, no log, no exception, just a Promise that never resolves. Cascades to wedge the whole indexer because the snapshot batch never commits.

**Fix:** track in-flight keys in a separate `Set`. On cache hit when the key is in the in-flight set, return a caller-supplied fallback instead of awaiting. See `src/pricing/index.ts::cachedPricingLookup`.

**Why it's a trap:** the symptom looks like an infrastructure bug. CPU samples showed every thread in a native module's `_pthread_cond_wait` — I spent hours suspecting hypersync-client's Rust runtime before realizing the JS consumer was hung and the Rust producers were just correctly waiting for backpressure to clear. **A native-module deadlock symptom can be a JS-side never-settling Promise upstream of the consumer.**

**Where to apply:** any AsyncLocalStorage / promise-memoize cache where the underlying lookup can recurse. Pricing routers, dependency resolvers, anything graph-shaped.

---

## 2026-05-16 — Chainlink proxy contracts don't emit AnswerUpdated

**The trap:** Chainlink price feeds use an `EACAggregatorProxy` pattern. Consumers query `latestRoundData()` / `latestAnswer()` on the stable proxy address. But the proxy DOES NOT emit `AnswerUpdated` — only the underlying `AccessControlledOffchainAggregator` does, and its address rotates over time via "phase transitions" (`phaseId`, `phaseAggregators(i)`).

If you subscribe an indexer to `AnswerUpdated` events on the proxy address, **no events ever fire**. Your price state stays empty forever. Every Chainlink-priced token returns 0. Cascades through every derived metric (in our case: ohmPrice=0, marketCap=0, treasury market value underreported by ~80%).

**Two valid approaches:**
1. **Event-driven (proper)** — read each proxy's current `aggregator()` via RPC at startup, dynamically register that underlying aggregator via `contractRegister`, listen for `AggregatorUpdated` on the proxy to track phase transitions, enumerate `phaseAggregators(1..n)` for historical backfill. ~1-2 weeks of work + ongoing complexity.
2. **RPC-driven (what legacy did)** — call `proxy.latestAnswer()` via a cached effect at snapshot time. One RPC per (chain, feed, block), cached. Trivial cost (~90 calls/day for our setup), matches legacy behavior exactly.

For snapshot-cadence use cases (8h or longer), RPC-driven is the right answer. The event-driven advantage (sub-block price latency) is wasted on snapshots.

**Where to apply:** any time you're about to subscribe to events from a contract that uses a proxy pattern, check whether the proxy forwards events or only forwards `view` calls. If only views, you can't index it via events — fall back to RPC.

---

## 2026-05-16 — Fantom Opera (chain 250) ≠ Sonic Mainnet (chain 146)

**The trap:** After Fantom's "Sonic" rebrand, most major RPC providers (Alchemy, Infura, PublicNode, etc.) only sell endpoints for the new Sonic chain (chain ID **146**). They've dropped Fantom Opera (chain ID **250**) entirely. Their endpoint URLs are named like `sonic-mainnet.g.alchemy.com` — easy to assume "Sonic = the new name for Fantom."

It is not. Sonic 146 is a completely separate chain with its own ledger, its own block numbering, its own deployed contracts. Pointing an indexer configured for chain 250 at a Sonic 146 RPC produces **plausible-looking but totally wrong** historical state — block 37,344,000 exists on both chains but with completely different data at different timestamps (3+ years apart in our case).

**Always verify a Fantom RPC with:**
```bash
curl -sX POST <URL> -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```
- `"result":"0xfa"` (= 250) → real Fantom Opera ✓
- `"result":"0x92"` (= 146) → Sonic, don't use

**Working chain-250 archive providers (as of 2026-05):** dRPC paid tier, Ankr Premium, GetBlock paid tier, Fantom Foundation public endpoint. Most "free" public RPCs are either deprecated, not archive, or now return 403 "unsupported platform."

---

## 2026-05-16 — Envio's onBlock callback only surfaces block.number

**The trap:** In Envio 3.0.1, `indexer.onBlock` callbacks receive `{ block: { number } }` — **no timestamp, no hash**. The TypeScript type `EvmOnBlockHandlerArgs` documents this (`Block being processed. Contains the block number; extended fields are opt-in via field_selection in config.yaml`) but the runtime confirms only `blockNumber` is passed: `EventProcessing.res.mjs:185` invokes the handler as `makeOnBlockArgs(item.blockNumber, …)`.

Worse: `field_selection.block_fields` in config.yaml accepts an enum that does **not include `timestamp`** (`parentHash`, `nonce`, `gasLimit`, etc. — but not the always-included `number`/`timestamp`/`hash` triple). Adding `- timestamp` to `block_fields` fails codegen with "unknown variant `timestamp`."

So you can't get `block.timestamp` in an onBlock handler via type casting, type widening, or config. The data isn't passed at all.

**Workaround:** add a cached `createEffect` that calls `client.getBlock({ blockNumber })` via viem and returns `block.timestamp`. Cached per (chain, block), so each unique snapshot block is one RPC call ever. See `src/effects/index.ts::readBlockTimestamp` and `src/handlers/BlockHandlers.ts::processSnapshot`.

**Where to apply:** any time you need block timestamp inside an `onBlock` handler. (Event handlers do get `event.block.timestamp` for free — this is onBlock-specific.)

---

## 2026-05-16 — Snapshot path RPCs need archive, not just full nodes

**The trap:** the snapshot pipeline calls `eth_call` / `eth_getBalance` / `latestAnswer()` with an explicit `blockNumber` parameter — i.e., at *historical* blocks. Pruned full nodes only retain ~128 blocks of state and return "missing trie node" errors for anything older. During a backfill from a 2022 start_block, every snapshot fails.

Free public RPCs are almost universally full-node only. Free archive tiers exist (e.g., PublicNode for some chains, OnFinality public) but are heavily rate-limited and typically run out of quota partway through a long backfill.

**Practical rule:** for any historical-state-reading indexer, plan to pay for archive RPC from the start. Free options are fine for liveness testing but not for production backfills.

---

## 2026-05-16 — Chainlink proxies can return empty data even when deployed

**The trap related to the above:** even after a Chainlink proxy contract is deployed (i.e., `eth_getCode` returns bytecode), `latestAnswer()` can return empty data (`0x`) at early blocks because the proxy was deployed but its underlying aggregator slot wasn't yet connected to a live round. viem throws `ContractFunctionExecutionError: Cannot decode zero data` on that response.

This means **`startBlock = proxyDeploymentBlock` isn't always safe** — the proxy might exist but not yet have a working answer. The truly-safe startBlock is the first block where `latestAnswer()` actually returns a non-empty bigint.

For our setup, the try/catch in `src/effects/index.ts::readChainlinkLatestAnswer` swallows these errors and returns `"0"`, letting the router fall through to other handlers. Costs ~63s of `retryRpc` exp-backoff per failed snapshot per feed, but doesn't crash.

To eliminate the wasted retries, set per-feed `startBlock` to a verified "first valid answer" block — but finding that requires actually calling `latestAnswer()` at candidate blocks (binary search via `eth_getCode` only finds proxy deployment, which is necessary but not sufficient).

---

## 2026-05-17 — `config.ohmToken` is gOHM (18 dec) on Fantom and Polygon, not OHM (9 dec)

**The trap:** Every chain's `ChainConfig.ohmToken` is "the OHM-family token tracked for circulating supply." On Ethereum/Arbitrum/Base/Berachain that's OHM (9 decimals). On **Fantom and Polygon there is no native OHM** — only bridged gOHM (18 decimals). The field is identically named so it's easy to write code that assumes 9 decimals everywhere:

```ts
// BUG: hardcodes 9 decimals
const balance = await readTokenBalance(context, config.chainId, config.ohmToken, wallet, 9);
```

On Fantom, `gOHM` raw `1.13e18` (≈1.13 gOHM) becomes `1.13e9` (≈1.13 BILLION gOHM) after the wrong scaling. That value gets emitted as a `TYPE_TREASURY` `TokenSupply.supplyBalance` and summed into the cross-chain `ohmCirculatingSupply`, inflating it by ~1.13B units on every Fantom snapshot day. Even the comment in the offending code — `// OHM is 9 decimals on Arbitrum and Berachain` — suggested the author knew the value varied per chain but didn't catch Fantom/Polygon.

**Two distinct fixes needed (in this order):**
1. **Decimals:** read from the token definition (`getTokenDecimals(config.tokens, config.ohmToken)`) — never hardcode.
2. **Units:** even with correct decimals, summing gOHM amounts into an OHM-denominated `ohmCirculatingSupply` is unit-mixed. Multiply gOHM amounts by the canonical sOHM-V3 rebase index (read from Ethereum's `OhmIndexState`) before emitting, so contributions are in OHM-equivalent units. If the index isn't available yet (early backfill), **skip emission** — emitting raw gOHM would poison the rollup.

**Where to apply:** anywhere reading `config.ohmToken` to compute a TokenBalance/Erc20Supply contribution to circulating/floating/backed supply (`pushTotalSupply`, `pushTreasuryOhm`, `pushOwnedLiquiditySupply`, lending/bond emitters). See helper `getOhmEquivalentMultiplier` in `src/handlers/BlockHandlers.ts`.

**Detection signal worth remembering:** a per-chain rollup row where `ohmCirculatingSupply > ohmTotalSupply` (or any "logically impossible: derived value exceeds upstream value") is almost always a unit/decimals bug, not an accounting bug. Compare on-chain `balanceOf()` against the indexer's raw `TokenBalance.balance` first — if they disagree, the indexer's tracking is broken; if they agree but the *derived* numbers don't, it's a downstream math/units bug.

---

## 2026-05-17 — Some ERC20s mutate balance without emitting Transfer events

**The trap:** event-driven balance tracking (`Σ Transfer.delta` per (token, wallet)) is correct only if every balance mutation emits a standard `Transfer(from, to, value)` event. A surprising number of widely-held ERC20s in DeFi do not:

| Token family | What they emit instead | Example |
|---|---|---|
| MakerDAO sDAI (`SavingsDai.sol`) | `Deposit(sender, owner, assets, shares)` on mint, `Withdraw(...)` on burn — and **no `Transfer(0x0, owner, shares)`** | `0x83f20f44…` |
| WETH9 + forks (`WETH.deposit{value:...}()`) | `Deposit(dst, wad)` on wrap, `Withdrawal(src, wad)` on unwrap — **no `Transfer`** | WETH on ETH/Arb/Base, wFTM |
| Aave aTokens (V2 + V3) | `Transfer` only on *scaled-balance* transfers; `balanceOf` rebases silently via interest accrual | aDAI, aEthUSDe |
| Aave variableDebt tokens | Same rebase pattern, on the liability side | variableDebtEthUSDC/USDT |
| Staking rebases (xBTRFLY, sOHM family) | Rebase-via-index — `balanceOf` grows without `Transfer` | xBTRFLY |
| Some bridge mints | Bridge unlock may credit balance via internal storage write, not Transfer | possibly gOHM on Fantom/Polygon |

**Concrete confirmation from this codebase (2026-05):**
- Bophades TRSRY `0xa8687a15`: indexer reports `−187M sDAI` ($219.7M phantom liability). On-chain `balanceOf` = 0. Block 18,122,273 mint of 96.7 sDAI: receipt shows only `Deposit(...)`, zero `Transfer` events from sDAI. Σincoming − Σoutgoing Transfers matches the indexer's negative balance to the cent — the indexer tracked the on-chain Transfer events perfectly; the on-chain Transfer events themselves are incomplete for sDAI.
- LUSD Allocator `0x97b3ef4c`: indexer reports `−16,385 wETH` ($35.8M). On-chain `balanceOf` = 0. Eight `Deposit(dst, wad)` events totalling 16,385 wETH from `weth.deposit{value:...}()` calls — none of which emit `Transfer`. The matching outgoing transfers are captured, leaving the negative running tally.

**Diagnostic recipe:** when a TokenRecord shows a negative balance (or massively divergent from legacy), don't immediately suspect indexer logic. Run:
```
balanceOf(wallet) on-chain at the snapshot block
  vs
Σ Transfer.delta for that (token, wallet) over the indexer's range
```
If those match but disagree with the actual on-chain `balanceOf`, the token is non-standard. Fix by reading `balanceOf` at snapshot time instead of summing Transfers.

**Fix in this codebase:** `TokenDefinition.nonStandardBalance: true` routes snapshot balance reads through `readErc20BalanceOf` (cached `createEffect`, one RPC per (chain, token, wallet, block)) instead of the `TokenBalance` ledger. Set on every confirmed-broken token in `src/snapshot/chains/*`. Bounded cost: ~6 chains × ~10 wallets × ~10 non-standard tokens × 3 snapshots/day ≈ 1.8k RPC calls/day across all chains.

**Where to apply (preventatively):** any ERC4626 vault, any WETH9-style wrapper, any rebasing receipt token, any bridge-minted token where you can't trace the mint path to a standard `_mint`. When in doubt, flag it — the cost of a cached `balanceOf` call is trivial; the cost of a negative-balance contamination is days of debugging and a 5× wrong treasury rollup.
