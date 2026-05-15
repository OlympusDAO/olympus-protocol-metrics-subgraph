# Berachain Subgraph Behavioral Inventory

## 1. Manifest Summary

Source: [`subgraph.yaml`](../../subgraphs/berachain/subgraph.yaml)

| Field | Value |
|---|---|
| Network name | `berachain` |
| specVersion | `0.0.8` |
| Grafting enabled | Yes — base `QmUboX4f6C2Hb5mZT88NcFg32rXkci6SVAj4qkpgKLHz4V` (v1.3.2) grafted at block `2735780` (Infrared vault deployment) |
| Schema | `../../schema.graphql` (shared) |
| Subgraph version | `1.3.6` (from [`config.json`](../../subgraphs/berachain/config.json)) |

**Data sources:**

| Name | Kind | Address | ABI | Start block | Note |
|---|---|---|---|---|---|
| `TokenRecords-berachain` | `ethereum/contract` | `0x18878Df23e2a36f81e820e4b47b4A40576D3159C` (OHM) | ERC20 | `780014` | OHM deployment |

**Entities written:** `TokenRecord`, `TokenSupply`

**ABIs used (in mapping):**
- `ERC20` (shared)
- `UniswapV3Quoter` (shared)
- `KodiakIsland` (berachain-local: [`abis/KodiakIsland.json`](../../subgraphs/berachain/abis/KodiakIsland.json))
- `BeradromeKodiakIslandRewardVault` (berachain-local: [`abis/BeradromeKodiakIslandRewardVault.json`](../../subgraphs/berachain/abis/BeradromeKodiakIslandRewardVault.json))
- `UniswapV2Pair`, `UniswapV3Pair`, `UniswapV3PositionManager`, `ChainlinkPriceFeed`, `BalancerVault`, `BalancerPoolToken` (all shared)

**Handler entry points:**

| Type | Handler function | File | Trigger |
|---|---|---|---|
| Block handler (polling) | `handleBlock` | [`src/treasury/Assets.ts`](../../subgraphs/berachain/src/treasury/Assets.ts) | Every `7200` blocks (~4 hours at 0.5 blocks/sec) |

There are no event handlers — all indexing is block-poll driven.

---

## 2. Tokens

Sources: [`src/contracts/Constants.ts`](../../subgraphs/berachain/src/contracts/Constants.ts)

| Symbol | Address | Category | Decimals source | Liquid? | Notes |
|---|---|---|---|---|---|
| OHM | `0x18878df23e2a36f81e820e4b47b4a40576d3159c` | N/A (supply accounting only) | `ERC20.try_decimals()` | — | Used only for `TokenSupply`; not in `ERC20_TOKENS_BERACHAIN` map |
| HONEY | `0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce` | Stable | `ERC20.decimals()` at call time | Yes | Chainlink price feed (Redstone USDC proxy) |
| USDC.e (Stargate) | `0x549943e04f40284185054145c6e4e9568c1d3241` | Stable | `ERC20.decimals()` at call time | Yes | Same Redstone USDC feed as HONEY |
| wBERA | `0x6969696969696969696969696969696969696969` | Volatile | `ERC20.decimals()` at call time | Yes | Base token; price via WBERA-HONEY UniV3 pool |
| BERA (native) | `0x0000000000000000000000000000000000000000` | Volatile | hardcoded 18 (via `ethereum.getBalance`) | Yes | Remapped to wBERA for price; balance via `ethereum.getBalance` |
| iBERA | `0x9b6761bf2397bb5a6624a856cc84a3a14dcd3fe5` | Volatile | `ERC20.decimals()` at call time | No (illiquid) | Price via iBERA-wBERA Kodiak pools |
| iBGT | `0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b` | Volatile | `ERC20.decimals()` at call time | No (illiquid) | Price via iBGT-wBERA Kodiak pool |
| lBGT | `0xbaadcc2962417c01af99fb2b7c75706b9bd6babe` | Volatile | `ERC20.decimals()` at call time | No (illiquid) | Price via lBGT-wBERA Balancer (BEX) pool |
| Kodiak OHM-HONEY LP | `0x98bdeede9a45c28d229285d9d6e9139e9f505391` | POL | `KodiakIsland.decimals()` | Yes | Underlying pool for all OHM-HONEY POL handlers |
| Beradrome Kodiak OHM-HONEY LP | `0x555bad9ec18db19ded0057d2517242399d1c5d87` | POL | `KodiakIsland.decimals()` | Yes | Receipt token for Beradrome reward vault positions |
| Infrared Kodiak OHM-HONEY Vault | `0xa57cb177beebc35a1a26a286951a306d9b752524` | POL | `KodiakIsland.decimals()` | Yes | Infrared vault; `rewardVaultToken == rewardVault` |
| BeraHub Kodiak OHM-HONEY Vault | `0x815596fa7c4d983d1ca5304e5b48978424c1b448` | POL | `KodiakIsland.decimals()` | Yes | BeraHub vault; `rewardVaultToken == rewardVault` |

