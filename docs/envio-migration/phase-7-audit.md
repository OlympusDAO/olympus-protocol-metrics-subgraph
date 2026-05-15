# Phase 7 — Performance pre-deployment audit

Audits the snapshot pipeline for the two pre-deployment Phase 7 items:

1. Per-snapshot RPC count ≈ 0 except accepted timestamp/invariant effects.
2. BalancerVault + shared contracts filtered by poolId so HyperSync only
   delivers events for OHM-relevant pools.

The remaining Phase 7 item (fresh DB backfill benchmark) requires the
indexer to be deployed and is the responsibility of the deployment engineer.

---

## 1. RPC sources during snapshot

Snapshot reads come through two entry points:

* **`context.effect(...)`** — cached at the (effect, input) level by Envio's
  effect framework. Each unique input is computed once per indexer process.
* **`client.readContract` / `client.getBalance`** — bypasses Envio's effect
  cache but goes through the per-snapshot `withContractReadCache` wrapper in
  `src/snapshot/contracts.ts`, which dedupes calls within the same block.

### Effects (all cached)

| Effect | Used by | Cache window | Notes |
|--------|---------|--------------|-------|
| `seedBalancerPool` | BalancerPools.ts | Forever (`cache: true`, pool init) | One-shot per pool |
| `resolveKodiakUnderlyingPool` | KodiakLps.ts | Forever | Invariant per Kodiak LP |
| `resolveBophadesKeycode` | BophadesKernel.ts | Forever | Keycode is invariant per module address |
| `readCoolerPrincipalReceivables` | BlockHandlers.ts | Per (clearinghouse, block) | 3 clearinghouses × 1 call per snapshot |
| `readMonoCoolerTotalDebt` | BlockHandlers.ts | Per (monocooler, block) | 1 call per snapshot |
| `snapshotBlvRegistry` | BlockHandlers.ts | Per (registry, block) | 1 call per snapshot + iteration through active vaults |
| `readBondManagerState` | BlockHandlers.ts | Per (bondManager, block) | 1 call per snapshot (isActive + teller) |
| `readSOhmCirculatingSupply` | BlockHandlers.ts | Per (sOHM, block) | 1 call per Ethereum snapshot |
| `readNextOhmDistribution` | BlockHandlers.ts | Per (stakingV1/V2/V3, block) | 1 call per Ethereum snapshot (multi-version sum) |
| `snapshotCurvePool` | curve.ts (pricing) | Per (pool, block) | 1 per Curve pool used in pricing |
| `snapshotFraxSwapPool` | fraxswap.ts | Per (pool, block) | 1 per FraxSwap pool used in pricing |
| `readErc4626AssetsPerShare` | erc4626.ts | Per (vault, block) | 1 per ERC4626 vault used in pricing |
| `snapshotUniv3NftPositions` | BlockHandlers.ts | Per (wallet, block) | 1 per protocol wallet per snapshot |

### Direct RPC (cached per-block via `withContractReadCache`)

| Source | Used by | Notes |
|--------|---------|-------|
| `getNativeBalance` | `readNativeBalance` | **Accepted exception** — native assets emit no Transfer event (inherited TODO from PR #311). One call per protocol wallet per snapshot for native-token chains. |
| `readContract`/`readInvariantContract` | BalancerPriceHandler (`getNormalizedWeights`), `getDecimals` | Invariant reads. Cached process-wide. |

### Summary

Per-snapshot RPC cost on Ethereum is bounded by:

- 1 call × 4 effects unconditionally (BLV registry, BondManager state, sOHM
  circulating, OHM distribution).
- N × (3 Cooler clearinghouses + 1 MonoCooler) cached at first call per block;
  re-reads in the same block hit the cache.
- N × (3 Curve + 2 FraxSwap + 4 ERC4626) pricing-time pool snapshots, cached.
- 36 × `snapshotUniv3NftPositions` per snapshot; most wallets short-circuit
  on balanceOf == 0.
- Per protocol wallet × native-token chains: 1 `getNativeBalance` (accepted).

There are **no uncached RPC reads** outside of the explicit effect /
invariant cache framework. The accepted exception (native balance) is
documented and tracked.

---

## 2. BalancerVault + shared-contract poolId filtering

The Balancer V2 Vault is a single contract per chain hosting all pools. Without
filtering, HyperSync would deliver every Swap/PoolBalanceChanged on every
Balancer pool — millions of events. Verified:

```ts
// src/handlers/BalancerPools.ts:12
function poolIdsForChain(chainId: number): `0x${string}`[] {
  const config = CHAIN_CONFIGS[chainId as ChainId];
  if (!config) return [];
  return config.liquidityHandlers
    .filter((handler) => handler.kind === "balancer")
    .map((handler) => handler.id as `0x${string}`);
}

// src/handlers/BalancerPools.ts:20
const buildBalancerPoolIdWhere = ({ chain }: { chain: { id: number } }) => {
  const poolIds = poolIdsForChain(chain.id);
  if (poolIds.length === 0) return false as const;
  return { params: { poolId: poolIds } };
};
```

Wired on all three Balancer events (`TokensRegistered`, `PoolBalanceChanged`,
`Swap`). Returns `false` when the chain has no Balancer pools registered,
preventing the handler from running at all on those chains.

Per-chain Balancer registrations as of this audit:

| Chain | Pools |
|-------|-------|
| Arbitrum | 3 (wETH-VSTA, wETH-OHM, OHM-USDC) |
| Berachain | 0 (currently — Vault address registered for future) |
| Ethereum | 4 (OHM-WETH, OHM-DAI, OHM-DAI-WETH, OHM-wstETH) |
| Base / Polygon / Fantom | 0 |

Other shared contracts that need filtering or per-pool registration:

| Contract | Filter strategy | Status |
|----------|-----------------|--------|
| TreasuryERC20 (`Transfer`) | Per-address registration in config.yaml | OK — only treasury wallets' tokens are subscribed |
| OhmERC20 (`Transfer`) | Per-address registration | OK |
| LpERC20 (`Transfer`) | Per-address registration | OK |
| UniswapV2Pool (`Sync`/`Transfer`) | Per-address registration | OK |
| UniswapV3Pool (`Initialize`/`Swap`) | Per-address registration | OK |
| KodiakLp (`Transfer`) | Per-address + dynamic Univ3 register | OK |
| BalancerVault | `where` poolId filter (see above) | OK |
| ChainlinkAggregator | Per-address registration | OK |
| SOhmV3 | Per-address (Ethereum only) | OK |
| BophadesKernel | Per-address (Ethereum only) | OK |
| BondManager / GnosisEasyAuction | Per-address (Ethereum only) | OK |

All shared contracts that aren't per-instance registered are either filtered
by `where` clauses or have only one address per chain.

---

## Outstanding (post-deployment)

* Fresh DB backfill benchmark — record wall-clock from genesis to current
  head per chain. Goal: HyperSync delivers a clean cold-start within
  acceptable bounds. Tracked separately in the deployment runbook.

Last updated: 2026-05-15.
