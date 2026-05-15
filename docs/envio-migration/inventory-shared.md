# Shared Subgraph Inventory

Cross-chain shared library used by every chain subgraph. Contains no deployable handlers — only exported TypeScript classes, functions, and constants consumed via relative imports. All code is AssemblyScript-flavored TypeScript compiled by `graph-ts`.

---

## 1. Manifest Summary

[subgraph.yaml](../../subgraphs/shared/subgraph.yaml) is explicitly a **dummy manifest** (see comment on line 1) and is not used for deployment. Its purpose is to allow `graph codegen` to run inside the `shared/` package so that the generated binding types (ERC20, gOHM, UniswapV2Pair, etc.) are available to all chain subgraphs via relative import of `../../shared/generated/...`.

The manifest registers a single `ethereum/contract` data source named `Price` tracking the gOHM Arbitrum address (`0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1`) with a `blockHandlers` entry pointing at `src/Dummy.ts`. Both `Dummy.ts` and the companion `Uniswapv2.ts` file are empty (zero bytes); they exist only as codegen targets.

ABIs registered in the manifest (used by codegen only):

- `ERC20`, `ERC4626`, `gOHM`, `sOlympusERC20{,V2,V3}`, `BalancerVault`, `BalancerPoolToken`, `UniswapV2Pair`, `UniswapV3Pair`, `UniswapV3PositionManager`, `UniswapV3Quoter`

---

## 2. Constants

File: [`src/Constants.ts`](../../subgraphs/shared/src/Constants.ts)

| Export | Value | Notes |
|---|---|---|
| `ERC20_SOHM_V2` | `0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f` | sOHM v2 address — lowercase |
| `ERC20_SOHM_V2_BLOCK` | `"12622596"` | Activation block (string) |
| `ERC20_SOHM_V3` | `0x04906695d6d12cf5459975d7c3c03356e4ccd460` | sOHM v3 address — lowercase |
| `ERC20_SOHM_V3_BLOCK` | `"13806000"` | Activation block (string) |

