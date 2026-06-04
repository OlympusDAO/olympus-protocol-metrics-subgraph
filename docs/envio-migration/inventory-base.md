# Behavioral Inventory — Base Subgraph

Source tree: `subgraphs/base/`

---

## 1. Manifest Summary

**Source:** [`subgraph.yaml`](../../subgraphs/base/subgraph.yaml)

| Field | Value |
|---|---|
| Chain | Base (EVM) |
| Network name (Graph) | `base` |
| specVersion | `0.0.8` |
| Features | `grafting` |
| Graft base CID | `QmYgw9fWpiriYBj6NL8U8952Gsrxfvdfe3hxHE25UJm56A` (v1.0.2) |
| Graft block | 25311259 (POL updates) |
| Schema | `../../schema.graphql` (shared root schema) |

### DataSources

| Name | Kind | Start Block | Trigger contract address | ABI | Entry point |
|---|---|---|---|---|---|
| `TokenRecords-base` | `ethereum/contract` | 13204827 (2024-04-15) | `0x060cb087a9730E13aa191f31A6d86bFF8DfcdCC0` (OHM) | `ERC20` | block handler only |

Block handler declared in [`subgraph.yaml:38-45`](../../subgraphs/base/subgraph.yaml#L38):

```yaml
blockHandlers:
  - handler: handleBlock
    filter:
      kind: polling
      every: 7200   # ≈ every 8 hours at 0.5 blocks/s
```

Handler implementation: [`src/treasury/Assets.ts:58`](../../subgraphs/base/src/treasury/Assets.ts#L58)

**ABIs loaded** (for RPC calls inside handlers):

| ABI name | File |
|---|---|
| `ERC20` | `../shared/abis/ERC20.json` |
| `UniswapV2Pair` | `../shared/abis/UniswapV2Pair.json` |
| `UniswapV3Pair` | `../shared/abis/UniswapV3Pair.json` |
| `UniswapV3PositionManager` | `../shared/abis/UniswapV3PositionManager.json` |
| `ChainlinkPriceFeed` | `../shared/abis/ChainlinkPriceFeed.json` |

There are **no event handlers** — the subgraph is entirely block-poll-driven.

---

## 2. Tokens

**Source:** [`src/contracts/Constants.ts`](../../subgraphs/base/src/contracts/Constants.ts)

The token registry is `ERC20_TOKENS_BASE` ([`Constants.ts:14`](../../subgraphs/base/src/contracts/Constants.ts#L14)), a `Map<string, TokenDefinition>`.

| Symbol | Address (lower) | Category | isLiquid | isVolatileBluechip | Notes |
|---|---|---|---|---|---|
| USDC | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | `Stable` | `true` | `false` | Priced via Chainlink |
| WETH | `0x4200000000000000000000000000000000000006` | `Volatile` | `true` | `true` | Native bridged WETH; priced via Chainlink; bluechip flag set |
| LP_UNISWAP_V2_OHM_WETH | `0x5ab4b9e96aeed4820e4be267f42411d722985482` | `Protocol-Owned Liquidity` | `true` | `false` | V2 LP token; handled via `PriceHandlerUniswapV2` |
| LP_UNISWAP_V3_OHM_USDC | `0x183ea22691c54806fe96555436dd312b6befac2f` | `Protocol-Owned Liquidity` | `true` | `false` | V3 pool; handled via `PriceHandlerUniswapV3` |

OHM token address: `0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0` — defined at [`Constants.ts:7`](../../subgraphs/base/src/contracts/Constants.ts#L7). OHM is **not** in `ERC20_TOKENS_BASE`; it appears only in `OHM_TOKENS` ([`Constants.ts:20`](../../subgraphs/base/src/contracts/Constants.ts#L20)) and is used exclusively for supply calculations.

Decimals are obtained at runtime via `contract.decimals()` RPC call ([`shared/src/contracts/ERC20.ts:14`](../../subgraphs/shared/src/contracts/ERC20.ts#L14)); no decimals are hardcoded in the token definitions.

---

## 3. Wallets

**Source:** [`src/contracts/Constants.ts`](../../subgraphs/base/src/contracts/Constants.ts)

| Name | Address (lower) | Role | Active window |
|---|---|---|---|
| DAO MS (Base) | `0x18a390bd45bcc92652b9a91ad51aed7f1c1358f5` | Protocol treasury / DAO multisig | From start block (13204827) onwards |

`PROTOCOL_ADDRESSES` ([`Constants.ts:26-28`](../../subgraphs/base/src/contracts/Constants.ts#L26)) contains only `DAO_MULTISIG`.

**Treasury blacklist** ([`Constants.ts:30-31`](../../subgraphs/base/src/contracts/Constants.ts#L30)): When querying OHM (`ERC20_OHM`) balances, `DAO_MULTISIG` is excluded from the wallet list via `getWalletAddressesForContract`. This means OHM held directly in the DAO multisig is **not** counted as a treasury asset; it is subtracted from circulating supply via `getTreasuryOHMRecords` instead.

---

## 4. Price Feeds and Routing

### Chainlink Feeds

**Source:** [`src/price/PriceChainlink.ts`](../../subgraphs/base/src/price/PriceChainlink.ts)

| Token | Feed address (lower) |
|---|---|
| WETH | `0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70` |
| USDC | `0x7e860098f58bbfc8648a4311b374b1d669a2bc6b` |

Feed lookup: `getPriceFeedValue` ([`PriceChainlink.ts:24`](../../subgraphs/base/src/price/PriceChainlink.ts#L24)) calls `try_decimals()` and `try_latestAnswer()` on the Chainlink contract. Returns `null` if either call reverts.

### Base Tokens

**Source:** [`src/price/PriceBase.ts`](../../subgraphs/base/src/price/PriceBase.ts)

A token is a "base token" if it has an entry in `tokenPriceFeedMap` (i.e., WETH and USDC). `isBaseToken` ([`PriceBase.ts:6`](../../subgraphs/base/src/price/PriceBase.ts#L6)) delegates to `getPriceFeedValue`.

`getBaseTokenRate` ([`PriceBase.ts:28`](../../subgraphs/base/src/price/PriceBase.ts#L28)): throws an error if the USD rate resolves to `null` or `0` — this causes the subgraph to fail-fast.

### Recursive Routing

**Source:** [`src/price/PriceLookup.ts`](../../subgraphs/base/src/price/PriceLookup.ts)

`PRICE_HANDLERS` ([`PriceLookup.ts:18-21`](../../subgraphs/base/src/price/PriceLookup.ts#L18)):

1. `PriceHandlerUniswapV2([OHM, WETH], LP_UNISWAP_V2_OHM_WETH)` — used to price OHM via the V2 OHM/WETH pool
2. `PriceHandlerUniswapV3([OHM, USDC], LP_UNISWAP_V3_OHM_USDC, UNISWAP_V3_POSITION_MANAGER)` — used to price OHM via the V3 OHM/USDC pool

`getPriceRecursive` ([`PriceLookup.ts:33`](../../subgraphs/base/src/price/PriceLookup.ts#L33)):
1. If the token is a base token (WETH or USDC), price is returned directly from Chainlink with `liquidity = U64.MAX_VALUE` (effectively infinite, always wins liquidity competition).
2. Otherwise, delegates to `getUSDRate` from the shared router ([`shared/src/price/PriceRouter.ts:73`](../../subgraphs/shared/src/price/PriceRouter.ts#L73)).

`getPrice` ([`PriceLookup.ts:63`](../../subgraphs/base/src/price/PriceLookup.ts#L63)): external-facing wrapper; returns `BigDecimal.zero()` (with a warning log, not a throw) if `getPriceRecursive` returns `null`.

**Routing rules (shared router):**
- Iterates `PRICE_HANDLERS` in order ([`PriceRouter.ts:107`](../../subgraphs/shared/src/price/PriceRouter.ts#L107)).
- Under recursion (when `currentPool` is set), skips the originating pool and any handler with the same token set ([`PriceRouter.ts:113-121`](../../subgraphs/shared/src/price/PriceRouter.ts#L113)).
- Among multiple valid handlers, selects the one with **highest liquidity depth** ([`PriceRouter.ts:144-150`](../../subgraphs/shared/src/price/PriceRouter.ts#L144)).
- For V3, liquidity depth = `otherTokenPrice × otherTokenBalance` in the pool contract ([`shared/src/price/PriceHandlerUniswapV3.ts:154-156`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L154)).
- For V2, liquidity depth is always `BigDecimal.zero()` (TODO note in code) ([`shared/src/price/PriceHandlerUniswapV2.ts:112`](../../subgraphs/shared/src/price/PriceHandlerUniswapV2.ts#L112)).

No `PriceHandlerStablecoin`, `PriceHandlerRemapping`, `PriceHandlerCustomMapping`, or `PriceHandlerERC4626` are used on Base.

---

## 5. Liquidity Pools / Handlers

**Source:** [`src/price/PriceLookup.ts`](../../subgraphs/base/src/price/PriceLookup.ts), [`src/treasury/OwnedLiquidity.ts`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts), [`src/treasury/OhmCalculations.ts`](../../subgraphs/base/src/treasury/OhmCalculations.ts)

### Pool 1: Uniswap V2 OHM/WETH

| Field | Value |
|---|---|
| Address | `0x5ab4b9e96aeed4820e4be267f42411d722985482` |
| Type | Uniswap V2 |
| Tokens | OHM, WETH |
| Owned by treasury? | Yes (DAO multisig holds LP tokens) |
| Handler | `PriceHandlerUniswapV2` |

**TokenRecord construction** ([`OwnedLiquidity.ts:89-161`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts#L89)):
- `balance` = LP token balance of wallet via `getBalance` (ERC20 `balanceOf`).
- `unitRate` = total pool value / LP total supply.
- `multiplier` (non-OHM fraction) = `getTotalValue(OHM_TOKENS excluded) / getTotalValue(none excluded)`. This sets `valueExcludingOhm = value × multiplier`.
- `category` = `TokenCategoryPOL` (derived from `ERC20_TOKENS_BASE` lookup).
- `isLiquid` = `true` (from `ERC20_TOKENS_BASE`).

**TokenSupply construction** ([`OhmCalculations.ts:71-123`](../../subgraphs/base/src/treasury/OhmCalculations.ts#L71)):
- Iterates all `PRICE_HANDLERS`; only handlers that `matches(OHM)` are processed.
- `balance` = `priceHandler.getUnderlyingTokenBalance(wallet, OHM, block)`, which for V2 = `(OHM reserves × wallet LP balance) / total LP supply`.
- Creates `TYPE_LIQUIDITY` record with `multiplier = -1` (i.e. subtracted from circulating supply).

### Pool 2: Uniswap V3 OHM/USDC

| Field | Value |
|---|---|
| Address | `0x183ea22691c54806fe96555436dd312b6befac2f` |
| Type | Uniswap V3 |
| Tokens | OHM, USDC |
| Owned by treasury? | Yes (DAO multisig holds V3 position NFTs) |
| Handler | `PriceHandlerUniswapV3` |
| Position manager | `0x03a520b32c04bf3beef7beb72e919cf822ed34f1` |

**TokenRecord construction** (V3-specific path at [`OwnedLiquidity.ts:16-78`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts#L16)):
- Iterates all V3 NFT positions held by the wallet via `positionManager.balanceOf(wallet)` + `tokenOfOwnerByIndex`.
- For each position, computes `token0Amount` and `token1Amount` from tick math (sqrtPrice from `slot0`, `tickLower`/`tickUpper` from position data).
- Positions with `liquidity == 0` are skipped ([`shared/src/price/PriceHandlerUniswapV3.ts:303`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L303)).
- Positions where `token0`/`token1` do not match the pool are skipped ([`shared/src/price/PriceHandlerUniswapV3.ts:283`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L283)).
- `totalValue` = `token0Balance × token0Price + token1Balance × token1Price`.
- `multiplier` = non-OHM value / total value (OHM tokens priced as zero for `valueExcludingOhm`).
- `rate` is passed as `BigDecimal.fromString("1")` with balance = `totalValue` (so `value = totalValue × 1`).
- `isLiquid = true`, `category = TokenCategoryPOL`.
- One `TokenRecord` per wallet (positions are aggregated).

**TokenSupply construction for V3** ([`OhmCalculations.ts:71-123`](../../subgraphs/base/src/treasury/OhmCalculations.ts#L71)):
- Uses `priceHandler.getUnderlyingTokenBalance(wallet, OHM, block)` which sums OHM amounts across all NFT positions for that wallet.
- Creates `TYPE_LIQUIDITY` record with `multiplier = -1`.

**V3 pricing quirk:** `getUnitPrice` for V3 returns `getTotalValue` (total pool value), not a per-token price, because V3 has no concept of total supply ([`shared/src/price/PriceHandlerUniswapV3.ts:233-235`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L233)). The V3 code path in `getOwnedLiquidityBalance` is bypassed in favour of `getOwnedLiquidityBalanceUniswapV3` ([`OwnedLiquidity.ts:103-104`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts#L103)).

---

## 6. Snapshot Cadence

**Source:** [`subgraph.yaml:38-45`](../../subgraphs/base/subgraph.yaml#L38), [`src/treasury/Assets.ts:58`](../../subgraphs/base/src/treasury/Assets.ts#L58)

- Trigger: `blockHandlers` with `kind: polling`, `every: 7200` blocks.
- At 0.5 blocks/second on Base, this equates to approximately **every 8 hours**.
- Entry point: `handleBlock(block: ethereum.Block)` at [`Assets.ts:58`](../../subgraphs/base/src/treasury/Assets.ts#L58).
- Each invocation calls `generateTokenRecords` then `generateTokenSupplies` — both functions call `.save()` on every entity via shared helpers.

**`generateTokenRecords` call order** ([`Assets.ts:13-32`](../../subgraphs/base/src/treasury/Assets.ts#L13)):
1. `getTokenBalances(timestamp, TokenCategoryStable, blockNumber)` → USDC balances in DAO multisig
2. `getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber)` → WETH balances in DAO multisig
3. `getOwnedLiquidityBalances(timestamp, blockNumber)` → V2 LP + V3 position records

**`generateTokenSupplies` call order** ([`Assets.ts:34-56`](../../subgraphs/base/src/treasury/Assets.ts#L34)):
1. `getTotalSupply` → OHM total supply (`TYPE_TOTAL_SUPPLY`, multiplier=1)
2. `getTreasuryOHMRecords` → OHM held in `PROTOCOL_ADDRESSES` (`TYPE_TREASURY`, multiplier=-1)
3. `getProtocolOwnedLiquiditySupplyRecords` → OHM inside LP positions (`TYPE_LIQUIDITY`, multiplier=-1)

---

## 7. Manual Offsets / Migration / Quirks

**Grafting:** The subgraph grafts from `QmYgw9fWpiriYBj6NL8U8952Gsrxfvdfe3hxHE25UJm56A` at block 25311259 for "POL updates" ([`subgraph.yaml:6-8`](../../subgraphs/base/subgraph.yaml#L6)). Entities before this block were inherited from the prior deployment without re-indexing.

**OHM blacklisted from DAO multisig for token records:** The treasury blacklist at [`Constants.ts:30-31`](../../subgraphs/base/src/contracts/Constants.ts#L30) prevents OHM from appearing as a `TokenRecord` for the DAO multisig. OHM held there is handled solely as a `TokenSupply` supply deduction, not a treasury asset.

**Zero-balance filtering:** `getERC20TokenRecordFromWallet` returns `null` for zero balances ([`shared/src/contracts/ERC20.ts:112`](../../subgraphs/shared/src/contracts/ERC20.ts#L112)); `getOwnedLiquidityBalance` skips if `totalBalance == 0` ([`OwnedLiquidity.ts:113-115`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts#L113)) or `totalValue == 0` ([`OwnedLiquidity.ts:119`](../../subgraphs/base/src/treasury/OwnedLiquidity.ts#L119)); `getTreasuryOHMRecords` skips zero-balance wallets ([`OhmCalculations.ts:42`](../../subgraphs/base/src/treasury/OhmCalculations.ts#L42)).

**`getPrice` returns zero on failure (non-throwing):** If price resolution returns `null`, `getPrice` returns `BigDecimal.zero()` with a warning — no failure. This means a token with an unresolvable price still produces a `TokenRecord` with `rate=0` and `value=0` rather than aborting ([`PriceLookup.ts:68-72`](../../subgraphs/base/src/price/PriceLookup.ts#L68)).

**`getBaseTokenRate` is throwing:** Opposite behaviour for base token (WETH/USDC) price failures — throws an error causing indexing to halt ([`PriceBase.ts:37-44`](../../subgraphs/base/src/price/PriceBase.ts#L37)).

**No manual offset records** (`TYPE_OFFSET`): The `TYPE_OFFSET` constant is defined in shared but is not used anywhere in the Base subgraph.

**V3 `getBalance` always returns zero:** `PriceHandlerUniswapV3.getBalance()` is a stub that always returns 0 ([`shared/src/price/PriceHandlerUniswapV3.ts:238-241`](../../subgraphs/shared/src/price/PriceHandlerUniswapV3.ts#L238)). The V3 balance path relies exclusively on position NFT enumeration via `getUnderlyingTokenBalance`, not LP-token balances.

---

## 8. Chain-Specific Protocol Entities

**Source:** [`src/contracts/Constants.ts`](../../subgraphs/base/src/contracts/Constants.ts)

- `BLOCKCHAIN = "Base"` string constant ([`Constants.ts:5`](../../subgraphs/base/src/contracts/Constants.ts#L5)) embedded in every `TokenRecord` and `TokenSupply` entity.
- The subgraph deployer ID / config name is `protocol-metrics-base` ([`config.json`](../../subgraphs/base/config.json)).
- No staking contracts, no bond depository, no lending markets, no gOHM tracking, no BLV vaults are present on Base.
- No `TYPE_BONDS_*` or `TYPE_LENDING` or `TYPE_BOOSTED_LIQUIDITY_VAULT` records are produced.
- The position manager address `0x03a520b32c04bf3beef7beb72e919cf822ed34f1` is the Base-specific Uniswap V3 NonfungiblePositionManager ([`Constants.ts:24`](../../subgraphs/base/src/contracts/Constants.ts#L24)).
- Subgraph version: `1.0.9` ([`config.json`](../../subgraphs/base/config.json)).

---

## 9. Tests in Tree

**Source:** [`tests/dummy.test.ts`](../../subgraphs/base/tests/dummy.test.ts)

The test file is completely empty (0 bytes / 1 empty line). No Matchstick tests exist for the Base subgraph.

| Test | Summary |
|---|---|
| _(none)_ | The `tests/` directory contains only `dummy.test.ts` with no test cases. |

---

## 10. Open Questions for New Envio Implementation

1. **Grafted history:** The legacy subgraph grafts at block 25311259. The Envio implementation must decide whether to start indexing from block 13204827 (full re-index) or accept data gaps before the graft block. If full re-index is chosen, verify there is no missing data before the graft.

2. **Block polling interval:** Envio does not use Graph's `polling` block handler filter. The equivalent cadence (every ~8 hours / 7200 blocks) must be implemented with a block handler and modulo check, or via `onBlock` with an `interval` option. Confirm the target interval with the team.

3. **V3 position NFT enumeration cost:** The current implementation calls `positionManager.balanceOf(wallet)` then `tokenOfOwnerByIndex(wallet, i)` for every position at every snapshot block. On Envio this will require RPC calls via the effect API for each position. Assess whether position count growth makes this prohibitively expensive and whether an alternative tracking approach (e.g. Transfer event indexing for NFT positions) is preferred.

4. **OHM price via pool selection:** OHM price is derived from whichever of the two pools (V2 OHM/WETH or V3 OHM/USDC) has higher liquidity depth. The V2 handler always reports `liquidity=0`, so in practice the V3 pool always wins when both are available. Confirm this is intended behaviour or whether the V2 pool should be given priority / deprecated.

5. **Blacklist behaviour for OHM:** The treasury blacklist causes OHM to be excluded from `TokenRecord` wallet scans for the DAO multisig while still appearing in `TokenSupply` records as a `TYPE_TREASURY` deduction. This two-table split must be preserved exactly in Envio.

6. **`getPrice` zero-on-failure vs `getBaseTokenRate` throw-on-failure:** These two inconsistent error-handling behaviours must be replicated faithfully. Confirm whether the Envio implementation should standardise on one behaviour or preserve the asymmetry.

7. **Graft entity schema compatibility:** The grafted entities use the shared `schema.graphql` root. Verify that all fields populated by the legacy subgraph before block 25311259 are compatible with the Envio schema definition being targeted.

8. **No tests to port:** There are no Matchstick tests in this subgraph. The Envio TDD workflow will need to write tests from scratch using `createTestIndexer()`. Recommend deriving test cases from the behavioral rules in sections 2–7 above.
