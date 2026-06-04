# Behavioral Inventory: Polygon Subgraph

Subgraph package: `protocol-metrics-polygon` v1.1.1  
Graph Protocol network alias: `matic`  
Source tree: `subgraphs/polygon/`

---

## 1. Manifest Summary

**Source:** [`subgraph.yaml`](../../subgraphs/polygon/subgraph.yaml)

| Field | Value |
|---|---|
| Chain ID (EVM) | 137 |
| Network name in manifest | `matic` |
| `specVersion` | `0.0.8` |
| Schema | `../../schema.graphql` (shared root schema) |

### Data Sources

| dataSource name | Contract | Address | Start block | Handler file | Entry point(s) |
|---|---|---|---|---|---|
| `TokenRecords-polygon` | gOHM (Polygon) | `0xd8cA34fd379d9ca3C6Ee3b3905678320F5b45195` | `27790000` (~2022-05-01) | `./src/treasury/Assets.ts` | `handleAssets` (block handler) |

**Handler entry point:** [`handleAssets`](../../subgraphs/polygon/src/treasury/Assets.ts#L18) — block handler, polling, every `14400` blocks (~8 hours at 2 s/block). [subgraph.yaml:41-47](../../subgraphs/polygon/subgraph.yaml#L41)

**Entities written:** `TokenRecord`, `TokenSupply` (declared in manifest; see section 8 re: `TokenSupply` — no `TokenSupply` entities are actually emitted by this subgraph).

### ABIs loaded

| ABI name | File |
|---|---|
| `ERC20` | `../shared/abis/ERC20.json` |
| `gOHM` | `../shared/abis/gOHM.json` |
| `BalancerVault` | `../shared/abis/BalancerVault.json` |
| `BalancerPoolToken` | `../shared/abis/BalancerPoolToken.json` |
| `UniswapV2Pair` | `../shared/abis/UniswapV2Pair.json` |
| `UniswapV3Pair` | `../shared/abis/UniswapV3Pair.json` |

Note: `BalancerVault`, `BalancerPoolToken`, and `UniswapV3Pair` ABIs are loaded but no handlers reference them directly — they are carried over from the shared ABI list and unused in this subgraph. [subgraph.yaml:33-40](../../subgraphs/polygon/subgraph.yaml#L33)

---

## 2. Tokens

All token definitions come from [`ERC20_TOKENS_POLYGON`](../../subgraphs/polygon/src/contracts/Constants.ts#L25).  
Decimals are fetched on-chain at query time via `contract.decimals()` ([shared/src/contracts/ERC20.ts:14](../../subgraphs/shared/src/contracts/ERC20.ts#L14)); no hardcoded decimals in this subgraph.

### ERC20 tokens (stable + volatile — iterated by `getTokenBalances`)

| Symbol | Address (lowercase) | Category | `isLiquid` | `isVolatileBluechip` | `liquidBackingMultiplier` | Notes |
|---|---|---|---|---|---|---|
| DAI | `0x8f3cf7ad23cd3cadbd9735aff958023239c6a063` | Stable | true | false | null (1.0) | [Constants.ts:26](../../subgraphs/polygon/src/contracts/Constants.ts#L26) |
| FRAX | `0x45c32fa6df82ead1e2ef74d17b76547eddfaff89` | Stable | true | false | null (1.0) | [Constants.ts:27](../../subgraphs/polygon/src/contracts/Constants.ts#L27) |
| sKLIMA | `0xb0c22d8d350c67420f06f48936654f567c73e8c8` | Volatile | true | false | **0.85** | [Constants.ts:28](../../subgraphs/polygon/src/contracts/Constants.ts#L28) |
| KLIMA | `0x4e78011ce80ee02d2c3e649fb657e45898257815` | Volatile | true | false | **0.85** | [Constants.ts:29](../../subgraphs/polygon/src/contracts/Constants.ts#L29) |
| SYN | `0x50b728d8d964fd00c2d0aad81718b71311fef68a` | Volatile | true | false | null (1.0) | [Constants.ts:30](../../subgraphs/polygon/src/contracts/Constants.ts#L30) |
| USDC | `0x2791bca1f2de4661ed88a30c99a7a9449aa84174` | Stable | true | false | null (1.0) | [Constants.ts:31](../../subgraphs/polygon/src/contracts/Constants.ts#L31) |
| WETH | `0x7ceb23fd6bc0add59e62ac25578270cff1b9f619` | Volatile | true | **true** | null (1.0) | Only token with `isVolatileBluechip=true`. [Constants.ts:32](../../subgraphs/polygon/src/contracts/Constants.ts#L32) |

### LP tokens (POL — iterated by `getOwnedLiquidityBalances`)

| Symbol | Address (lowercase) | Category | `isLiquid` | Notes |
|---|---|---|---|---|
| UniV2 wETH-gOHM | `0x1549e0e8127d380080aab448b82d280433ce4030` | Protocol-Owned Liquidity | true | Only LP token in `ERC20_TOKENS_POLYGON`. [Constants.ts:34](../../subgraphs/polygon/src/contracts/Constants.ts#L34) |

### OHM-family tokens (used as exclusion set for POL multiplier computation)

| Symbol | Address | Notes |
|---|---|---|
| gOHM | `0xd8ca34fd379d9ca3c6ee3b3905678320f5b45195` | [`OHM_TOKENS`](../../subgraphs/polygon/src/contracts/Constants.ts#L36); used in `getOwnedLiquidityBalance` to compute non-OHM multiplier |

**Note:** gOHM is NOT in `ERC20_TOKENS_POLYGON` and is not iterated as an ERC20 balance. [Constants.ts:10](../../subgraphs/polygon/src/contracts/Constants.ts#L10) — explicit comment: "Not added to ERC20_TOKENS_POLYGON".

### LP tokens referenced in name/price maps but NOT in `ERC20_TOKENS_POLYGON`

The following pools appear in `CONTRACT_NAME_MAP` and in price `HANDLERS` but are **not** in `ERC20_TOKENS_POLYGON` — they are used for price routing only, not as held assets:

| Pool | Address |
|---|---|
| UniV2 KLIMA-USDC | `0x5786b267d35f9d011c4750e0b0ba584e1fdbead1` |
| UniV2 MATIC-USDC | `0xb965c131f1c48d89b1760860b782d2acdf87273b` |
| UniV2 SYN-wETH | `0x4a86c01d67965f8cb3d0aaa2c655705e64097c31` |
| UniV2 USDC-wETH | `0x853ee4b2a13f8a742d64c8f088be7ba2131f670d` |

[Constants.ts:17-21](../../subgraphs/polygon/src/contracts/Constants.ts#L17)

---

## 3. Wallets

Wallet iteration is split into two sets:

### Standard wallet list (`WALLET_ADDRESSES` from shared)

All 35 addresses in [`WALLET_ADDRESSES`](../../subgraphs/shared/src/Wallets.ts#L68) are iterated for every ERC20 token balance lookup. Most are Ethereum-native contracts with zero balance on Polygon; non-zero balances on Polygon are expected only for the cross-chain and DAO wallets listed below.

[Contracts.ts:56](../../subgraphs/polygon/src/contracts/Contracts.ts#L56) — `getWalletAddressesForContract` builds the wallet list from `WALLET_ADDRESSES`.

| Name | Address | Role |
|---|---|---|
| Aave Allocator V2 | `0x0d33c811d0fcc711bcb388dfb3a152de445be66f` | Allocator |
| Aave Allocator V1 | `0x0e1177e47151be72e5992e0975000e73ab5fd9d4` | Allocator |
| Aura Allocator V2 | `0x8caf91a6bb38d55fb530dec0fab535fa78d98fad` | Allocator |
| Aura Allocator | `0x872ebdd8129aa328c89f6bf032bbd77a4c4bac7e` | Allocator |
| Balancer Allocator | `0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6` | Allocator |
| Bond Depository | `0x9025046c6fb25fb39e720d97a8fd881ed69a1ef6` | Bonds |
| Bond (Inverse) Depository | `0xba42be149e5260eba4b82418a6306f55d532ea47` | Bonds |
| Buyback MS | `0xf7deb867e65306be0cb33918ac1b8f89a72109db` | Treasury |
| Convex Allocator 1 | `0x3df5a355457db3a4b5c744b8623a7721bf56df78` | Allocator |
| Convex Allocator 2 | `0x408a9a09d97103022f53300a3a14ca6c3ff867e8` | Allocator |
| Convex Allocator 3 | `0xdbf0683fc4fc8ac11e64a6817d3285ec4f2fc42d` | Allocator |
| Convex CVX Allocator | `0xdfc95aaf0a107daae2b350458ded4b7906e7f728` | Allocator |
| Convex vlCVX Allocator | `0x2d643df5de4e9ba063760d475beaa62821c71681` | Allocator |
| Convex Staking Proxy FraxBP | `0x943c1dfa7da96e54242bd2c78dd3ef5c7b24b18c` | Allocator |
| Convex Staking Proxy OHM-FraxBP | `0x75e7f7d871f4b5db0fa9b0f01b7422352ec9618f` | Allocator |
| Cross-Chain Arbitrum | `0x012bbf0481b97170577745d2167ee14f63e2ad4c` | Cross-chain bridge wallet |
| Cross-Chain Fantom | `0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10` | Cross-chain bridge wallet |
| Cross-Chain Polygon | `0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7` | **Primary Polygon treasury wallet** |
| Treasury MS (DAO Wallet) | `0x245cc372c84b3645bf0ffe6538620b04a217988b` | DAO wallet |
| DAO Working Capital | `0xf65a665d650b5de224f46d729e2bd0885eea9da5` | DAO wallet |
| LUSD Allocator | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Allocator |
| LUSD Allocator V2 | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Allocator (same address as V1) |
| Maker DSR Allocator Proxy | `0x5db0761487e26b555f5bfd5e40f4cbc3e1a7d11e` | Allocator |
| Maker DSR Allocator | `0x0ea26319836ff05b8c5c5afd83b8ab17dd46d063` | Allocator |
| OTC Escrow | `0xe3312c3f1ab30878d9686452f7205ebe11e965eb` | OTC |
| Rari Allocator | `0x061c8610a784b8a1599de5b1157631e35180d818` | Allocator |
| Treasury V1 | `0x886ce997aa9ee4f8c2282e182ab72a705762399d` | Treasury |
| Treasury V2 | `0x31f8cc382c9898b273eff4e0b7626a6987c846e8` | Treasury |
| Treasury V3 | `0x9a315bdf513367c0377fb36545857d12e85813ef` | Treasury |
| TRSRY | `0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613` | Treasury module |
| TRSRY V1.1 | `0xea1560f36f71a2f54defa75ed9eaa15e8655be22` | Treasury module |
| VeFXS Allocator | `0xde7b85f52577b113181921a7aa8fc0c22e309475` | Allocator |
| Cooler Loans Clearinghouse V1 | `0xd6a6e8d9e82534bd65821142fccd91ec9cf31880` | Cooler Loans |
| Cooler Loans Clearinghouse V1.1 | `0xe6343ad0675c9b8d3f32679ae6adbA0766a2ab4c` | Cooler Loans |
| Cooler Loans Clearinghouse V2 | `0x1e094fe00e13fd06d64eea4fb3cd912893606fe0` | Cooler Loans |
| Cooler Loans V2 MonoCooler | `0xdb591ea2e5db886da872654d58f6cc584b68e7cc` | Cooler Loans |
| Yield Farming MS | `0x2075e3b46470cce124daaf52b46dcf965727dd1` | Yield farming |

[shared/src/Wallets.ts:68-105](../../subgraphs/shared/src/Wallets.ts#L68)

### Non-treasury asset whitelist (per-token wallet override)

For `WETH` only, `DAO_WALLET` (`0x245cc372c84b3645bf0ffe6538620b04a217988b`) is appended to the wallet list if not already present. [Contracts.ts:39-40](../../subgraphs/polygon/src/contracts/Contracts.ts#L39).

This pattern implies `DAO_WALLET` is **not** in `WALLET_ADDRESSES` for Polygon context — but inspection of `shared/src/Wallets.ts` shows `DAO_WALLET` IS already included in `WALLET_ADDRESSES`. In practice the dedup logic at [Contracts.ts:58-65](../../subgraphs/polygon/src/contracts/Contracts.ts#L58) skips adding it again.

---

## 4. Price Feeds and Routing

No Chainlink feeds. All pricing is pool-based via `PriceHandler` objects in [`HANDLERS`](../../subgraphs/polygon/src/price/PriceLookup.ts#L24).

The routing engine is [`getUSDRate`](../../subgraphs/shared/src/price/PriceRouter.ts#L73) in shared. It iterates handlers in order and, when multiple results exist, picks the one with higher `liquidity`. Currently all UniswapV2 handlers return `liquidity: BigDecimal.zero()`, so the first matching handler wins in practice. [PriceHandlerUniswapV2.ts:112](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L112)

Recursive cycles are prevented by skipping any handler with the same `id` or the same token set as the current pool. [PriceRouter.ts:112-120](../../subgraphs/shared/src/price/PriceRouter.ts#L112)

### Handler list (in declaration order)

[PriceLookup.ts:24-31](../../subgraphs/polygon/src/price/PriceLookup.ts#L24)

| # | Handler type | Token(s) priced | Pool / mapping | Notes |
|---|---|---|---|---|
| 1 | `PriceHandlerCustomMapping` | `sKLIMA` | maps to `KLIMA` price | sKLIMA price = KLIMA price (1:1 peg). [PriceLookup.ts:25](../../subgraphs/polygon/src/price/PriceLookup.ts#L25) |
| 2 | `PriceHandlerStablecoin` | DAI, FRAX, USDC | hardcoded `1.0` | No oracle, no pool. [PriceLookup.ts:26](../../subgraphs/polygon/src/price/PriceLookup.ts#L26) |
| 3 | `PriceHandlerUniswapV2` | gOHM, WETH | `LP_UNISWAP_V2_WETH_GOHM` (`0x1549e0e8127d380080aab448b82d280433ce4030`) | gOHM or WETH priced via this pool. [PriceLookup.ts:27](../../subgraphs/polygon/src/price/PriceLookup.ts#L27) |
| 4 | `PriceHandlerUniswapV2` | KLIMA, USDC | `LP_UNISWAP_V2_KLIMA_USDC` (`0x5786b267d35f9d011c4750e0b0ba584e1fdbead1`) | KLIMA priced in USDC. [PriceLookup.ts:28](../../subgraphs/polygon/src/price/PriceLookup.ts#L28) |
| 5 | `PriceHandlerUniswapV2` | SYN, WETH | `LP_UNISWAP_V2_SYN_WETH` (`0x4a86c01d67965f8cb3d0aaa2c655705e64097c31`) | SYN priced via WETH. [PriceLookup.ts:29](../../subgraphs/polygon/src/price/PriceLookup.ts#L29) |
| 6 | `PriceHandlerUniswapV2` | USDC, WETH | `LP_UNISWAP_V2_USDC_WETH` (`0x853ee4b2a13f8a742d64c8f088be7ba2131f670d`) | WETH or USDC priced via this pool. [PriceLookup.ts:30](../../subgraphs/polygon/src/price/PriceLookup.ts#L30) |

**Price resolution path for each token:**

- `DAI`, `FRAX`, `USDC` → handler 2 → `1.0` USD
- `USDC` also matches handler 6 (as pair token); handler 2 fires first in order
- `WETH` → handler 3 (WETH-gOHM) or handler 6 (USDC-WETH); first match wins; handler 3 fires first
- `WETH` via handler 3 requires a recursive lookup for gOHM; gOHM price then requires a recursive lookup for WETH, but handler 3 is skipped (same pool recursion guard), so handler 6 resolves WETH → USDC → `1.0`
- `gOHM` → handler 3 → recursive `WETH` via handler 6 → `1.0`
- `KLIMA` → handler 4 → recursive `USDC` via handler 2 → `1.0`
- `sKLIMA` → handler 1 → delegates to `KLIMA` → handler 4
- `SYN` → handler 5 → recursive `WETH` via handler 6

**Native MATIC:** not priced. `LP_UNISWAP_V2_MATIC_USDC` appears in `CONTRACT_NAME_MAP` [Constants.ts:63](../../subgraphs/polygon/src/contracts/Constants.ts#L63) but is **not** in `HANDLERS` and is not used for MATIC pricing. Native MATIC balance tracking is absent entirely (see section 10).

**No Balancer pools** are referenced in `HANDLERS` despite `BalancerVault` ABI being loaded.

---

## 5. Liquidity Pools / Handlers

### POL-bearing pool

The only LP in `ERC20_TOKENS_POLYGON` with category `Protocol-Owned Liquidity`:

| Pool | Address | DEX | Token pair | Category |
|---|---|---|---|---|
| UniV2 wETH-gOHM | `0x1549e0e8127d380080aab448b82d280433ce4030` | UniswapV2 | WETH / gOHM | POL |

[Constants.ts:34](../../subgraphs/polygon/src/contracts/Constants.ts#L34), handler 3 in `HANDLERS` [PriceLookup.ts:27](../../subgraphs/polygon/src/price/PriceLookup.ts#L27).

### POL balance computation

[`getOwnedLiquidityBalance`](../../subgraphs/polygon/src/treasury/OwnedLiquidity.ts#L24) iterates `HANDLERS` (all 6 price handlers) and calls each handler as a liquidity handler. Only handlers that can return a non-zero `getBalance` / `getTotalValue` will produce records.

For each handler in `HANDLERS`:
1. `totalValue = handler.getTotalValue([], getPriceRecursive, block)` — total pool value excluding nothing
2. `includedValue = handler.getTotalValue(OHM_TOKENS, getPriceRecursive, block)` — pool value excluding gOHM
3. `multiplier = includedValue / totalValue` — fraction of pool value that is non-OHM
4. `unitRate = handler.getUnitPrice(getPriceRecursive, block)` — LP token price
5. For each wallet in `WALLET_ADDRESSES`: check balance; if non-zero, emit `TokenRecord` with `multiplier` [OwnedLiquidity.ts:55-82](../../subgraphs/polygon/src/treasury/OwnedLiquidity.ts#L55)

**Practical impact:** `PriceHandlerStablecoin` and `PriceHandlerCustomMapping` have stub `getTotalValue` returning `BigDecimal.zero()` and `null` respectively, so they short-circuit and emit no records. Only `PriceHandlerUniswapV2` instances produce records. Of the four UniV2 handlers, only the one for `wETH-gOHM` is expected to have a non-zero treasury wallet balance.

### Token record fields for POL

`TokenRecord.multiplier` = non-OHM fraction of pool (computed at snapshot time)  
`TokenRecord.category` = `"Protocol-Owned Liquidity"` (from `ERC20_TOKENS_POLYGON` lookup)  
`TokenRecord.isLiquid` = `true` [Constants.ts:34](../../subgraphs/polygon/src/contracts/Constants.ts#L34)  
`TokenRecord.isBluechip` = `false`

---

## 6. Snapshot Cadence

| Trigger | Frequency | Handler | Notes |
|---|---|---|---|
| Block polling | Every 14,400 blocks | `handleAssets` | [subgraph.yaml:41-46](../../subgraphs/polygon/subgraph.yaml#L41). ~8 hours at Polygon's ~2 s/block average. |

`handleAssets` [Assets.ts:18](../../subgraphs/polygon/src/treasury/Assets.ts#L18) calls `generateTokenRecords` [Assets.ts:10](../../subgraphs/polygon/src/treasury/Assets.ts#L10) which runs:
1. `getTokenBalances(timestamp, TokenCategoryStable, blockNumber)` — all stable ERC20s
2. `getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber)` — all volatile ERC20s
3. `getOwnedLiquidityBalances(timestamp, blockNumber)` — all POL LP positions

Each call produces and saves `TokenRecord` entities directly (via `record.save()` inside `createTokenRecord`). No batching or deferred writes.

---

## 7. Manual Offsets / Migration / Quirks

### Grafting (commented out)

A graft is defined but commented out in the manifest:

```yaml
# graft:
#   base: Qmayo4ydvieNxGzLcHdpNZZZCgeqBqcxtL4sTiEjdbDwKo
#   block: 40300000 # 2023-03-13
```

[subgraph.yaml:5-8](../../subgraphs/polygon/subgraph.yaml#L5). Not active. No live grafting dependency.

### Polygon trace limitation

Comment in manifest [subgraph.yaml:16-17](../../subgraphs/polygon/subgraph.yaml#L16):

> "We would ideally use rebase() on the KlimaStaking contract, but Polygon's nodes do not support trace, so we can't use a call handler"

This means KlimaDAO staking rebase events are not indexed. The subgraph uses a block polling approach instead of event-driven updates.

### `liquidBackingMultiplier` for KLIMA and sKLIMA

Both KLIMA and sKLIMA have `liquidBackingMultiplier = 0.85`. [Constants.ts:28-29](../../subgraphs/polygon/src/contracts/Constants.ts#L28).

This means `TokenRecord.valueExcludingOhm = balance * rate * 0.85` for these tokens. The multiplier is applied in `createTokenRecord` via `getTokenMultiplier`. [TokenRecordHelper.ts:79-99](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L79)

### Zero balance short-circuit

`getERC20TokenRecordFromWallet` returns `null` if balance is zero. [ERC20.ts:112](../../subgraphs/shared/src/contracts/ERC20.ts#L112). No zero-balance records are ever written. This is consistent across all tokens and wallets.

### gOHM not tracked as a holding

gOHM (`ERC20_GOHM`) is declared in `Constants.ts` and used as the trigger contract for the data source, but is explicitly excluded from `ERC20_TOKENS_POLYGON` via comment [Constants.ts:10](../../subgraphs/polygon/src/contracts/Constants.ts#L10). gOHM balance in treasury wallets on Polygon produces no `TokenRecord`.

### No `TokenSupply` entities emitted

Despite `TokenSupply` being listed in `subgraph.yaml` entities [subgraph.yaml:25](../../subgraphs/polygon/subgraph.yaml#L25), no code in the Polygon subgraph writes `TokenSupply` records. The Polygon chain has no OHM/sOHM contract, so supply tracking is absent.

---

## 8. Chain-Specific Protocol Entities

_None._ The Polygon subgraph does not write `ProtocolMetric`, `BophadesModule`, `ClearinghouseAddress`, `PriceSnapshot`, or any other protocol entity. It writes `TokenRecord` only.

The `Balancer Vault` address is mapped in `CONTRACT_NAME_MAP` [Constants.ts:23-24](../../subgraphs/polygon/src/contracts/Constants.ts#L23) but no Balancer pool data sources or handlers exist.

---

## 9. Tests in Tree

| File | Content |
|---|---|
| [`subgraphs/polygon/tests/dummy.test.ts`](../../subgraphs/polygon/tests/dummy.test.ts) | Empty file (0 bytes). No test assertions. Exists as a placeholder. |

No functional test coverage exists for the Polygon subgraph.

---

## 10. Open Questions for New Envio Implementation

1. **Native MATIC balance:** `LP_UNISWAP_V2_MATIC_USDC` exists in `CONTRACT_NAME_MAP` [Constants.ts:18](../../subgraphs/polygon/src/contracts/Constants.ts#L18) and [Constants.ts:63](../../subgraphs/polygon/src/contracts/Constants.ts#L63) suggesting native MATIC was considered, but there is no price handler for MATIC, no MATIC entry in `ERC20_TOKENS_POLYGON`, and `getNativeTokenBalances` is not called in any Polygon handler. Does the legacy subgraph actually track native MATIC? If yes, it would be a silent omission in the current Graph subgraph. If no, the `inherited-todos.md` note about `TODO(native-balances)` for Polygon is moot.

2. **POL loop over all HANDLERS:** `getOwnedLiquidityBalances` loops over all 6 entries in `HANDLERS` (including stablecoin and custom-mapping handlers) to check for LP balances [OwnedLiquidity.ts:95](../../subgraphs/polygon/src/treasury/OwnedLiquidity.ts#L95). The stablecoin and custom-mapping handlers return zero/null from `getTotalValue`, silently short-circuiting. In the Envio port, only the `PriceHandlerUniswapV2` handlers should be registered as liquidity handlers to avoid unnecessary work.

3. **WETH as volatile bluechip:** WETH has `isVolatileBluechip = true` [Constants.ts:32](../../subgraphs/polygon/src/contracts/Constants.ts#L32). Does this have downstream effects on the global metrics snapshot (e.g. liquid backing per OHM calculations)? Confirm whether the Envio port needs to carry this flag.

4. **Wallet list mismatch:** The full `WALLET_ADDRESSES` list contains many Ethereum-specific allocators (Aave, Convex, Cooler Loans, etc.) that will never hold assets on Polygon. The Graph subgraph makes one `balanceOf` RPC call per wallet per token — potentially 35 wallets × 7 tokens + POL = ~280 RPC calls per snapshot. The Envio port should narrow the wallet list to Polygon-relevant addresses (at minimum: `CROSS_CHAIN_POLYGON`, `DAO_WALLET`) to reduce snapshot cost.

5. **sKLIMA / KLIMA `liquidBackingMultiplier = 0.85`:** The 0.85 multiplier on both KLIMA and sKLIMA is undocumented in the codebase. Confirm whether this reflects a known carbon-credit backing ratio for KlimaDAO and whether it should be preserved exactly in the Envio implementation.

6. **Price routing: WETH resolves via handler 3 first (gOHM-WETH pool), not handler 6 (USDC-WETH).** The gOHM-WETH pool is also the only POL pool. If that pool is illiquid or has low reserves, WETH price may be unreliable, cascading to gOHM, SYN, and KLIMA prices. In the Envio implementation, consider ordering handlers so the deeper-liquidity USDC-WETH pool is checked first for WETH, or implement a liquidity-weighted selection.

7. **`TokenSupply` entity in manifest but never written:** Confirm this is intentional — Polygon has no OHM supply to track. The manifest entity declaration can be dropped in the Envio config.

8. **`LP_UNISWAP_V2_MATIC_USDC` in name map but unused:** Determine whether to carry this pool forward as a MATIC price oracle in the Envio port, or drop it entirely.
