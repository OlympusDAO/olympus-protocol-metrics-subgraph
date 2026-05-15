# Behavioral Inventory: Fantom Subgraph

> Source tree: `subgraphs/fantom/`
> Schema: `schema.graphql` (repo root, shared across all chains)
> Last changelog entry: v1.0.4 (2023-10-09) — shift to polling block handler, deploy on Graph Decentralized Network

---

## 1. Manifest Summary

**Source:** [`subgraph.yaml`](../../subgraphs/fantom/subgraph.yaml)

| Field | Value |
|---|---|
| Chain / network name | `fantom` |
| Chain ID | 250 (Fantom Opera) |
| specVersion | 0.0.8 |
| apiVersion | 0.0.6 |
| language | wasm/assemblyscript |
| Entities written | `TokenRecord`, `TokenSupply` |
| Schema file | `../../schema.graphql` (repo root) |
| Subgraph ID (deployed) | `QmNUJtrE5Hiwj5eBeF5gSubY2vhuMdjaZnZsaq6vVY2aba` ([config.json](../../subgraphs/fantom/config.json)) |

### Data Sources

| Name | Address | ABI | startBlock | Handler file |
|---|---|---|---|---|
| `TokenRecords-fantom` | `0x91fa20244Fb509e8289CA630E5db3E9166233FDc` (gOHM on Fantom) | `gOHM` | **37320000** (~2022-05-01) | [`src/treasury/Assets.ts`](../../subgraphs/fantom/src/treasury/Assets.ts) |

### Handler Entry Points