These four constants are consumed by [`OhmCalculations.ts`](../../subgraphs/shared/src/supply/OhmCalculations.ts) to select the correct sOHM version when reading the staking index: v3 if `blockNumber > 13806000`, else v2. See [section 8](#8-supply-helpers).

---

## 3. Shared Wallet Definitions

File: [`src/Wallets.ts`](../../subgraphs/shared/src/Wallets.ts)

Exports 35+ individual address constants (all `.toLowerCase()`) and one master array `WALLET_ADDRESSES` ([line 68](../../subgraphs/shared/src/Wallets.ts#L68)).

**Cross-chain bridge addresses** (referenced by Arbitrum, Polygon, Fantom chain subgraphs):

| Export | Address |
|---|---|
| `CROSS_CHAIN_ARBITRUM` | `0x012bbf0481b97170577745d2167ee14f63e2ad4c` |
| `CROSS_CHAIN_FANTOM` | `0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10` |
| `CROSS_CHAIN_POLYGON` | `0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7` |

**Ethereum Treasury addresses**:

- `TREASURY_ADDRESS_V1/V2/V3`, `TRSRY`, `TRSRY_V1_1`

**Allocator/protocol addresses** (Ethereum-specific but defined here for cross-chain reuse):

- `AAVE_ALLOCATOR{,_V2}`, `AURA_ALLOCATOR{,_V2}`, `BALANCER_ALLOCATOR`, `CONVEX_ALLOCATOR{1,2,3}`, `CONVEX_CVX_{,VL_}ALLOCATOR`, `CONVEX_STAKING_PROXY_{FRAXBP,OHM_FRAXBP}`, `LUSD_ALLOCATOR{,_V2}`, `MAKER_DSR_ALLOCATOR{,_PROXY}`, `RARI_ALLOCATOR`, `VEFXS_ALLOCATOR`

**Bond/operational addresses**:

- `BONDS_DEPOSIT`, `BONDS_INVERSE_DEPOSIT`, `BUYBACK_MS`, `DAO_WALLET`, `DAO_WORKING_CAPITAL`, `OLYMPUS_ASSOCIATION_WALLET`, `OTC_ESCROW`, `MYSO_LENDING`, `VENDOR_LENDING`, `YIELD_FARMING_MS`

**Cooler Loans addresses** (comment on [line 46](../../subgraphs/shared/src/Wallets.ts#L46): *do not iterate — use `getClearinghouseAddresses()` instead*):

- `COOLER_LOANS_CLEARINGHOUSE_V1/V1_1/V2`, `COOLER_LOANS_V2_MONOCOOLER`

**`WALLET_ADDRESSES` array** ([line 68](../../subgraphs/shared/src/Wallets.ts#L68)): the canonical multi-wallet scan list used for ERC20 balance lookups across all tokens. Excludes `MYSO_LENDING` and `VENDOR_LENDING` (whose deployed amounts are hard-coded) and `OLYMPUS_ASSOCIATION_WALLET` (not protocol-owned). Also excludes `TRSRY_V1_1`, `OTC_ESCROW`, `BUYBACK_MS` note: those constants are defined above but are present in the list — verify against the actual array when porting.

Chain subgraphs import individual constants and `WALLET_ADDRESSES` via relative import, e.g. `import { CROSS_CHAIN_ARBITRUM, WALLET_ADDRESSES } from "../../../shared/src/Wallets"`.

---

## 4. Shared Contract Helpers

### `src/contracts/ContractLookup.ts`

[Line 1](../../subgraphs/shared/src/contracts/ContractLookup.ts#L1): defines the `ContractNameLookup` type alias:

```ts
export type ContractNameLookup = (
  tokenAddress: string,
  suffix?: string | null,
  abbreviation?: string | null
) => string;
```

Each chain subgraph supplies its own implementation (typically a `getContractName` function backed by a local address→name map). This type is threaded through every handler that logs or constructs `TokenRecord.token` / `TokenRecord.source` fields.

### `src/contracts/TokenDefinition.ts`

[Line 7](../../subgraphs/shared/src/contracts/TokenDefinition.ts#L7): the `TokenDefinition` class. Each chain subgraph constructs a `Map<string, TokenDefinition>` keyed by lowercase token address; the map is passed into `createTokenRecord` and all balance helpers.

**Properties:**

| Property | Type | Purpose |
|---|---|---|
| `address` | `string` (lowercase) | Token address |
| `category` | `string` | One of `TokenCategoryStable` / `TokenCategoryVolatile` / `TokenCategoryPOL` |
| `isLiquid` | `boolean` | Determines `TokenRecord.isLiquid` |
| `isVolatileBluechip` | `boolean` | Determines `TokenRecord.isBluechip` |
| `liquidBackingMultiplier` | `BigDecimal \| null` | Multiplier applied to `valueExcludingOhm`; must be >= 0 (asserted at [line 35](../../subgraphs/shared/src/contracts/TokenDefinition.ts#L35)) |
| `isLiability` | `boolean` | If true, `value` and `valueExcludingOhm` are negated |

**String constants** ([line 3](../../subgraphs/shared/src/contracts/TokenDefinition.ts#L3)):

- `TokenCategoryStable = "Stable"`
- `TokenCategoryVolatile = "Volatile"`
- `TokenCategoryPOL = "Protocol-Owned Liquidity"`

### `src/contracts/ERC20.ts`

[Line 1](../../subgraphs/shared/src/contracts/ERC20.ts#L1): wraps the generated `ERC20` binding.

**Exports:**

| Function | Signature | Behavior |
|---|---|---|
| `getERC20` | `(tokenAddress: string, _block: BigInt) => ERC20` | Binds the generated ERC20 contract at the given address. `_block` is unused (kept for API symmetry). |
| `getDecimals` | `(tokenAddress: string, block: BigInt) => number` | Calls `contract.decimals()` directly (no revert guard). |
| `getBalance` | `(contract: ERC20 \| null, address: string, currentBlockNumber: BigInt, contractLookup: ContractNameLookup) => BigInt` | Returns `BigInt.zero()` if `contract` is null or if `try_balanceOf` reverts. Logs at debug level on both paths. |
| `getERC20DecimalBalance` | `(tokenAddress: string, sourceAddress: string, _blockNumber: BigInt, _contractLookup: ContractNameLookup) => BigDecimal` | Binds contract inline, calls `try_balanceOf`, returns `toDecimal(value, contract.decimals())` or `BigDecimal.zero()` on revert. |
| `getERC20TokenRecordFromWallet` | `(timestamp, contractAddress, walletAddress, contract, rate, blockNumber, contractLookup, tokenDefinitions, blockchain) => TokenRecord \| null` | Full pipeline: calls `try_balanceOf`, skips if zero, calls `getDecimals`, calls `toDecimal`, then delegates to `createTokenRecord`. Returns `null` on revert or zero balance. |

**Key invariants:**
- All balance reads use `try_*` variants and swallow reverts to `BigInt.zero()` / `BigDecimal.zero()`.
- `getDecimals` does NOT use `try_decimals()` — a contract that reverts on `decimals()` will crash the indexer. This is a porting risk.
- The `_block` parameter in `getERC20` and `getERC20DecimalBalance` is ignored; the binding is stateless in the Graph runtime.

### `src/contracts/sOlympus.ts`

[Line 1](../../subgraphs/shared/src/contracts/sOlympus.ts#L1): simple binding helpers for sOHM contract versions.

**Exports:** `getSOlympusERC20`, `getSOlympusERC20V2`, `getSOlympusERC20V3` — each takes `(contractAddress: string, currentBlockNumber: BigInt)` and returns the appropriate generated binding. `currentBlockNumber` is logged but not used for selection (selection is done by the caller in `OhmCalculations.ts`).

---

## 5. Price Routing Core

### `src/price/PriceRouter.ts`

[Line 1](../../subgraphs/shared/src/price/PriceRouter.ts#L1)

**`getUSDRate` signature** ([line 73](../../subgraphs/shared/src/price/PriceRouter.ts#L73)):

```ts
export function getUSDRate(
  tokenAddress: string,
  handlers: PriceHandler[],
  priceLookup: PriceLookup,
  block: BigInt,
  currentPool: string | null = null,
): PriceLookupResult | null
```

**Algorithm:**

1. If `currentPool` is non-null, locate the `PriceHandler` whose `getId() == currentPool` — this is the `currentPoolHandler` ([line 91](../../subgraphs/shared/src/price/PriceRouter.ts#L91)).
2. Iterate all handlers in order:
   - **Same-handler guard** ([line 113](../../subgraphs/shared/src/price/PriceRouter.ts#L113)): skip any handler where `getId() == currentPool`. Prevents a pool from pricing itself.
   - **Same-token-set guard** ([line 119](../../subgraphs/shared/src/price/PriceRouter.ts#L119)): skip any handler where `hasSameTokenSet(handler, currentPoolHandler)` is true. Prevents a pair of pools covering the same token pair from pricing each other in a cycle (e.g. two OHM-DAI pools).
   - **Token match** ([line 125](../../subgraphs/shared/src/price/PriceRouter.ts#L125)): skip if `!handler.matches(tokenAddress)`.
   - Call `handler.getPrice(tokenAddress, priceLookup, block)` ([line 130](../../subgraphs/shared/src/price/PriceRouter.ts#L130)); skip if null.
3. **Highest-liquidity selection** ([line 144](../../subgraphs/shared/src/price/PriceRouter.ts#L144)): the running `finalPriceResult` is replaced only when the new result has strictly greater `liquidity`. The first non-null result is always accepted.
4. Returns `finalPriceResult` or `null` if no handler matched.

**`hasSameTokenSet` function** ([line 34](../../subgraphs/shared/src/price/PriceRouter.ts#L34)):

- Compares `handler.getTokens()` arrays sorted case-insensitively. Arrays of different lengths immediately return `false`. Arrays of equal length are compared element-by-element after sorting ([line 47](../../subgraphs/shared/src/price/PriceRouter.ts#L47)).
- Sorting uses a manual bubble sort ([line 8](../../subgraphs/shared/src/price/PriceRouter.ts#L8)) because AssemblyScript does not support `Array.sort()` with closures.

**`currentPool` recursion guard semantics:**

When a pool handler calls `priceLookup(otherToken, block, this.getId())`, the `currentPool` parameter is set to the calling pool's `getId()` value. `getUSDRate` then skips both the calling pool and any other handler sharing the same token set, preventing:
- Direct self-recursion (pool tries to price itself).
- Cross-pool cycles between pools covering the same pair (OHM-DAI-PoolA and OHM-DAI-PoolB).

**Failure modes:**

- Returns `null` (never throws) when no handler matches or all handlers return null. Callers must check for null.
- Individual handlers may `throw` on programming errors (token not in pool, etc.) — these propagate up.

**`PriceLookupResult` type** ([line 6](../../subgraphs/shared/src/price/PriceHandler.ts#L6)):

```ts
export class PriceLookupResult {
  liquidity: BigDecimal;
  price: BigDecimal;
}
```

Note: several handlers set `liquidity: BigDecimal.zero()` as a TODO (Balancer, UniswapV2, Stablecoin). Only `PriceHandlerUniswapV3` and `PriceHandlerUniswapV3Quoter` compute a real liquidity depth ([line 156](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L156) and [line 158](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L158)). `PriceHandlerERC4626` returns `U64.MAX_VALUE` as liquidity to force itself to win when multiple handlers match.

**`PriceLookup` type alias** ([line 27](../../subgraphs/shared/src/price/PriceHandler.ts#L27)):

```ts
export type PriceLookup = (
  tokenAddress: string,
  block: BigInt,
  currentPool: string | null
) => PriceLookupResult | null;
```

Each chain subgraph provides a concrete implementation that captures its handler list and calls `getUSDRate`.

---

## 6. Liquidity Handler Base Interface

File: [`src/price/PriceHandler.ts`](../../subgraphs/shared/src/price/PriceHandler.ts)

`PriceHandler` is a TypeScript `interface` ([line 33](../../subgraphs/shared/src/price/PriceHandler.ts#L33)):

| Method | Signature | Contract |
|---|---|---|
| `getId()` | `() => string` | Unique identifier for this handler instance. Used as the `currentPool` recursion guard key. Pool handlers return their pool/vault address; Stablecoin returns the string `"PriceHandlerStablecoin"`. |
| `exists()` | `() => boolean` | Returns true if the underlying contract is accessible (non-reverted call at block 0). Used by some callers to skip inactive handlers. |
| `matches(tokenAddress)` | `(string) => boolean` | Returns true if this handler can price the given token. Must be consistent with `getTokens()`. |
| `getTokens()` | `() => string[]` | All token addresses this handler covers. Used by `hasSameTokenSet` for cycle detection. |
| `getPrice(tokenAddress, priceLookup, block)` | `(string, PriceLookup, BigInt) => PriceLookupResult \| null` | Returns the USD price plus a liquidity weight. Returns `null` if the pool is inaccessible. May throw if `tokenAddress` does not belong to the pool. |
| `getTotalValue(excludedTokens, priceLookup, block)` | `(string[], PriceLookup, BigInt) => BigDecimal \| null` | Sum of `(balance * price)` for all tokens in the pool, optionally excluding specified tokens. Returns `null` on failure. |
| `getUnitPrice(priceLookup, block)` | `(PriceLookup, BigInt) => BigDecimal \| null` | Unit price of one LP token: `totalValue / totalSupply`. For UniswapV3 (no fungible supply), returns `totalValue` directly. |
| `getBalance(walletAddress, block)` | `(string, BigInt) => BigDecimal` | LP token balance of `walletAddress`. Returns `BigDecimal.zero()` if inaccessible. Never null. |
| `getUnderlyingTokenBalance(walletAddress, tokenAddress, block)` | `(string, string, BigInt) => BigDecimal` | Calculates the wallet's pro-rata share of `tokenAddress` reserves: `(walletLpBalance / totalSupply) * tokenReserves`. Some implementations `throw` if not applicable. |

---

## 7. Specific Handler Implementations

### 7.1 `PriceHandlerStablecoin`

File: [`src/price/PriceHandlerStablecoin.ts`](../../subgraphs/shared/src/price/PriceHandlerStablecoin.ts)

Constructor: `(addresses: string[], contractLookup: ContractNameLookup)` — accepts a list of stablecoin addresses.

- `getId()`: returns the string literal `"PriceHandlerStablecoin"` ([line 20](../../subgraphs/shared/src/price/PriceHandlerStablecoin.ts#L20)). All stablecoins share a single handler instance, which means `hasSameTokenSet` will treat them all as one token set for cycle-detection purposes.
- `getPrice()`: always returns `{ price: BigDecimal.fromString("1"), liquidity: BigDecimal.fromString("0") }` ([line 44](../../subgraphs/shared/src/price/PriceHandlerStablecoin.ts#L44)). The zero liquidity means any other handler that also claims to price a stablecoin will win on the liquidity comparison.
- `getTotalValue()`, `getUnitPrice()`: return `null`.
- `getBalance()`: returns `BigDecimal.zero()`.
- `getUnderlyingTokenBalance()`: throws `"Method not implemented."`.
- Throws if `getPrice` is called with a non-matching token (defensive guard at [line 36](../../subgraphs/shared/src/price/PriceHandlerStablecoin.ts#L36)).

### 7.2 `PriceHandlerRemapping`

File: [`src/price/PriceHandlerRemapping.ts`](../../subgraphs/shared/src/price/PriceHandlerRemapping.ts)

Constructor: `(assetAddress: string, destinationTokenAddress: string, contractLookup: ContractNameLookup)`

Maps one token's price to another token's price. Example use: pricing a synthetic token as equivalent to its underlying.

- `getId()`: returns `this.assetAddress` ([line 22](../../subgraphs/shared/src/price/PriceHandlerRemapping.ts#L22)).
- `getTokens()`: returns `[this.assetAddress]` only — the destination is not included, so `hasSameTokenSet` will not treat the source+destination pair as a unified token set.
- `getPrice()`: calls `priceLookup(this.destinationTokenAddress, block, this.getId())` and returns the result directly ([line 38](../../subgraphs/shared/src/price/PriceHandlerRemapping.ts#L38)).
- `getTotalValue()`, `getUnitPrice()`, `getBalance()`, `getUnderlyingTokenBalance()`: all `throw` "not implemented".

### 7.3 `PriceHandlerCustomMapping`

File: [`src/price/PriceHandlerCustomMapping.ts`](../../subgraphs/shared/src/price/PriceHandlerCustomMapping.ts)

Constructor: `(tokenAddress: string, mappedTokenAddresses: string[], contractLookup: ContractNameLookup)`

Maps one or more tokens' prices to the price of a single reference token. Example use: pricing sKLIMA at the same rate as KLIMA.

- `getId()`: returns `"${tokenAddress}-${mappedTokenAddresses.join("/")}"` ([line 29](../../subgraphs/shared/src/price/PriceHandlerCustomMapping.ts#L29)).
- `matches()`: checks `mappedTokenAddresses`, not `tokenAddress` ([line 36](../../subgraphs/shared/src/price/PriceHandlerCustomMapping.ts#L36)).
- `getTokens()`: returns `this.mappedTokenAddresses` ([line 40](../../subgraphs/shared/src/price/PriceHandlerCustomMapping.ts#L40)).
- `getPrice()`: calls `priceLookup(this.tokenAddress, block, null)` — passes `null` for `currentPool` so the full handler list is used for the reference token lookup ([line 44](../../subgraphs/shared/src/price/PriceHandlerCustomMapping.ts#L44)).
- `getTotalValue()`, `getUnitPrice()`, `getBalance()`: return `BigDecimal.zero()` (marked as `// TODO implement`).
- `getUnderlyingTokenBalance()`: throws "Method not implemented."

**Difference from `PriceHandlerRemapping`:** Remapping maps one asset to one destination, passing `this.getId()` as `currentPool` to the sub-lookup. CustomMapping maps many assets to one token, passing `null` as `currentPool`.

### 7.4 `PriceHandlerERC4626`

File: [`src/price/PriceHandlerERC4626.ts`](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts)

Constructor: `(vaultAddress: string, assetAddress: string, contractLookup: ContractNameLookup)`

Prices ERC-4626 vault share tokens.

- `getId()`: returns `this.vaultAddress` ([line 23](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts#L23)).
- `getTokens()`: returns `[this.vaultAddress, this.assetAddress]` ([line 54](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts#L54)).
- `matches()`: only matches `this.vaultAddress` ([line 49](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts#L49)) — will not price the underlying asset directly.
- `getPrice()` math ([line 83](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts#L83)):
  1. Look up asset price via `priceLookup(this.assetAddress, block, this.getId())`.
  2. Call `vault.convertToAssets(10^decimals)` to get "shares to underlying" ratio.
  3. `sharePrice = assetPrice * sharesToUnderlying`.
  4. Returns `liquidity: BigDecimal(U64.MAX_VALUE)` to ensure this handler always wins on liquidity comparison ([line 100](../../subgraphs/shared/src/price/PriceHandlerERC4626.ts#L100)).
- `exists()`: checks `vault.try_decimals()` reverts at block 0.
- `getBalance()`: returns `toDecimal(vault.balanceOf(walletAddress), vault.decimals())`.
- `getTotalValue()`, `getUnitPrice()`, `getUnderlyingTokenBalance()`: all `throw`.

### 7.5 `PriceHandlerBalancer`

File: [`src/price/PriceHandlerBalancer.ts`](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts)

Constructor: `(tokens: string[], vaultAddress: string, poolId: string, contractLookup: ContractNameLookup)`

Note: imports `getContractName` from `../../../ethereum/src/utils/Constants` ([line 3](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L3)) — a tight coupling to the Ethereum chain subgraph that will need to be resolved during migration.

- `getId()`: returns `this.poolId` ([line 80](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L80)).
- `getPrice()` math ([line 92](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L92)): weighted-pool price formula. Reads `BalancerVault.getPoolTokens(poolId)` for on-chain reserves and `BalancerPoolToken.getNormalizedWeights()` for weights. For the lookup token (the one being priced) and the first secondary token for which a price can be obtained:
  ```
  rate = (secondaryReserves / secondaryWeight) / (lookupReserves / lookupWeight) * secondaryPrice
  ```
  Returns `liquidity: BigDecimal.zero()` (TODO). Returns `null` if either token is not found or secondary reserves are zero.
- `getTotalValue()` ([line 221](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L221)): sums `balance * rate` for each token in the pool (reads from `getPoolTokens`), calling `priceLookup` with `currentPool = null` for each token. Excludes tokens in `excludedTokens`. Returns `null` if any token has no price.
- `getUnitPrice()` ([line 281](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L281)): `getTotalValue([]) / poolToken.totalSupply()`.
- `getBalance()` ([line 314](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L314)): uses `BalancerPoolToken.try_balanceOf(walletAddress)`.
- `getUnderlyingTokenBalance()` ([line 359](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L359)): `(walletLpBalance / totalSupply) * tokenReserves`. Reads reserves via `getPoolTokens`.
- `exists()`: checks `vault.try_getPoolTokens(poolId)` reverts at block 0.

**RPC calls per invocation:** `getPoolTokens` (2x: once in `getPrice`/`getTotalValue` and once for `getTokenReserves`), `getPool` (1x for pool token address), `getNormalizedWeights` (1x for weights), `balanceOf` for each token in pool. This is the most RPC-heavy handler.

### 7.6 `PriceHandlerUniswapV2`

File: [`src/price/PriceHandlerUniswapV2.ts`](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts)

Constructor: `(tokens: string[], poolAddress: string, contractLookup: ContractNameLookup)`

- `getId()`: returns `this.poolAddress` ([line 24](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L24)).
- `getPrice()` math ([line 56](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L56)): constant-product price formula:
  ```
  price(B) = (reserves(A) / reserves(B)) * price(A)
  ```
  Reads `pair.getReserves()`, identifies `token0`/`token1` orientation, looks up secondary token price via `priceLookup(secondaryToken, block, this.getId())`. Returns `liquidity: BigDecimal.zero()` (TODO).
- `getTotalValue()`: reads reserves from `pair.getReserves()`, calls `priceLookup` with `currentPool = null` for each token.
- `getUnitPrice()`: `getTotalValue([]) / pair.totalSupply()`.
- `getBalance()`: `pair.try_balanceOf(walletAddress)`.
- `getUnderlyingTokenBalance()` ([line 246](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L246)): `(walletBalance / totalSupply) * tokenReserves`.
- `exists()`: checks `pair.try_token0()` and `pair.try_token1()` revert.

**RPC calls per `getPrice`:** `token0`, `token1`, `getReserves` on pair; `decimals` on each token; `priceLookup` for secondary token.

### 7.7 `PriceHandlerUniswapV3`

File: [`src/price/PriceHandlerUniswapV3.ts`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts)

Constructor: `(tokens: string[], poolAddress: string, positionManager: string, contractLookup: ContractNameLookup)`

Uses `Q96 = 2^96` as a constant ([line 13](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L13)).

- `getId()`: returns `this.poolAddress`.
- `getPrice()` math ([line 77](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L77)): derives spot price from `slot0.sqrtPriceX96`:
  ```
  priceETH = (sqrtPriceX96 ^ 2) / 2^192
  ```
  Then adjusts for decimal difference between token0 and token1 (handles 9-decimal OHM vs 18-decimal ETH case at [line 129](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L129)). Computes `liquidityDepth = otherTokenPrice * otherTokenBalance` (where balance is read from `ERC20.balanceOf(poolAddress)`) and returns it as the `liquidity` field.
- `getTotalValue()` ([line 173](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L173)): reads balances via `ERC20.try_balanceOf(poolAddress)` for both tokens (not via `slot0`). Returns `null` if either reverts.
- `getUnitPrice()` ([line 233](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L233)): returns `getTotalValue([])` directly (no total supply on V3; one unit = the whole pool's value).
- `getBalance()` ([line 238](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L238)): returns `BigDecimal.zero()` with a TODO comment — V3 positions are NFTs, not fungible LP tokens.
- `getUnderlyingTokenBalance()` ([line 336](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L336)): iterates all NFT position IDs held by `walletAddress` via `positionManager.tokenOfOwnerByIndex`, then for each position calls `getPairBalances(positionId, block)` which computes concentrated-liquidity math:
  - Uses `sqrtRatioA = sqrt(1.0001^tickLower)` and `sqrtRatioB = sqrt(1.0001^tickUpper)`.
  - Computes `token0Amount` and `token1Amount` based on current tick vs range using the standard Uniswap V3 liquidity math ([line 316](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L316)).
  - `getSqrtRatioAtTick` ([line 255](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L255)) uses `BigInt.fromU64(u64(sqrt(1.0001 ** tick)))` — an approximation via floating-point `Math.sqrt` and `u64` truncation. This is a precision risk for TypeScript porting.
- `exists()`: checks `try_token0()` and `try_token1()` revert.

### 7.8 `PriceHandlerUniswapV3Quoter`

File: [`src/price/PriceHandlerUniswapV3Quoter.ts`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts)

Constructor: `(tokens: string[], quoter: string, poolAddress: string, contractLookup: ContractNameLookup)`

Alternative V3 pricing using the Quoter contract (an on-chain simulation of a swap). Used for pools where the slot0 sqrt-price math is not accurate enough or the pool is non-standard.

- `getId()`: returns `this.poolAddress`.
- `getPrice()` ([line 59](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L59)): calls `UniswapV3Quoter.try_quoteExactInputSingle` with `amountIn = 10^desiredTokenDecimals` (1 token), with `sqrtPriceLimitX96 = 0` (no limit). Returns `null` on revert. Computes `desiredTokenPrice = quoteOutput * otherTokenPrice`. Also computes `liquidityDepth = otherTokenPrice * ERC20.balanceOf(poolAddress)` for the other token.
- `getTotalValue()`, `getUnitPrice()`: return `null`.
- `getBalance()`, `getUnderlyingTokenBalance()`: return `BigDecimal.zero()`.

**Important:** `quoteExactInputSingle` is a state-mutating simulation — in the legacy Graph runtime it is called as a `try_` to avoid reverting the entire block handler. In an Envio context this would require an RPC call that may fail or return stale data at historical blocks.

**Note on missing handlers in shared/:**

Chainlink, Curve, FraxSwap, and Boosted Liquidity handlers are **not in shared/** — they live in chain-specific subgraphs:

- Chainlink: `subgraphs/arbitrum/src/price/PriceChainlink.ts`, `subgraphs/base/...`, `subgraphs/berachain/...`, `subgraphs/ethereum/src/utils/PriceChainlink.ts`
- Curve: `subgraphs/ethereum/src/liquidity/LiquidityCurve.ts`
- FraxSwap: `subgraphs/ethereum/src/liquidity/LiquidityFraxSwap.ts`
- Boosted Liquidity: `subgraphs/ethereum/` (OlympusBoostedLiquidityVaultLido)

These will be inventoried separately in chain-specific inventory files.

---

## 8. Supply Helpers

### `src/supply/OhmCalculations.ts`

File: [`src/supply/OhmCalculations.ts`](../../subgraphs/shared/src/supply/OhmCalculations.ts)

**`getCurrentIndex(blockNumber: BigInt): BigDecimal`** ([line 18](../../subgraphs/shared/src/supply/OhmCalculations.ts#L18)):

Returns the Olympus staking index (used to derive gOHM value from OHM amount).

Selection logic:
- If `blockNumber > BigInt.fromString("13806000")` (= `ERC20_SOHM_V3_BLOCK`): calls `sOlympusERC20V3.index()` on address `ERC20_SOHM_V3`, converts with `toDecimal(..., 9)`.
- Otherwise: calls `sOlympusERC20V2.index()` on address `ERC20_SOHM_V2`, converts with `toDecimal(..., 9)`.

Both `index()` calls are un-guarded (no `try_index()`), so a revert will crash. The comment at [line 27](../../subgraphs/shared/src/supply/OhmCalculations.ts#L27) notes that sOHM V1 (before block 12622596) has no `index()` function — the subgraph's practical start block (>14M) means this is not currently reached, but is a porting risk if start block is moved earlier.

### `src/utils/TokenSupplyHelper.ts`

File: [`src/utils/TokenSupplyHelper.ts`](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts)

**Type string constants** ([line 6](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts#L6)):

| Constant | Value |
|---|---|
| `TYPE_BONDS_DEPOSITS` | `"OHM Bonds (Burnable Deposits)"` |
| `TYPE_BONDS_PREMINTED` | `"OHM Bonds (Pre-minted)"` |
| `TYPE_BONDS_VESTING_DEPOSITS` | `"OHM Bonds (Vesting Deposits)"` |
| `TYPE_BONDS_VESTING_TOKENS` | `"OHM Bonds (Vesting Tokens)"` |
| `TYPE_BOOSTED_LIQUIDITY_VAULT` | `"Boosted Liquidity Vault"` |
| `TYPE_LENDING` | `"Lending"` |
| `TYPE_LIQUIDITY` | `"Liquidity"` |
| `TYPE_OFFSET` | `"Manual Offset"` |
| `TYPE_TOTAL_SUPPLY` | `"Total Supply"` |
| `TYPE_TREASURY` | `"Treasury"` |

**`createTokenSupply`** ([line 24](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts#L24)):

```ts
export function createTokenSupply(
  timestamp: BigInt,
  tokenName: string,
  tokenAddress: string,
  poolName: string | null,
  poolAddress: string | null,
  sourceName: string | null,
  sourceAddress: string | null,
  type: string,
  balance: BigDecimal,
  blockNumber: BigInt,
  multiplier: i32 = 1,
): TokenSupply
```

ID scheme ([line 44](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts#L44)): `YYYY-MM-DD / blockNumber / tokenName / type / poolName / sourceName` concatenated as `Bytes`. Calls `record.save()` before returning.

Key fields:
- `record.balance = balance`
- `record.supplyBalance = balance * multiplier` ([line 63](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts#L63)) — `multiplier` is `i32`, default 1. Used with value `-1` for liabilities/burns.

---

## 9. Math / Utils

### `src/utils/Decimals.ts`

File: [`src/utils/Decimals.ts`](../../subgraphs/shared/src/utils/Decimals.ts)

| Export | Signature | Notes |
|---|---|---|
| `DEFAULT_DECIMALS` | `= 18` | Used when no decimals param is passed |
| `pow(base, exponent)` | `(BigDecimal, number) => BigDecimal` | Manual iterative power; returns `1` for exponent 0. **Not** used internally — `toDecimal` uses `BigInt.pow` directly. |
| `toDecimal(value, decimals?)` | `(BigInt, number = 18) => BigDecimal` | `value.divDecimal(BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal())`. The `<u8>` cast truncates decimals > 255, but no contract has that many. |
| `toBigInt(value, decimals?)` | `(BigDecimal, number = 18) => BigInt` | `BigInt.fromString(value.times(10^decimals).toString())`. **Precision risk:** `BigDecimal.toString()` in AssemblyScript may use scientific notation or truncate; `BigInt.fromString` of a decimal string will fail if it contains a decimal point or exponent. |

**Critical precision note on `toBigInt`** ([line 47](../../subgraphs/shared/src/utils/Decimals.ts#L47)): this function multiplies then calls `BigInt.fromString(value.times(multiplier).toString())`. In AssemblyScript's BigDecimal, `toString()` on an integer-valued BigDecimal returns a plain integer string (e.g. `"1000000000000000000"`). In TypeScript / native JS BigDecimal equivalents, this may produce scientific notation (e.g. `"1e18"`) which `BigInt.fromString` cannot parse. This is the most significant numerical precision risk for the Envio port.

### `src/utils/ArrayHelper.ts`

File: [`src/utils/ArrayHelper.ts`](../../subgraphs/shared/src/utils/ArrayHelper.ts)

| Export | Signature | Notes |
|---|---|---|
| `arrayIncludesLoose` | `(array: string[], value: string) => boolean` | Case-insensitive linear search. Used everywhere token addresses are compared in arrays. Cannot use `Array.includes()` due to AssemblyScript strict equality semantics on strings ([comment at line 13](../../subgraphs/shared/src/utils/ArrayHelper.ts#L13)). |
| `pushTokenRecordArray` | `(dest: TokenRecord[], src: TokenRecord[]) => void` | Manual loop push (no `Array.concat`). |
| `pushTokenSupplyArray` | `(dest: TokenSupply[], src: TokenSupply[]) => void` | Same pattern. |

### `src/utils/StringHelper.ts`

File: [`src/utils/StringHelper.ts`](../../subgraphs/shared/src/utils/StringHelper.ts)

**`addressesEqual(one, two)`** ([line 8](../../subgraphs/shared/src/utils/StringHelper.ts#L8)): `one.toLowerCase() == two.toLowerCase()`. The comment references [AssemblyScript issue #621](https://github.com/AssemblyScript/assemblyscript/issues/621) — in AssemblyScript, `==` is pointer equality for strings unless they are interned, so `.toLowerCase() == .toLowerCase()` forces comparison of freshly-created lowercase strings which are value-equal by the runtime's equality contract. In TypeScript, `===` on strings is always value equality, so this function is safe to port directly.

### `src/utils/DateHelper.ts`

File: [`src/utils/DateHelper.ts`](../../subgraphs/shared/src/utils/DateHelper.ts)

| Export | Notes |
|---|---|
| `getISO8601DateString(date: Date)` | `date.toISOString().split("T")[0]` — returns `YYYY-MM-DD` |
| `getISO8601DateStringFromTimestamp(timestamp: BigInt)` | Converts `timestamp.toI64() * 1000` to `Date`, then calls above. |
| `getISO8601StringFromTimestamp(timestamp: BigInt)` | Full ISO string (includes time). |
| `getDateFromBlockTimestamp(timestamp: BigInt)` | Returns `Date`. |
| `addDays(date: Date, days: u64)` | Returns new `Date` offset by `days * 86400000 ms`. |

**Note:** `u64` type for `addDays` parameter is AssemblyScript-specific. In TypeScript this would be `number` or `bigint`.

### `src/utils/TokenRecordHelper.ts`

File: [`src/utils/TokenRecordHelper.ts`](../../subgraphs/shared/src/utils/TokenRecordHelper.ts)

**`createTokenRecord`** ([line 122](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L122)): central factory for all `TokenRecord` entities.

ID scheme ([line 139](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L139)): `Bytes.fromUTF8(dateString).concatI32(blockNumber.toI32()).concat(Bytes.fromUTF8(sourceName)).concat(Bytes.fromUTF8(tokenName))`.

**Value computation** ([line 164](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L164)):
- `value = balance * rate` (always positive unless liability)
- `valueExcludingOhm = balance * rate * multiplier`
- For liabilities: both are negated (multiplied by `-1`).

**Multiplier resolution** (`getTokenMultiplier` at [line 79](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L79)): precedence is (1) explicit `nonOhmMultiplier` parameter > (2) `TokenDefinition.getLiquidBackingMultiplier()` > (3) `BigDecimal.fromString("1")`.

**Other exports:**

| Export | Purpose |
|---|---|
| `getTokenCategory` | Looks up category from `tokenDefinitions` map; returns `"Unknown"` if not found |
| `getIsTokenVolatileBluechip` | Looks up `isVolatileBluechip`; returns `false` if not found |
| `getIsTokenLiquid` | Looks up `isLiquid`; returns `true` (not `false`) if not found — important default |
| `getIsLiability` | Looks up `isLiability`; returns `false` if not found |
| `getTokenRecordValue` | `record.balance * record.rate * (nonOhmMultiplier ? record.multiplier : 1)` |
| `getTokensInCategory` | Filters `tokenDefinitions.values()` by category (manual loop, no closure) |
| `getTokenAddressesInCategory` | Maps result of above to address strings |
| `isTokenAddressInCategory` | Checks membership via `getTokenAddressesInCategory(...).includes(...)` |

### `src/utils/TokenNative.ts`

File: [`src/utils/TokenNative.ts`](../../subgraphs/shared/src/utils/TokenNative.ts)

**`getNativeTokenBalances`** ([line 17](../../subgraphs/shared/src/utils/TokenNative.ts#L17)):

```ts
export function getNativeTokenBalances(
  timestamp: BigInt,
  blockNumber: BigInt,
  blockchain: string,
  wallets: string[],
  priceLookup: GetPrice,
  getContractName: ContractNameLookup,
): TokenRecord[]
```

Uses `ethereum.getBalance(Address.fromString(wallet))` (Graph TS built-in) to read native balances. Addresses native tokens by the zero address (`Address.zero().toHexString().toLowerCase()`). Calls `getTokensForChain(blockchain)` for token definitions. Creates `TokenRecord` via `createTokenRecord` with `isLiquid = true`.

**`GetPrice` type alias** ([line 9](../../subgraphs/shared/src/utils/TokenNative.ts#L9)):

```ts
export type GetPrice = (tokenAddress: string, blockNumber: BigInt) => BigDecimal;
```

Note this type does NOT include the `currentPool` parameter that `PriceLookup` has — it is a simplified wrapper for native token pricing.

**Porting note:** `ethereum.getBalance` is a Graph-specific API. In Envio, native balances require an explicit `eth_getBalance` RPC call — see inherited TODO #2 in `docs/envio-migration/inherited-todos.md`.

### `src/utils/TokensForChain.ts`

File: [`src/utils/TokensForChain.ts`](../../subgraphs/shared/src/utils/TokensForChain.ts)

**`getTokensForChain(blockchain: string): Map<string, TokenDefinition>`** ([line 15](../../subgraphs/shared/src/utils/TokensForChain.ts#L15)):

Routes to each chain's `ERC20_TOKENS` map by string match: `"Ethereum"`, `"Polygon"`, `"Base"`, `"Arbitrum"`, `"Berachain"`, `"Fantom"`. Returns an empty map for unknown chains.

**Tight coupling:** directly imports from all six chain subgraph `Constants` files, so `shared/` depends on chain subgraphs at build time. This creates a circular dependency risk; in Envio the chain-specific token registries should be passed in rather than imported.

### `src/utils/LendingMarketDeployment.ts`

File: [`src/utils/LendingMarketDeployment.ts`](../../subgraphs/shared/src/utils/LendingMarketDeployment.ts)

Simple data class holding `(token: string, blockNumber: BigInt, amount: BigDecimal, address: string)` with getters. Used by chain subgraphs (e.g. Arbitrum) to represent hard-coded lending market deployed amounts for protocols like Myso and Vendor Finance that do not emit trackable events.

---

## 10. Tests in Tree

All tests use `matchstick-as` (Graph's AssemblyScript test framework), NOT Vitest.

| File | Summary |
|---|---|
| [`tests/price/PriceRouter.test.ts`](../../subgraphs/shared/tests/price/PriceRouter.test.ts) | 4 tests for `getUSDRate`: no handlers returns null; single handler returns its price; multiple handlers choose highest liquidity; `currentPool` guard prevents infinite loop when a handler's id matches `currentPool`. |
| [`tests/price/PriceHandlerBalancer.test.ts`](../../subgraphs/shared/tests/price/PriceHandlerBalancer.test.ts) | Tests `getPrice` (OHM and ETH lookups in OHM-DAI-ETH 3-pool), `getTotalValue` (with and without OHM exclusion), `getUnitPrice`, and `getUnderlyingTokenBalance`. Uses real Balancer vault math. |
| [`tests/price/PriceHandlerCustomMapping.test.ts`](../../subgraphs/shared/tests/price/PriceHandlerCustomMapping.test.ts) | 1 test: confirms `getPrice` for `sKLIMA` returns the price of `KLIMA` via the `priceLookup` callback. |
| [`tests/price/PriceHandlerERC4626.test.ts`](../../subgraphs/shared/tests/price/PriceHandlerERC4626.test.ts) | 1 test: confirms `getPrice` for `sUSDS` vault returns `asset_price * convertToAssets(1e18)` (i.e. 1.04 USD given 1 USD asset price and 1.04 conversion ratio). |
| [`tests/price/PriceHandlerUniswapV2.test.ts`](../../subgraphs/shared/tests/price/PriceHandlerUniswapV2.test.ts) | Tests `getPrice` (normal and flipped token orientation), `getTotalValue` (with and without OHM exclusion), `getUnitPrice`, and `getUnderlyingTokenBalance` (including revert-returns-zero case). |
| [`tests/price/PriceHandlerUniswapV3.test.ts`](../../subgraphs/shared/tests/price/PriceHandlerUniswapV3.test.ts) | Tests `getPrice` (FPIS-FRAX sqrtPriceX96 → USD rate), `getTotalValue` (with and without exclusion), `getUnitPrice` (equals total value for V3), `getUnderlyingTokenBalance` for two pools (OHM-WETH with wide range, OHM-USDC with one-sided range). |
| [`tests/ERC20Helper.ts`](../../subgraphs/shared/tests/ERC20Helper.ts) | Test utility only (not a test file itself): `mockERC20Balance` and `mockERC20Balances` helper functions using `createMockedFunction` from matchstick-as. Imported by Balancer and UniswapV2 tests. |

---

## 11. Open Questions for New Envio Implementation

1. **`toBigInt` precision** ([`src/utils/Decimals.ts:47`](../../subgraphs/shared/src/utils/Decimals.ts#L47)): In AssemblyScript, `BigDecimal.toString()` on an integer-valued result produces a plain integer string. TypeScript libraries like `ethers.js` `BigNumber`, `viem`'s `parseUnits`, or `@ethersproject/bignumber` may produce scientific notation from `toString()`. Porting `toBigInt` requires replacing `BigInt.fromString(value.times(multiplier).toString())` with an equivalent that handles scientific notation or using a purpose-built unit conversion utility (e.g. `parseUnits`).

2. **`getDecimals` has no revert guard** ([`src/contracts/ERC20.ts:15`](../../subgraphs/shared/src/contracts/ERC20.ts#L15)): the legacy code calls `contract.decimals()` directly. In the Graph runtime an unreachable or non-conformant contract causes the block handler to fail and retry. In Envio's TypeScript runtime, an RPC call for `decimals()` that errors will throw. Envio handlers must wrap with try/catch or use `readContract` with error handling. Contracts that do not implement `decimals()` (e.g. some early ERC20s) will require a fallback to `DEFAULT_DECIMALS = 18`.

3. **UniswapV3 tick math uses floating-point** ([`src/price/PriceHandlerUniswapV3.ts:256`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L256)): `getSqrtRatioAtTick` uses `BigInt.fromU64(u64(sqrt(1.0001 ** tick)))` — a float64 approximation. The legacy test passes for the OHM-WETH full-range case but may diverge for concentrated positions near the boundaries. The proper Envio implementation should use the exact integer Uniswap V3 tick math (`getSqrtRatioAtTick` from `@uniswap/v3-sdk` or equivalent) to ensure parity with the legacy results.

4. **`PriceHandlerBalancer` imports from Ethereum chain** ([`src/price/PriceHandlerBalancer.ts:3`](../../subgraphs/shared/src/price/PriceHandlerBalancer.ts#L3)): the import `import { getContractName } from "../../../ethereum/src/utils/Constants"` creates a build-time dependency of `shared/` on `ethereum/`. This is a circular library concern. In the Envio port, the `contractLookup: ContractNameLookup` parameter (already threaded through the constructor) should be used for all name lookups, and the hard-coded import should be removed.

5. **`TokensForChain.ts` reverse-imports from all chains** ([`src/utils/TokensForChain.ts:1-6`](../../subgraphs/shared/src/utils/TokensForChain.ts#L1)): the shared library imports `ERC20_TOKENS_*` from each chain subgraph, creating a build-time dependency from `shared/` → all six chains. This cannot be replicated in a clean multi-package Envio setup. The Envio equivalent should invert the dependency: each chain handler constructs its own `tokenDefinitions` map and passes it into shared utilities, rather than `shared/` knowing about all chains.

6. **`ethereum.getBalance` for native balances** ([`src/utils/TokenNative.ts:33`](../../subgraphs/shared/src/utils/TokenNative.ts#L33)): `ethereum.getBalance` is a Graph-specific API with no Envio equivalent in the current event-driven model. Porting requires an explicit RPC call (`eth_getBalance`) per wallet address per snapshot, which must be bounded and cached. See inherited TODO #2 in [`docs/envio-migration/inherited-todos.md`](inherited-todos.md).

7. **`Array.concat` and closure restrictions** ([`src/utils/ArrayHelper.ts:13`](../../subgraphs/shared/src/utils/ArrayHelper.ts#L13), [`src/price/PriceRouter.ts:8`](../../subgraphs/shared/src/price/PriceRouter.ts#L8)): multiple places use manual loops instead of `Array.sort()`, `Array.includes()`, or `Array.map()` with closures because AssemblyScript does not support closures. The ported TypeScript code should replace these with standard Array methods, verifying semantics (e.g. `Array.includes` uses `===` on strings, which is correct in TypeScript; `Array.sort` is stable in modern V8 but the custom bubble sort sorts by lowercase which differs from the default locale sort).

8. **`createTokenRecord` and `createTokenSupply` call `record.save()`** ([`src/utils/TokenRecordHelper.ts:179`](../../subgraphs/shared/src/utils/TokenRecordHelper.ts#L179), [`src/utils/TokenSupplyHelper.ts:65`](../../subgraphs/shared/src/utils/TokenSupplyHelper.ts#L65)): in the Graph model, `.save()` writes to the store. In Envio, entities are written via `context.TokenRecord.set(record)`. The porting pattern is to replace `record.save()` with `context.TokenRecord.set(record)` and thread `context` through all callers — a pervasive refactor since `createTokenRecord` and `createTokenSupply` are called from dozens of chain-specific handlers.

9. **`hasSameTokenSet` cycle guard is token-set–level, not pool-level** ([`src/price/PriceRouter.ts:34`](../../subgraphs/shared/src/price/PriceRouter.ts#L34)): two handlers covering the same tokens (e.g. two OHM-WETH V3 pools) will both be skipped when either is the `currentPool`. This means if the "reference" pool for pricing OHM is also an OHM-WETH pool, all OHM-WETH pools will be excluded from sub-lookups, potentially causing a null price for WETH when pricing OHM. The Envio implementation must preserve this exact logic — changing it will alter which tokens can serve as pricing anchors.

10. **`PriceHandlerUniswapV3Quoter` uses a stateful simulation call** ([`src/price/PriceHandlerUniswapV3Quoter.ts:110`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L110)): `quoter.try_quoteExactInputSingle` simulates a swap and is stateful (reads pool state at the current block). In Envio, this is a standard `eth_call` at a specific block number, which is correct. However, the Quoter v2 ABI (`quoteExactInputSingle` with struct input at [line 103](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L103)) must be verified against the deployed Quoter version on each chain — Quoter v1 and v2 have different ABIs.
