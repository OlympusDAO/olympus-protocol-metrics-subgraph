# Inherited TODOs from PR #311 / #313

These are open issues already present in `feat/envio` at the start of the multichain migration. Each must be resolved (or explicitly accepted as a known divergence) before we can claim full parity with the legacy Graph subgraphs.

Verified on commit `330e9f3` (Merge PR 313).

---

## 1. `TODO(timestamp)` — Snapshot timestamps are block numbers, not unix seconds

**Location:** [src/handlers/BlockHandlers.ts:105-108](../../src/handlers/BlockHandlers.ts#L105-L108)

```ts
// TODO(timestamp): use the chain's block timestamp once Envio's onBlock
// handler surfaces it. For now we use the block number as the timestamp
// value so the snapshot record IDs stay unique and the field is populated.
const timestamp = blockNumber;
```

**Impact:**
- `TokenRecord.timestamp` and `TokenSupply.timestamp` currently hold the block number, not a unix timestamp.
- `date` field derivation (used in record IDs and the planned `GlobalMetricSnapshot.id = YYYY-MM-DD`) is therefore unreliable.
- Breaks parity with the legacy subgraphs and breaks the daily-UTC global-snapshot contract.

**Acceptable mitigation per migration plan:** one bounded RPC call per snapshot for block metadata is allowed.

**Resolution path:** check whether `envio` (`3.0.0-rc.0`) now exposes block timestamp on the onBlock handler context; if not, add a single `eth_getBlockByNumber` per snapshot tick (cached per `(chainId, blockNumber)`). Must land before Phase 5 global snapshot work.

---

## 2. `TODO(native-balances)` — Native token balances are not tracked

**Location:** [src/handlers/BlockHandlers.ts:178-183](../../src/handlers/BlockHandlers.ts#L178-L183)

```ts
if (definition.address === config.nativeToken) {
  // TODO(native-balances): native BERA balance has no Transfer event, so it
  // is not maintained in TokenBalance. Skip for now; revisit by adding a
  // bounded RPC `getBalance` per protocol address at snapshot time.
  continue;
}
```

**Impact:**
- Native asset (BERA on Berachain, ETH on Arbitrum/Base/Ethereum, MATIC on Polygon, FTM on Fantom) is excluded from `TokenRecord` snapshots whenever held as native (not wrapped).
- Legacy Graph subgraphs *did* include native balances via direct RPC calls.
- Treasury holdings of native assets will silently disappear from the snapshot — material parity gap.

**Acceptable mitigation per migration plan:** bounded `getBalance` RPC per protocol wallet per snapshot.

**Resolution path:** add a per-chain `protocolWallets` enumeration to chain config, then `Promise.all(client.getBalance(wallet, blockNumber))` once per snapshot per chain. Must land before any chain that holds material native balances claims parity.

---

## 3. `TODO(univ3-balances)` — Univ3 `getTotalValue` returns null

**Location:** [src/pricing/univ3.ts:72-79](../../src/pricing/univ3.ts#L72-L79)

```ts
// Total reserve value for Univ3 requires the actual token balances in the pool,
// which Initialize / Swap events do NOT emit (they emit price/liquidity/tick,
// not balances). We could maintain balances via Mint / Burn / Swap deltas, but
// for now report null — Univ3 pools are never owned-liquidity holders in the
// current treasury (no fungible LP). TODO(univ3-balances).
async getTotalValue(): Promise<BigNumber | null> {
  return null;
}
```

**Impact today:** none on Arbitrum/Berachain (no fungible Univ3 LP held by treasury).

**Impact in Phase 4 (Ethereum):** the legacy Ethereum subgraph treats Univ3 POL via NFT positions (ChickenBondsManager, Tellor, etc.) and reports underlying-token balances. Need to verify whether Phase 4 Ethereum POL is held as fungible LP, NFT positions, or both — this likely requires a separate `Univ3PositionHandler` for NFTs (Mint/Burn/IncreaseLiquidity/DecreaseLiquidity events) rather than fixing `Univ3LiquidityHandler.getTotalValue`.

**Resolution path:** revisit during Phase 4 Ethereum porting. If Ethereum has fungible Univ3 LP, maintain reserves via `Mint`/`Burn`/`Swap` deltas. If NFT-only, add a separate position handler.

---

## 4. `TODO(kodiak-reserves)` — Kodiak underlying balances still hit RPC

**Location:** [src/pricing/kodiak.ts:107-121](../../src/pricing/kodiak.ts#L107-L121)

```ts
// Kodiak's `getUnderlyingBalances` returns the active range's underlying
// reserves. This is still RPC; deriving it from events would require
// tracking Univ3 concentrated-liquidity math against the Kodiak position's
// tick range, which is out of scope for this pass. TODO(kodiak-reserves).
const [token0, reserves] = await Promise.all([
  this.resolveToken0(),
  readContract(
    this.client,
    this.handler.pool,
    KODIAK_ABI,
    "getUnderlyingBalances",
    [],
    blockNumber,
  ),
]);
```

**Impact:** one RPC call per Kodiak pool per snapshot on Berachain. Acceptable in the short term per the migration plan's "one RPC per snapshot is OK" allowance, but counts against the per-snapshot budget.

**Resolution path:** defer until performance work in Phase 7. If RPC count per snapshot becomes a bottleneck, derive from Univ3 concentrated-liquidity math against the Kodiak position's tick range. Otherwise accept as a permanent invariant-effect call (cached via `withContractReadCache`).

---

## 5. Lender `deployedOhm` semantics — needs parity verification

**Location:** [src/handlers/Lender.ts:9-11](../../src/handlers/Lender.ts#L9-L11) and [src/handlers/Erc20Transfers.ts](../../src/handlers/Erc20Transfers.ts)

Current model: `deployedOhm` per `LenderAmo` is maintained from OHM `Transfer` events to/from registered AMOs, not from any RPC call to OlympusLender. `AMOAdded` / `AMORemoved` flip the `active` flag and preserve any previously-accrued `deployedOhm` defensively.

**Open question for Phase 1 inventory:** does the legacy Arbitrum subgraph compute `deployedOhm` as (a) cumulative net mints/burns of OHM to/from the AMO (current Envio model), (b) a direct `getDeployedOhm()` view-call on the OlympusLender contract, or (c) something else (e.g. accounting only mints, not burns; or only `MINTR`-mediated mints)? Parity tests against the legacy subgraph at known historical blocks will pin this down. Must be confirmed before Phase 4 Arbitrum sign-off.

---

## Status summary

| TODO | Blocker for | Acceptable as RPC call? |
|---|---|---|
| 1. timestamp | Phase 5 global snapshot, all phases (record IDs / dates) | Yes, 1 per snapshot |
| 2. native-balances | Any chain with native holdings (Phase 4) | Yes, N protocol wallets per snapshot |
| 3. univ3-balances | Phase 4 Ethereum if fungible Univ3 POL exists | No — events-only design |
| 4. kodiak-reserves | Phase 7 performance budget (Berachain only) | Yes, currently 1 per Kodiak pool per snapshot |
| 5. lender-deployedOhm | Phase 4 Arbitrum parity | No — model parity question, not RPC question |
