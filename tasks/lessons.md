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