| Type | Handler function | Filter |
|---|---|---|
| Block handler | [`handleAssets`](../../subgraphs/fantom/src/treasury/Assets.ts#L18) | `polling`, every **24000** blocks (~8 hours at ~1 s/block) |

There are **no event handlers** and **no call handlers** — all indexing is driven solely by the polling block handler. [`subgraph.yaml:41-46`](../../subgraphs/fantom/subgraph.yaml#L41)

### ABIs Declared in Manifest

| ABI name | File |
|---|---|
| `ERC20` | `../shared/abis/ERC20.json` |
| `gOHM` | `../shared/abis/gOHM.json` |
| `BalancerVault` | `../shared/abis/BalancerVault.json` |
| `BalancerPoolToken` | `../shared/abis/BalancerPoolToken.json` |
| `UniswapV2Pair` | `../shared/abis/UniswapV2Pair.json` |
| `UniswapV3Pair` | `../shared/abis/UniswapV3Pair.json` |
| `ChainlinkAggregator` | [`abis/ChainlinkAggregator.json`](../../subgraphs/fantom/abis/ChainlinkAggregator.json) (local, not used at runtime) |

Note: `BalancerVault`, `BalancerPoolToken`, `UniswapV3Pair`, and `ChainlinkAggregator` are declared in the manifest or present in `abis/` but **no Balancer, UniswapV3, or Chainlink handlers are instantiated** in the Fantom price router. Their ABIs are artifacts of a shared template.

---

## 2. Tokens

**Source:** [`src/contracts/Constants.ts`](../../subgraphs/fantom/src/contracts/Constants.ts)

All addresses are stored lowercase. [`Constants.ts:6-36`](../../subgraphs/fantom/src/contracts/Constants.ts#L6)

### ERC20 Tokens in `ERC20_TOKENS_FANTOM` map (used for `TokenRecord`)

| Symbol | Address | Category | `isLiquid` | `isVolatileBluechip` | Notes |
|---|---|---|---|---|---|
| BEETS | `0xf24bcf4d1e507740041c9cfd2dddb29585adce1e` | Volatile | true | false | Beethoven token [`L27`](../../subgraphs/fantom/src/contracts/Constants.ts#L27) |
| BOO | `0x841fad6eae12c286d1fd18d1d525dffa75c7effe` | Volatile | true | false | SpookySwap token [`L28`](../../subgraphs/fantom/src/contracts/Constants.ts#L28) |
| DAI | `0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E` | Stable | true | false | [`L29`](../../subgraphs/fantom/src/contracts/Constants.ts#L29) |
| DEI | `0xDE1E704dae0B4051e80DAbB26ab6ad6c12262DA0` | Stable | true | false | Deus Finance [`L30`](../../subgraphs/fantom/src/contracts/Constants.ts#L30) |
| FRAX | `0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355` | Stable | true | false | [`L31`](../../subgraphs/fantom/src/contracts/Constants.ts#L31) |
| LQDR | `0x10b620b2dbAC4Faa7D7FFD71Da486f5D44cd86f9` | Volatile | true | false | Liquid Driver [`L32`](../../subgraphs/fantom/src/contracts/Constants.ts#L32) |
| OXD | `0xc5A9848b9d145965d821AaeC8fA32aaEE026492d` | Volatile | true | **true** | 0xDAO; bluechip flag set [`L33`](../../subgraphs/fantom/src/contracts/Constants.ts#L33) |
| USDC | `0x04068da6c83afcfa0e13ba15a6696662335d5b75` | Stable | true | false | [`L34`](../../subgraphs/fantom/src/contracts/Constants.ts#L34) |
| wETH | `0x74b23882a30290451a17c44f4f05243b6b58c76d` | Volatile | true | **true** | Fantom-bridged wETH; bluechip [`L35`](../../subgraphs/fantom/src/contracts/Constants.ts#L35) |
| wFTM | `0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83` | Volatile | true | **true** | Native Fantom wrapped; bluechip [`L36`](../../subgraphs/fantom/src/contracts/Constants.ts#L36) |

### LP Tokens in `ERC20_TOKENS_FANTOM` map (POL)

| Symbol | Address | Category | `isLiquid` | `isVolatileBluechip` | Notes |
|---|---|---|---|---|---|
| wFTM-gOHM UniV2 | `0xae9bba22e87866e48ccacff0689afaa41eb94995` | Protocol-Owned Liquidity | true | false | Only LP in token map; owned liquidity [`L38`](../../subgraphs/fantom/src/contracts/Constants.ts#L38) |

### OHM Tokens (used to compute POL multiplier)

| Symbol | Address | Notes |
|---|---|---|
| gOHM | `0x91fa20244Fb509e8289CA630E5db3E9166233FDc` | [`OHM_TOKENS` constant, L40](../../subgraphs/fantom/src/contracts/Constants.ts#L40); excluded from `getTotalValue` when computing non-OHM fraction of LP |

gOHM is **not** added to `ERC20_TOKENS_FANTOM` for direct balance tracking. [`L11 comment`](../../subgraphs/fantom/src/contracts/Constants.ts#L11)

### Decimals

Decimals are fetched at runtime by calling `ERC20.decimals()` on each contract via [`getDecimals`](../../subgraphs/shared/src/contracts/ERC20.ts#L14). No decimals are hard-coded in Fantom-specific code. For UniswapV2 pools, decimals are read from both token contracts and from `pair.decimals()` for LP token supply. [`PriceHandlerUniswapV2.ts:84-88`](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L84)

---

## 3. Wallets

**Source:** [`src/contracts/ProtocolAddresses.ts`](../../subgraphs/fantom/src/contracts/ProtocolAddresses.ts), [`shared/src/Wallets.ts`](../../subgraphs/shared/src/Wallets.ts)

| Name | Address | Role | Active Window | Notes |
|---|---|---|---|---|
| Cross-Chain Fantom | `0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10` | Primary treasury wallet on Fantom | startBlock 37320000 onward | All Fantom assets held here; primary scan target [`ProtocolAddresses.ts:7`](../../subgraphs/fantom/src/contracts/ProtocolAddresses.ts#L7) |
| DAO Wallet | `0x245cc372c84b3645bf0ffe6538620b04a217988b` | Secondary / bridge transit | startBlock 37320000 onward | "Just in case there is a snapshot during a bridging action" [`ProtocolAddresses.ts:8`](../../subgraphs/fantom/src/contracts/ProtocolAddresses.ts#L8) |

`FANTOM_PROTOCOL_ADDRESSES = [CROSS_CHAIN_FANTOM, DAO_WALLET]` [`ProtocolAddresses.ts:6-9`](../../subgraphs/fantom/src/contracts/ProtocolAddresses.ts#L6)

There is **no `NON_TREASURY_ASSET_WHITELIST`** configured for any token — the wallet list is identical for every token. [`Contracts.ts:38`](../../subgraphs/fantom/src/contracts/Contracts.ts#L38)

---

## 4. Price Feeds and Routing

**Source:** [`src/price/PriceLookup.ts`](../../subgraphs/fantom/src/price/PriceLookup.ts), [`shared/src/price/PriceRouter.ts`](../../subgraphs/shared/src/price/PriceRouter.ts)

### No Chainlink Feeds

Despite `ChainlinkAggregator.json` being present in `abis/`, **no Chainlink price feeds are used on Fantom**. All pricing is derived from on-chain UniswapV2 reserves. [`PriceLookup.ts:29-38`](../../subgraphs/fantom/src/price/PriceLookup.ts#L29)

### Stablecoin Handler (price = 1.0 USD, no on-chain call)

`PriceHandlerStablecoin` returns a hardcoded price of `1` for all matched addresses. [`PriceHandlerStablecoin.ts:35-48`](../../subgraphs/shared/src/price/PriceHandlerStablecoin.ts#L35)

Stablecoins registered: DAI, DEI, FRAX, USDC [`PriceLookup.ts:30`](../../subgraphs/fantom/src/price/PriceLookup.ts#L30)

### UniswapV2 Handlers (ordered, evaluated left-to-right)

Pricing uses the first handler that matches a token and returns a non-null result. When multiple handlers match, the one with higher `liquidity` wins (currently always `BigDecimal.zero()` is returned as liquidity, so **the first matching handler always wins**). [`PriceRouter.ts:137-150`](../../subgraphs/shared/src/price/PriceRouter.ts#L137)

| Handler index | Tokens | Pool address | Price derivation |
|---|---|---|---|
| 0 | DAI, DEI, FRAX, USDC | — (stablecoin, no pool) | hardcoded 1.0 |
| 1 | BOO, wFTM | `0xec7178f4c41f346b2721907f5cf7628e388a7a58` | BOO priced via wFTM reserves; wFTM priced via USDC pool (index 4) |
| 2 | gOHM, wFTM | `0xae9bba22e87866e48ccacff0689afaa41eb94995` | gOHM priced via wFTM; wFTM via USDC pool |
| 3 | LQDR, wFTM | `0x4fe6f19031239f105f753d1df8a0d24857d0caa2` | LQDR priced via wFTM |
| 4 | USDC, wFTM | `0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c` | wFTM priced via USDC (stable anchor) |
| 5 | wFTM, BEETS | `0x648a7452da25b4fb4bdb79badf374a8f8a5ea2b5` | BEETS priced via wFTM |
| 6 | wFTM, OXD | `0xcb6eab779780c7fd6d014ab90d8b10e97a1227e2` | OXD priced via wFTM |
| 7 | wFTM, wETH | `0xf0702249f4d3a25cd3ded7859a165693685ab577` | wETH priced via wFTM; note: wETH address imported from Arbitrum Constants (see section 7) |

[`PriceLookup.ts:29-38`](../../subgraphs/fantom/src/price/PriceLookup.ts#L29)

### Recursive Pricing / Anti-cycle Logic

`getPriceRecursive` passes itself as the `priceLookup` callback. The router skips any handler whose `getId()` equals `currentPool`, and also skips handlers that share the same token set as the current pool, preventing infinite recursion. [`PriceRouter.ts:112-124`](../../subgraphs/shared/src/price/PriceRouter.ts#L112)

### Native FTM

Native FTM (unwrapped) is not tracked. Only wrapped FTM (`wFTM`) is in scope. There is no special handling for native gas token balances.

### Price Failure Behavior

If no handler produces a price, `getPrice` returns `BigDecimal.zero()` and logs a warning (does not revert/throw). [`PriceLookup.ts:70-73`](../../subgraphs/fantom/src/price/PriceLookup.ts#L70)

---

## 5. Liquidity Pools / Handlers

**Source:** [`src/treasury/OwnedLiquidity.ts`](../../subgraphs/fantom/src/treasury/OwnedLiquidity.ts), [`src/price/PriceLookup.ts`](../../subgraphs/fantom/src/price/PriceLookup.ts)

All seven `HANDLERS` entries are also iterated by `getOwnedLiquidityBalances`. However, only handlers with non-zero LP balances in the protocol wallets produce `TokenRecord` entries. In practice, only the wFTM-gOHM pool is in `ERC20_TOKENS_FANTOM` as POL.

### Owned Liquidity Multiplier Calculation

For each handler, the code:
1. Calls `getTotalValue([], ...)` — total pool value (all tokens included)
2. Calls `getTotalValue(OHM_TOKENS, ...)` — value **excluding** gOHM
3. Computes `multiplier = includedValue / totalValue` — the non-OHM fraction of the pool
4. Creates a `TokenRecord` with `multiplier` set, so `valueExcludingOhm = balance * unitRate * multiplier`

[`OwnedLiquidity.ts:39-47`](../../subgraphs/fantom/src/treasury/OwnedLiquidity.ts#L39)

If `totalValue == 0` or any value is null, the pool is skipped entirely. [`OwnedLiquidity.ts:40-46`](../../subgraphs/fantom/src/treasury/OwnedLiquidity.ts#L40)

### Pool Table

| Pool name | Type | Pool address | Tokens | Owned by treasury | In `ERC20_TOKENS_FANTOM` as POL | Notes |
|---|---|---|---|---|---|---|
| BOO-wFTM | UniswapV2 | `0xec7178f4c41f346b2721907f5cf7628e388a7a58` | BOO, wFTM | If balance > 0 in wallets | No | Used for pricing only unless treasury holds LP tokens |
| wFTM-gOHM | UniswapV2 | `0xae9bba22e87866e48ccacff0689afaa41eb94995` | wFTM, gOHM | Yes (primary POL pool) | **Yes** ([`Constants.ts:38`](../../subgraphs/fantom/src/contracts/Constants.ts#L38)) | POL; multiplier excludes gOHM value |
| LQDR-wFTM | UniswapV2 | `0x4fe6f19031239f105f753d1df8a0d24857d0caa2` | LQDR, wFTM | If balance > 0 | No | |
| USDC-wFTM | UniswapV2 | `0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c` | USDC, wFTM | If balance > 0 | No | Anchor pool for wFTM USD price |
| wFTM-BEETS | UniswapV2 | `0x648a7452da25b4fb4bdb79badf374a8f8a5ea2b5` | wFTM, BEETS | If balance > 0 | No | |
| wFTM-OXD | UniswapV2 | `0xcb6eab779780c7fd6d014ab90d8b10e97a1227e2` | wFTM, OXD | If balance > 0 | No | |
| wFTM-wETH | UniswapV2 | `0xf0702249f4d3a25cd3ded7859a165693685ab577` | wFTM, wETH | If balance > 0 | No | wETH address pulled from Arbitrum Constants (see section 7) |

LP unit price = `totalPoolValue / totalLPSupply`. [`PriceHandlerUniswapV2.ts:164-182`](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L164)

LP balance = `UniswapV2Pair.balanceOf(walletAddress)`. [`PriceHandlerUniswapV2.ts:184-196`](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L184)

---

## 6. Snapshot Cadence

**Source:** [`subgraph.yaml:41-46`](../../subgraphs/fantom/subgraph.yaml#L41)

- Block handler fires every **24000 blocks** (polling filter).
- At ~1 second per block on Fantom Opera, 24000 blocks ≈ **6.67 hours**.
- The comment in the manifest says "approximately 8 hours" (written before Fantom's actual block time was measured).
- Each snapshot writes one `TokenRecord` per (token × wallet) with non-zero balance, plus one `TokenRecord` per LP pool with non-zero balance held by any protocol wallet.
- No `TokenSupply` records are written on Fantom (no OHM supply handlers are present).

---

## 7. Manual Offsets / Migration / Quirks

### Cross-chain import of `ERC20_WETH`

[`src/price/PriceLookup.ts:3`](../../subgraphs/fantom/src/price/PriceLookup.ts#L3) imports `ERC20_WETH` from **Arbitrum** constants:

```
import { ERC20_WETH } from "../../../arbitrum/src/contracts/Constants";
```

This resolves to the Arbitrum wETH address `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`, which is **not the same as Fantom's bridged wETH** (`0x74b23882a30290451a17c44f4f05243b6b58c76d`, defined as `ERC20_WETH` in `Constants.ts`). However, the `HANDLERS` array uses this imported address only for price lookup routing (handler index 7: wFTM-wETH pool). The pool's actual token addresses are read on-chain from `pair.token0()` / `pair.token1()`, so the mismatch in the handler's token array means the handler will **not** match a price lookup for Fantom's wETH (`0x74b23...`). In `ERC20_TOKENS_FANTOM`, Fantom wETH is present as a Volatile token, but with no matching price handler, its price will resolve to `BigDecimal.zero()`. This is a latent bug.

### `CONTRACT_ABBREVIATION_MAP` vs `CONTRACT_NAME_MAP` confusion

[`Constants.ts:63-73`](../../subgraphs/fantom/src/contracts/Constants.ts#L63): `CONTRACT_ABBREVIATION_MAP` is declared but never populated. Abbreviation entries are mistakenly written to `CONTRACT_NAME_MAP` (via `CONTRACT_NAME_MAP.set(...)` calls instead of `CONTRACT_ABBREVIATION_MAP.set(...)`). This means `getContractName` with `abbreviation=null` will always return an empty abbreviation string.

### Duplicate `CONTRACT_NAME_MAP` entry for wFTM

[`Constants.ts:54-55`](../../subgraphs/fantom/src/contracts/Constants.ts#L54): `CONTRACT_NAME_MAP.set(ERC20_WFTM, "Wrapped ETH")` is immediately overwritten by `CONTRACT_NAME_MAP.set(ERC20_WFTM, "Wrapped Fantom")`. The first entry is unreachable dead code.

### Grafting commented out

[`subgraph.yaml:4-8`](../../subgraphs/fantom/subgraph.yaml#L4): A grafting configuration is present but commented out (base: `QmWTwjzoLhNUugdJmszcMeA38eEuTkpTeDdhHnjMjdLwrD`, block: 58674875, 2023-03-30). Grafting is not active.

### No `TokenSupply` production

Fantom does not call any OHM supply helper functions (no sOHM, gOHM total supply tracking). `TokenSupply` is listed as an entity in the manifest but nothing writes it.

### `NON_TREASURY_ASSET_WHITELIST` is empty

[`Contracts.ts:38`](../../subgraphs/fantom/src/contracts/Contracts.ts#L38): The whitelist that allows per-token wallet overrides exists but has no entries. All tokens use exactly `FANTOM_PROTOCOL_ADDRESSES`.

---

## 8. Chain-Specific Protocol Entities

_None._

The Fantom subgraph does not define or write any Fantom-specific entities beyond `TokenRecord`. The shared `schema.graphql` defines all entity types. There are no protocol metrics, rebase records, bond records, or OHM market cap entities produced by this subgraph.

---

## 9. Tests in Tree

**Source:** [`tests/dummy.test.ts`](../../subgraphs/fantom/tests/dummy.test.ts)

The test file exists but contains **no test cases** — it is a single-line empty file (1 line). No meaningful test coverage exists for the Fantom subgraph.

---

## 10. Open Questions for New Envio Implementation

1. **wETH address mismatch**: `PriceLookup.ts` imports `ERC20_WETH` from the Arbitrum constants module (`0x82aF49...`), not from `Constants.ts` (`0x74b23...`). Which address is correct for the wFTM-wETH SpookySwap pool on Fantom, and should the handler be functional or removed?

2. **wETH price fallback**: Given the cross-chain import bug, Fantom wETH (`0x74b23...`) has no functioning price handler. Was wETH ever held in the treasury wallet, and if so, what price was actually emitted in historical records?

3. **DEI stablecoin**: DEI (`0xDE1E704...`) is configured as a stablecoin with price = 1.0 USD. DEI depegged catastrophically in 2022. Should it remain priced at $1, or should a historical price handler be added?

4. **OXD bluechip flag**: `isVolatileBluechip = true` for OXD. Is this intentional? OXD was a ve(3,3) governance token with limited liquidity.

5. **LP handlers always scanned**: `getOwnedLiquidityBalances` iterates all 7 `HANDLERS` (including non-POL pools like BOO-wFTM). If the protocol never held those LP tokens, this results in zero-balance skips. Should the Envio implementation restrict LP scanning to only pools explicitly tagged as POL?

6. **No `TokenSupply` records**: The manifest declares `TokenSupply` as an entity but nothing writes it. Is this intentional (gOHM circulating supply tracked only on Ethereum mainnet), or is it a gap?

7. **Polling cadence translation**: The legacy subgraph fires every 24000 blocks. HyperIndex `onBlock` with `interval: 24000` should replicate this, but the block time on Fantom has varied. Confirm target cadence for the Envio implementation.

8. **DAO Wallet secondary scan**: The DAO wallet is included "just in case there is a snapshot during a bridging action." Is this still operationally required, or can it be removed?

9. **Stablecoin handler liquidity = 0**: `PriceHandlerStablecoin.getPrice` returns `liquidity: BigDecimal.zero()`. In the router, when multiple handlers match, higher liquidity wins. Because stablecoins are only in the stablecoin handler (no LP handler also matches them), this is harmless. Confirm this assumption holds for the Envio port.

10. **`ChainlinkAggregator.json` presence**: A Chainlink ABI is in `abis/` and in the manifest's `abis` list for `Price` (inherited from earlier versions), but is never used. Should it be removed from the Envio config to avoid dead code?