**Native BERA handling:**
- `NATIVE_BERA` is `Address.zero().toHexString()` = `0x0000000000000000000000000000000000000000` ([Constants.ts:18](../../subgraphs/berachain/src/contracts/Constants.ts#L18))
- In `getTokenBalances`, when iterating the Volatile category, if the token address matches `NATIVE_BERA`, the code branches to `getNativeTokenBalances` (shared helper) which calls `ethereum.getBalance(walletAddress)` rather than `ERC20.balanceOf` ([TokenBalances.ts:71-72](../../subgraphs/berachain/src/treasury/TokenBalances.ts#L71))
- Price for native BERA is obtained by the `PriceHandlerRemapping(NATIVE_BERA, ERC20_WBERA)` entry, which delegates the lookup to the wBERA price handler ([LiquidityConstants.ts:30](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts#L30))
- BGT (`0x656b95e550c07a9ffe548bd4085c72418ceb1dba`) is named in `CONTRACT_NAME_MAP` but **not** in `ERC20_TOKENS_BERACHAIN` and is never directly balanced or priced

---

## 3. Wallets

Source: [`src/contracts/Constants.ts`](../../subgraphs/berachain/src/contracts/Constants.ts)

`PROTOCOL_ADDRESSES` array order ([Constants.ts:59-65](../../subgraphs/berachain/src/contracts/Constants.ts#L59)):

| Name | Address | Role | OHM blacklisted? |
|---|---|---|---|
| DAO MS (Berachain) | `0x91494d1bc2286343d51c55e46ae80c9356d099b5` | Primary DAO multisig | Yes (excluded from OHM treasury balance) |
| TRSRY Module | `0xb1fa0ac44d399b778b14af0aaf4bcf8af3437ad1` | On-chain treasury module | Yes (excluded from OHM treasury balance) |
| DAO Operations MS | `0xe22b2d431838528bcad52d11c4744efcdc907a1c` | Operations multisig | Yes (excluded from OHM treasury balance) |
| THJ Custodian | `0x082689241b09c600b3eaf3812b1d09791e7ded5a` | Third-party custodian | No |
| Infrared Custodian | `0xb65e74f6b2c0633e30ba1be75db818bb9522a81a` | Infrared vault custodian | No |

**OHM treasury blacklist:** `DAO_MULTISIG`, `DAO_OPS_MULTISIG`, and `TRSRY` are excluded when building `getTreasuryOHMRecords` (i.e., when iterating balances of the OHM token for `TYPE_TREASURY` supply records). The function `getWalletAddressesForContract` implements this via `TREASURY_BLACKLIST` ([Constants.ts:67-105](../../subgraphs/berachain/src/contracts/Constants.ts#L67)). For non-OHM tokens all five wallets are queried.

---

## 4. Price Feeds and Routing

### 4.1 Chainlink / Redstone Feeds

Source: [`src/price/PriceChainlink.ts`](../../subgraphs/berachain/src/price/PriceChainlink.ts)

| Token | Feed address | Note |
|---|---|---|
| HONEY | `0x4bad96dd1c7d541270a0c92e1d4e5f12eeea7a57` | Redstone USDC feed (proxy for HONEY ≈ USDC 1:1) |
| USDC.e (Stargate) | `0x4bad96dd1c7d541270a0c92e1d4e5f12eeea7a57` | Same Redstone USDC feed |

Feed is queried via `ChainlinkPriceFeed.try_decimals()` and `ChainlinkPriceFeed.try_latestAnswer()`. If either call reverts, `null` is returned ([PriceChainlink.ts:34-40](../../subgraphs/berachain/src/price/PriceChainlink.ts#L34)).

There is **no dedicated BERA/USD Chainlink feed**. BERA is priced transitively through wBERA.

### 4.2 Base Tokens

A token is a "base token" if it has an entry in `tokenPriceFeedMap`. Only HONEY and USDC.e qualify ([PriceChainlink.ts:7-9](../../subgraphs/berachain/src/price/PriceChainlink.ts#L7)). `isBaseToken` / `getBaseTokenRate` are checked first in `getPriceRecursive` before delegating to `getUSDRate` ([PriceLookup.ts:29-35](../../subgraphs/berachain/src/price/PriceLookup.ts#L29)).

### 4.3 Recursive Routing Rules

Source: [`src/price/PriceLookup.ts`](../../subgraphs/berachain/src/price/PriceLookup.ts), [`subgraphs/shared/src/price/PriceRouter.ts`](../../subgraphs/shared/src/price/PriceRouter.ts)

1. `getPriceRecursive(token, block, currentPool)` first checks if `token` is a base token → returns Chainlink price with `liquidity = U64.MAX_VALUE` (highest priority).
2. If not, delegates to `getUSDRate(token, PRICE_HANDLERS, getPriceRecursive, block, currentPool)`.
3. `getUSDRate` iterates `PRICE_HANDLERS` in order:
   - Skips any handler whose `getId()` equals `currentPool` (same-handler guard).
   - Skips any handler whose token set (sorted, case-insensitive) equals the current pool handler's token set (same-token-set guard) ([PriceRouter.ts:119](../../subgraphs/shared/src/price/PriceRouter.ts#L119)).
   - Accumulates results and picks the one with the **highest liquidity depth** when multiple handlers match.
4. Each `PriceHandlerUniswapV3Quoter.getPrice` calls `quoter.quoteExactInputSingle` with `sqrtPriceLimitX96 = 0` (no limit) and then calls `priceLookup(otherToken, block, this.getId())` recursively ([PriceHandlerUniswapV3Quoter.ts:136](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L136)).
5. `PriceHandlerKodiakIsland.getPrice` uses the same Kodiak quoter (`KODIAK_QUOTER`) but with `sqrtPriceLimitX96 = 2^96` (max limit) instead of 0 — a Kodiak-specific quirk ([PriceHandlerKodiakIsland.ts:159](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L159)).
6. Liquidity depth for `PriceHandlerUniswapV3Quoter` is `otherTokenPrice * otherTokenBalance` (pool-held balance); for `PriceHandlerKodiakIsland` it is hard-coded to `BigDecimal.zero()` (TODO in code) ([PriceHandlerKodiakIsland.ts:197](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L197)).
7. External `getPrice(token, block)` returns `BigDecimal.zero()` (not an error) if no price is found ([PriceLookup.ts:56-58](../../subgraphs/berachain/src/price/PriceLookup.ts#L56)).

### 4.4 PRICE_HANDLERS Registration Order

Source: [`src/contracts/LiquidityConstants.ts`](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts)

| # | Handler class | Tokens | Pool / quoter address | Notes |
|---|---|---|---|---|
| 1 | `PriceHandlerUniswapV3Quoter` | HONEY, wBERA | LP `0x1127f801cb3ab7bdf8923272949aa7dba94b5805` | WBERA-HONEY pool; primary wBERA price source |
| 2 | `PriceHandlerUniswapV3Quoter` | iBERA, wBERA | LP `0x8dd1c3e5fb96ca0e45fe3c3cc521ad44e12f3e47` | iBERA-wBERA 3000-fee pool |
| 3 | `PriceHandlerUniswapV3Quoter` | iBERA, wBERA | LP `0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f` | iBERA-wBERA 500-fee pool |
| 4 | `PriceHandlerKodiakIsland` | HONEY, OHM | Island `0x98bdeede9a45c28d229285d9d6e9139e9f505391`, no reward vault | Direct Kodiak LP price |
| 5 | `PriceHandlerKodiakIsland` | HONEY, OHM | same island + Beradrome V1 vault | Beradrome V1 wrapper |
| 6 | `PriceHandlerKodiakIsland` | HONEY, OHM | same island + Beradrome V2 vault | Beradrome V2 wrapper |
| 7 | `PriceHandlerKodiakIsland` | HONEY, OHM | same island + BeraHub vault | BeraHub wrapper |
| 8 | `PriceHandlerUniswapV3Quoter` | iBGT, wBERA | LP `0x12bf773f18cec56f14e7cb91d82984ef5a3148ee` | iBGT-wBERA pool |
| 9 | `PriceHandlerRemapping` | NATIVE_BERA → wBERA | — | Native BERA aliased to wBERA price |
| 10 | `PriceHandlerBalancer` | lBGT, wBERA | BEX vault `0x4be03f781c497a489e3cb0287833452ca9b9e80b`, pool ID `0x705fc16ba5a1eb67051934f2fb17eacae660f6c70002000000000000000000d5` | lBGT priced via Balancer BEX |

All `PriceHandlerUniswapV3Quoter` and `PriceHandlerKodiakIsland` handlers share the same `KODIAK_QUOTER` address: `0x644c8d6e501f7c994b74f5cea96abe65d0ba662b` ([LiquidityConstants.ts:9](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts#L9)).

### 4.5 Remapped Tokens

| Asset | Remapped to | Mechanism |
|---|---|---|
| `NATIVE_BERA` (`0x000...0`) | `ERC20_WBERA` | `PriceHandlerRemapping` — delegates `priceLookup(wBERA)` ([LiquidityConstants.ts:30](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts#L30)) |

### 4.6 Same-Token-Set Guard

When pricing a token from inside pool X, `getUSDRate` skips any other handler whose sorted token set exactly matches pool X's token set ([PriceRouter.ts:34-58](../../subgraphs/shared/src/price/PriceRouter.ts#L34)). In practice this prevents the four OHM-HONEY Kodiak handlers (entries 4-7 in PRICE_HANDLERS) from being used to price OHM when OHM's price is being looked up from within one of the other OHM-HONEY handlers. The handlers at positions 4-7 all declare tokens `[HONEY, OHM]` and share the same token set, so they are all skipped as a group whenever the current pool is one of them.

---

## 5. Liquidity Pools / Handlers

### 5.1 OWNED_LIQUIDITY_HANDLERS

Source: [`src/contracts/LiquidityConstants.ts`](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts)

These are the handlers used for both `TokenRecord` (owned liquidity balances) and `TokenSupply` (POL OHM supply):

| Handler name | Island pool | Reward vault | Reward vault token (getId()) | Treasury owned? |
|---|---|---|---|---|
| `kodiakOhmHoney` | `0x98bdeede9a45c28d229285d9d6e9139e9f505391` | none (`null`) | island address | Yes |
| `beradromeKodiakOhmHoneyV1` | same island | `0x017b4dd27782e2fe3421e71f33ce54801af696f8` (Beradrome V1) | `LP_BERADROME_KODIAK_OHM_HONEY` = `0x555bad9ec18db19ded0057d2517242399d1c5d87` | Yes |
| `beradromeKodiakOhmHoneyV2` | same island | `0x8e5b2df607b43c8d0f28035210d4e1ad1e72b8ed` (Beradrome V2) | same LP address | Yes |
| `infraredKodiakOhmHoney` | same island | `0xa57cb177beebc35a1a26a286951a306d9b752524` (Infrared) | same as vault address | Yes |
| `beraHubKodiakOhmHoney` | same island | `0x815596fa7c4d983d1ca5304e5b48978424c1b448` (BeraHub) | same as vault address | Yes |

All five handlers point at the same underlying Kodiak Island pool (`LP_KODIAK_OHM_HONEY`) for reserve and unit price calculations. They differ only in where they read balances from:
- No reward vault → `KodiakIsland.balanceOf(wallet)` ([PriceHandlerKodiakIsland.ts:296](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L296))
- With reward vault → `BeradromeKodiakIslandRewardVault.balanceOf(wallet)` ([PriceHandlerKodiakIsland.ts:293](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L293))

Note: `INFRARED_KODIAK_OHM_HONEY_VAULT` appears in `OWNED_LIQUIDITY_HANDLERS` but **not** in `PRICE_HANDLERS` (it is in `ERC20_TOKENS_BERACHAIN` for balance tracking only).

### 5.2 Pool key methods called on KodiakIsland

- `token0()`, `token1()` — to verify token membership
- `pool()` — to get the underlying UniV3 pool address (for fee lookup)
- `getUnderlyingBalances()` → returns `(amount0Current, amount1Current)` — used for `getTotalValue` and `getUnderlyingTokenBalance`
- `totalSupply()`, `decimals()` — for unit price calculation
- `balanceOf(walletAddress)` — direct balance when no reward vault

### 5.3 UniswapV3 pools (price-only, not owned liquidity)

| Pool | Address | Token pair | Fee tier |
|---|---|---|---|
| WBERA-HONEY | `0x1127f801cb3ab7bdf8923272949aa7dba94b5805` | wBERA / HONEY | 3000 (from `UniswapV3Pair.fee()`) |
| iBERA-wBERA (3000) | `0x8dd1c3e5fb96ca0e45fe3c3cc521ad44e12f3e47` | iBERA / wBERA | 3000 |
| iBERA-wBERA (500) | `0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f` | iBERA / wBERA | 500 |
| iBGT-wBERA | `0x12bf773f18cec56f14e7cb91d82984ef5a3148ee` | iBGT / wBERA | 3000 |

These are queried via `PriceHandlerUniswapV3Quoter`; fee tier is read dynamically from `UniswapV3Pair.fee()`.

### 5.4 Balancer (BEX) pool

| Pool name | Vault address | Pool ID | Tokens |
|---|---|---|---|
| lBGT-wBERA | `0x4be03f781c497a489e3cb0287833452ca9b9e80b` | `0x705fc16ba5a1eb67051934f2fb17eacae660f6c70002000000000000000000d5` | lBGT, wBERA |

Used only for pricing lBGT. The pool token address is `LP_BEX_LBGT_WBERA` = `0x705fc16ba5a1eb67051934f2fb17eacae660f6c7`.

---

## 6. Snapshot Cadence

Source: [`subgraph.yaml`](../../subgraphs/berachain/subgraph.yaml#L48)

The single block handler is configured with `kind: polling` and `every: 7200`. At the chain's nominal block rate of ~0.5 blocks/sec this equates to approximately one snapshot every 4 hours.

There is no event-driven snapshot trigger. All `TokenRecord` and `TokenSupply` entities are generated on every polling invocation, unconditionally ([Assets.ts:58-62](../../subgraphs/berachain/src/treasury/Assets.ts#L58)).

---

## 7. Manual Offsets / Migration / Quirks

1. **Grafting:** The subgraph is grafted from base `QmUboX4f6C2Hb5mZT88NcFg32rXkci6SVAj4qkpgKLHz4V` at block `2735780`. Any Envio migration must account for data continuity from that graft point onward ([subgraph.yaml:6-8](../../subgraphs/berachain/subgraph.yaml#L6)).

2. **LP address collision:** `LP_KODIAK_IBGT_WBERA` and `LP_KODIAK_LBGT_WBERA` are defined with the **same address** `0x12bf773f18cec56f14e7cb91d82984ef5a3148ee` ([Constants.ts:26-27](../../subgraphs/berachain/src/contracts/Constants.ts#L26)). `LP_KODIAK_LBGT_WBERA` is defined but never used in any handler registration — only `LP_KODIAK_IBGT_WBERA` is used. This appears to be a data error.

3. **Kodiak quoter sqrtPriceLimitX96:** `PriceHandlerKodiakIsland` passes `2^96` as the price limit to the quoter ([PriceHandlerKodiakIsland.ts:159](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L159)), while `PriceHandlerUniswapV3Quoter` (shared) passes `0` ([PriceHandlerUniswapV3Quoter.ts:108](../../subgraphs/shared/src/price/PriceHandlerUniswapV3Quoter.ts#L108)). This is a deliberate Kodiak-specific override.

4. **Zero liquidity for Kodiak price results:** `PriceHandlerKodiakIsland.getPrice` returns `liquidity: BigDecimal.zero()` unconditionally, which means Kodiak-sourced prices will always lose a liquidity-based tie-break against UniV3 Quoter results. The code comment marks this as a TODO ([PriceHandlerKodiakIsland.ts:197](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L197)).

5. **OHM blacklist removes three of five wallets for OHM supply:** Only `THJ_CUSTODIAN` and `INFRARED_CUSTODIAN` are included when computing treasury OHM balances; the other three wallets (`DAO_MULTISIG`, `TRSRY`, `DAO_OPS_MULTISIG`) are excluded via `TREASURY_BLACKLIST` ([Constants.ts:67-68](../../subgraphs/berachain/src/contracts/Constants.ts#L67)).

6. **`getOwnedLiquidityBalance` multiplier for non-UniV3 handlers:** For Kodiak Island handlers, the POL multiplier is computed as `includedValue / totalValue` where `includedValue = getTotalValue(OHM_TOKENS)` (OHM excluded from value numerator) and `totalValue = getTotalValue([])`. This multiplier is then applied to the `unitRate * balance` record so OHM's share of the pool is excluded from the market cap ([OwnedLiquidity.ts:119-127](../../subgraphs/berachain/src/treasury/OwnedLiquidity.ts#L119)).

7. **`getOwnedLiquidityBalance` early-exit on zero balance:** Before computing prices or multipliers, the code sums balances across all wallets for a given handler; if the sum is zero, it returns early without any RPC calls ([OwnedLiquidity.ts:109-116](../../subgraphs/berachain/src/treasury/OwnedLiquidity.ts#L109)).

---

## 8. Chain-Specific Protocol Entities

### 8.1 Kodiak Island Reward Vaults

Four distinct reward vault contracts wrap the same underlying Kodiak OHM-HONEY LP:

| Vault name | Vault address | Version / Operator |
|---|---|---|
| Beradrome Kodiak OHM-HONEY V1 | `0x017b4dd27782e2fe3421e71f33ce54801af696f8` | Beradrome (deprecated in favour of V2) |
| Beradrome Kodiak OHM-HONEY V2 | `0x8e5b2df607b43c8d0f28035210d4e1ad1e72b8ed` | Beradrome |
| Infrared Kodiak OHM-HONEY Vault | `0xa57cb177beebc35a1a26a286951a306d9b752524` | Infrared (deployed at graft block 2735780) |
| BeraHub Kodiak OHM-HONEY Vault | `0x815596fa7c4d983d1ca5304e5b48978424c1b448` | BeraHub |

All vaults implement a `balanceOf(address) → uint256` method that returns the staked LP token balance for the given wallet. The ABI used is `BeradromeKodiakIslandRewardVault` which, despite the name, is reused for all four vault types ([PriceHandlerKodiakIsland.ts:58-79](../../subgraphs/berachain/src/price/PriceHandlerKodiakIsland.ts#L58)).

The `getId()` for Beradrome V1 and V2 handlers returns `LP_BERADROME_KODIAK_OHM_HONEY` (the receipt LP token), not the vault address. For Infrared and BeraHub, `getId()` returns the vault address itself (because `rewardVaultToken == rewardVault`) ([LiquidityConstants.ts:15-16](../../subgraphs/berachain/src/contracts/LiquidityConstants.ts#L15)).

### 8.2 BEX (Berachain Native Balancer-fork) Pool

The BEX vault at `0x4be03f781c497a489e3cb0287833452ca9b9e80b` is used for the lBGT-wBERA pool. It is queried through `PriceHandlerBalancer` using the Balancer vault ABI.

### 8.3 BGT Token

BGT (`0x656b95e550c07a9ffe548bd4085c72418ceb1dba`) is named in `CONTRACT_NAME_MAP` ([Constants.ts:111](../../subgraphs/berachain/src/contracts/Constants.ts#L111)) but is not in `ERC20_TOKENS_BERACHAIN` and is never tracked for balances or supply. It appears to be reserved for potential future use.

### 8.4 OHM Bridge Accounting

OHM on Berachain is a native deployment (not a bridge receipt token). The subgraph treats it identically to other chains: `getTotalSupply` reads `ERC20.totalSupply()` from the OHM address directly ([OhmCalculations.ts:12-23](../../subgraphs/berachain/src/treasury/OhmCalculations.ts#L12)). There is no bridge accounting or offset logic.

---

## 9. Tests in Tree

Source: [`tests/priceLookup.test.ts`](../../subgraphs/berachain/tests/priceLookup.test.ts)

| Test file | Framework | Coverage |
|---|---|---|
| `tests/priceLookup.test.ts` | Matchstick (`matchstick-as`) | Price resolution for wBERA and iBERA |

Test suite: `describe("priceLookup")` with `beforeEach` that mocks:
- Chainlink price feed for HONEY at $1.00
- WBERA-HONEY UniV3 pool (`mockRateUniswapV3Quoter`)
- iBERA-wBERA 3000-fee pool
- iBERA-wBERA 500-fee pool (with zero balances, effectively testing fallback)
- iBGT-wBERA pool (placeholder 1:1 rate)
- lBGT-wBERA Balancer pool (placeholder 2:1 WBERA ratio)

Test cases:
- `"resolves WBERA price"` — asserts price equals `toDecimal(WBERA_HONEY_AMOUNT_OUT, 18)` from the quoter
- `"resolves IBERA price"` — asserts expected price `"2.37154492078692454299068672164254"` computed from the iBERA-wBERA 3000-fee pool × wBERA price

No tests exist for OHM supply calculations, TokenRecord generation, Balancer pricing, or vault balance logic.

---

## 10. Open Questions for New Envio Implementation

1. **Event-driven vs. polling:** The legacy subgraph uses block polling (`every: 7200`). The Envio rewrite on `feat/envio` uses event-driven snapshots. The correct trigger events for Berachain (e.g., OHM Transfer events, vault Staked/Withdrawn events) need to be specified for the migration config.

2. **Kodiak quoter compatibility:** The Kodiak quoter at `0x644c8d6e501f7c994b74f5cea96abe65d0ba662b` uses a non-standard `sqrtPriceLimitX96 = 2^96` call pattern. Verify that the Envio external-call / effect mechanism handles this correctly against the on-chain quoter ABI.

3. **Same LP address for iBGT and lBGT pools:** `LP_KODIAK_IBGT_WBERA` and `LP_KODIAK_LBGT_WBERA` share the same address (`0x12bf773f18cec56f14e7cb91d82984ef5a3148ee`). Confirm whether lBGT has a separate pool that needs to be added, or whether the constant is deliberately set to the iBGT pool as a temporary pricing proxy.

4. **Infrared vault discovery:** The graft base was set at block `2735780` specifically for the Infrared vault deployment. In the Envio migration, the Infrared vault handler must not fire before this block or it will silently return zero balances (the `exists()` guard handles this at runtime in the legacy subgraph via `try_balanceOf` revert detection).

5. **Liquidity depth for Kodiak handlers:** `PriceHandlerKodiakIsland.getPrice` returns `liquidity: BigDecimal.zero()`. If multiple price handlers match the same token, Kodiak-sourced prices always lose the tie-break. This may produce incorrect prices if the Envio rewrite implements a different handler-selection strategy.

6. **Beradrome V1 vault deprecation:** Both Beradrome V1 and V2 vaults share the same `rewardVaultToken` address (`LP_BERADROME_KODIAK_OHM_HONEY`). This means both produce a `TokenRecord` with the same token identifier, which may cause entity ID collisions depending on how the Envio entity key is structured.

7. **Native BERA balance via `ethereum.getBalance`:** The shared `getNativeTokenBalances` helper calls `ethereum.getBalance`, which is an RPC call. In Envio's effect-based model this must be replaced with an explicit effect handler — the call cannot be made inline.

8. **`ERC20_TOKENS_BERACHAIN` map used for liquidity flag:** `getIsTokenLiquid` and category lookups use this map. Its content must be faithfully reproduced in the Envio handler's token definition layer.

9. **BGT token intent:** BGT is named but never tracked. Clarify with the protocol team whether BGT balance tracking is planned for Berachain and should be included in the migration scope.

10. **`lBGT` vs `LP_BEX_LBGT_WBERA` address distinction:** `LP_BEX_LBGT_WBERA` (`0x705fc16ba5a1eb67051934f2fb17eacae660f6c7`) is the BEX pool token address derived from the first 20 bytes of the pool ID. Confirm this is correct on-chain and not a truncation artefact.
