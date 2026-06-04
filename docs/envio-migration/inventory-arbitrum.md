# Arbitrum Subgraph Behavioral Inventory

## 1. Manifest Summary

**Chain:** `arbitrum-one`  
**Spec version:** `0.0.9`  
**Grafting enabled:** yes — base `QmNQfMN2GjnGYx2mGo92gAc7z47fMbTMRR9M1gGEUjLZHX` (v1.7.9), grafted at block 450,845,846 (2026-04-10 00:00:00 UTC).  
**Schema:** `../../schema.graphql` (shared)  
**Handler file:** [`src/treasury/Assets.ts`](../../subgraphs/arbitrum/src/treasury/Assets.ts)

### Data Sources

| Name | Contract address | ABI | Start block | End block | Trigger |
|---|---|---|---|---|---|
| `TokenRecords-arbitrum` | `0x5D041081725468Aa43e72ff0445Fde2Ad1aDE775` (FRAX-USD aggregator, stopped 2026-04-10) | `ChainlinkAggregator` | 10,950,000 (~2022-05-01) | 451,191,255 (2026-04-11) | `NewRound(uint256,address,uint256)` → `handleEvent` |
| `TokenRecords-arbitrum-frax-usd-2026-04` | `0x767802a8610C3D34CbeC9d064028EacA976dAba0` (FRAX-USD aggregator replacement) | `ChainlinkAggregator` | 451,191,255 (2026-04-11) | _(none)_ | `NewRound(uint256,address,uint256)` → `handleEvent` |

The second data source is a replacement aggregator for the same FRAX-USD proxy (`0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8`) after the first stopped emitting rounds. Both use identical handler logic.

**Entities written:** `TokenRecord`, `TokenSupply`

**ABIs loaded per data source:** `ERC20`, `gOHM`, `OlympusLender`, `BalancerVault`, `BalancerPoolToken`, `UniswapV2Pair`, `UniswapV3Pair`, `ChainlinkPriceFeed`, `JONESStaking`, `TreasureMining`, `ChainlinkAggregator`

**Block handler (`handleBlock`):** defined in [`Assets.ts:74`](../../subgraphs/arbitrum/src/treasury/Assets.ts#L74) but _not wired in the manifest_ — the manifest only has event handlers. This function exists as dead code.

---

## 2. Tokens

All addresses are stored lower-cased. Decimals are fetched live via `ERC20.try_decimals()` unless noted. Sources: [`Constants.ts`](../../subgraphs/arbitrum/src/contracts/Constants.ts).

### Regular ERC20 tokens

| Symbol | Address | Category | Decimals source | Liquid | Bluechip | Liquid-backing multiplier | Notes |
|---|---|---|---|---|---|---|---|
| FRAX | `0x17fc002b466eec40dae837fc4be5c67993ddbd6f` | Stable | live ERC20 | yes | no | — | Price via Chainlink feed (see §4) |
| USDC | `0xff970a61a04b1ca14834a43f5de4533ebddb5cc8` | Stable | live ERC20 | yes | no | — | Price via Chainlink feed |
| LUSD | `0x93b346b6bc2548da6a1e7d98e9a421b42541425b` | Stable | live ERC20 | yes | no | — | Skipped before block 80,000,000 (no Chainlink feed yet); price via Chainlink feed |
| WETH | `0x82af49447d8a07e3bd95bd0d56f35241523fbab1` | Volatile | live ERC20 | yes | **yes** | — | Price via Chainlink feed; also the base token for recursive pricing |
| ARB | `0x912ce59144191c1204e64559fe8253a0e49e6548` | Volatile | live ERC20 | yes | no | — | Price via UniswapV3 ARB-WETH pool → WETH/USD Chainlink |
| JONES | `0x10393c20975cf177a3513071bc110f7962cd67da` | Volatile | live ERC20 | yes | no | **0 at/after block 130,482,707** | Written-off from liquid backing at `JONES_WRITE_OFF_BLOCK` (both ERC20 wallet balance and staked balance). Multiplier forced to 0 in [`Contracts.ts:112-119`](../../subgraphs/arbitrum/src/contracts/Contracts.ts#L112) and [`JonesStaking.ts:121-127`](../../subgraphs/arbitrum/src/contracts/JonesStaking.ts#L121) |
| LQTY | `0xfb9e5d956d889d91a82737b9bfcdc1dce3e1449` | Volatile | live ERC20 | yes | no | — | Price via UniswapV2 LQTY-WETH pool |
| MAGIC | `0x539bde0d7dbd336b79148aa742883198bbf60342` | Volatile | live ERC20 | yes | no | — | Price via UniswapV2 MAGIC-WETH pool; also has staked balance via TreasureDAO Atlas Mine |
| VSTA | `0xa684cd057951541187f288294a1e1c2646aa2d24` | Volatile | live ERC20 | yes | no | **0.77** (static) | Liquid-backing multiplier set at definition time in [`Constants.ts:66`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L66) |

### OHM / gOHM tokens (supply accounting only; not in `ERC20_TOKENS_ARBITRUM`)

| Symbol | Address | Notes |
|---|---|---|
| OHM (Arbitrum) | `0xf0cb2dc0db5e6c66b9a70ac27b06b878da017028` | Used for total supply, treasury OHM, lending market supply |
| gOHM (Synapse bridge) | `0x8d9ba570d6cb60c7e3e0f31343efe75ab8e65fb1` | Not in `ERC20_TOKENS_ARBITRUM` (explicitly excluded per comment at [`Constants.ts:12`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L12)); used only in `OHM_TOKENS` for supply/POL accounting and price routing |

### LP tokens (in `ERC20_TOKENS_ARBITRUM` as POL)

| Name | Pool ID / Address | Category | Liquid | Notes |
|---|---|---|---|---|
| Balancer MAGIC-USDC | `0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba` | POL | yes | **Price handler disabled** — commented out in [`PriceLookup.ts:38`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L38) due to infinite-loop risk (issue #94); still appears in token map |
| Balancer wETH-VSTA | `0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d` | POL | yes | Active price handler |
| Balancer wETH-OHM | `0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423` | POL | yes | Active price handler |
| Balancer OHM-USDC | `0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424` | POL | yes | Active price handler |
| UniswapV2 gOHM-WETH | `0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d` | POL | yes | Active price handler |
| UniswapV2 jgOHM-gOHM | `0x292d1587a6bb37e34574c9ad5993f221d8a5616c` | POL | yes | No price handler — not in `PRICE_HANDLERS`; balance will be zero unless a handler is added |
| UniswapV2 JONES-WETH | `0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c` | POL | yes | Active price handler |
| UniswapV2 LQTY-WETH (Ramses) | `0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf` | POL | yes | Active price handler (UniswapV2 interface) |
| UniswapV2 MAGIC-WETH | `0xb7e50106a5bd3cf21af210a755f9c8740890a8c9` | POL | yes | Active price handler |
| Camelot OHM-WETH | `0x8acd42e4b5a5750b44a28c5fb50906ebff145359` | POL | yes | Active price handler (UniswapV2 interface) |
| UniswapV3 ARB-WETH | `0xc6f780497a95e246eb9449f5e4770916dcd6396a` | POL | yes | Active price handler |
| UniswapV3 WETH-USDC | `0xc31e54c7a869b9fcbecc14363cf510d1c41fa443` | POL | yes | Active price handler |

---

## 3. Wallets

Protocol addresses are composed of two sets: `WALLET_ADDRESSES` (shared, [`shared/src/Wallets.ts`](../../subgraphs/shared/src/Wallets.ts)) plus the Arbitrum-specific DAO multisig. Sources: [`Constants.ts:84-87`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L84), [`Contracts.ts:43-74`](../../subgraphs/arbitrum/src/contracts/Contracts.ts#L43).

### Protocol address list (used in `getProtocolAddresses()`)

All addresses from `WALLET_ADDRESSES` in shared plus `DAO_MULTISIG`:

| Name | Address | Role | Notes |
|---|---|---|---|
| Aave Allocator V2 | `0x0d33c811d0fcc711bcb388dfb3a152de445be66f` | Allocator | Ethereum-native; likely holds no Arbitrum balances |
| Aave Allocator V1 | `0x0e1177e47151be72e5992e0975000e73ab5fd9d4` | Allocator | |
| Aura Allocator V2 | `0x8caf91a6bb38d55fb530dec0fab535fa78d98fad` | Allocator | |
| Aura Allocator | `0x872ebdd8129aa328c89f6bf032bbd77a4c4bac7e` | Allocator | |
| Balancer Allocator | `0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6` | Allocator | Comment in Wallets.ts: "Incorrect?" |
| Bond Depository | `0x9025046c6fb25fb39e720d97a8fd881ed69a1ef6` | Bond deposit | Also in `CIRCULATING_SUPPLY_WALLETS` |
| Bond (Inverse) Depository | `0xba42be149e5260eba4b82418a6306f55d532ea47` | Bond deposit | Also in `CIRCULATING_SUPPLY_WALLETS` |
| Buyback MS | `0xf7deb867e65306be0cb33918ac1b8f89a72109db` | Multisig | |
| Convex Allocator 1 | `0x3df5a355457db3a4b5c744b8623a7721bf56df78` | Allocator | |
| Convex Allocator 2 | `0x408a9a09d97103022f53300a3a14ca6c3ff867e8` | Allocator | |
| Convex Allocator 3 | `0xdbf0683fc4fc8ac11e64a6817d3285ec4f2fc42d` | Allocator | |
| Convex Allocator | `0xdfc95aaf0a107daae2b350458ded4b7906e7f728` | Allocator | |
| Convex vlCVX Allocator | `0x2d643df5de4e9ba063760d475beaa62821c71681` | Allocator | |
| Convex Staking Proxy FRAXBP | `0x943c1dfa7da96e54242bd2c78dd3ef5c7b24b18c` | Staking proxy | |
| Convex Staking Proxy OHM-FRAXBP | `0x75e7f7d871f4b5db0fa9b0f01b7422352ec9618f` | Staking proxy | |
| Cross-Chain Arbitrum | `0x012bbf0481b97170577745d2167ee14f63e2ad4c` | Cross-chain bridge | Also in `CIRCULATING_SUPPLY_WALLETS`; same as `DAO_MULTISIG` |
| Cross-Chain Fantom | `0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10` | Cross-chain bridge | |
| Cross-Chain Polygon | `0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7` | Cross-chain bridge | |
| Treasury MS (DAO Wallet) | `0x245cc372c84b3645bf0ffe6538620b04a217988b` | Treasury multisig | Also in `CIRCULATING_SUPPLY_WALLETS`; WETH is whitelisted for this wallet via `NON_TREASURY_ASSET_WHITELIST` |
| DAO Working Capital | `0xf65a665d650b5de224f46d729e2bd0885eea9da5` | Working capital | Also in `CIRCULATING_SUPPLY_WALLETS` |
| LUSD Allocator | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Allocator | |
| LUSD Allocator V2 | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Allocator | Same address as V1 |
| Maker DSR Allocator Proxy | `0x5db0761487e26b555f5bfd5e40f4cbc3e1a7d11e` | Allocator | |
| Maker DSR Allocator | `0x0ea26319836ff05b8c5c5afd83b8ab17dd46d063` | Allocator | |
| OTC Escrow | `0xe3312c3f1ab30878d9686452f7205ebe11e965eb` | OTC | Also in `CIRCULATING_SUPPLY_WALLETS` |
| Rari Allocator | `0x061c8610a784b8a1599de5b1157631e35180d818` | Allocator | |
| Treasury Wallet V1 | `0x886ce997aa9ee4f8c2282e182ab72a705762399d` | Treasury | Also in `CIRCULATING_SUPPLY_WALLETS` |
| Treasury Wallet V2 | `0x31f8cc382c9898b273eff4e0b7626a6987c846e8` | Treasury | Also in `CIRCULATING_SUPPLY_WALLETS` |
| Treasury Wallet V3 | `0x9a315bdf513367c0377fb36545857d12e85813ef` | Treasury | Also in `CIRCULATING_SUPPLY_WALLETS` |
| TRSRY | `0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613` | Treasury | |
| TRSRY V1.1 | `0xea1560f36f71a2f54defa75ed9eaa15e8655be22` | Treasury | |
| VeFXS Allocator | `0xde7b85f52577b113181921a7aa8fc0c22e309475` | Allocator | |
| Cooler Loans CH V1 | `0xd6a6e8d9e82534bd65821142fccd91ec9cf31880` | Clearinghouse | |
| Cooler Loans CH V1.1 | `0xe6343ad0675c9b8d3f32679ae6adbA0766a2ab4c` | Clearinghouse | |
| Cooler Loans CH V2 | `0x1e094fe00e13fd06d64eea4fb3cd912893606fe0` | Clearinghouse | |
| Cooler Loans V2 MonoCooler | `0xdb591ea2e5db886da872654d58f6cc584b68e7cc` | Cooler | |
| Yield Farming MS | `0x2075e3b46470cfce124daaf52b46dcf965727dd1` | Multisig | |
| **DAO Multisig (Arbitrum)** | **`0x012bbf0481b97170577745d2167ee14f63e2ad4c`** | **DAO multisig** | Arbitrum-specific; added via `getProtocolAddresses()` at [`Constants.ts:84-87`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L84). Identical address to `CROSS_CHAIN_ARBITRUM` |

### Per-token wallet overrides

- **OHM and gOHM (Synapse):** All protocol addresses are blacklisted — balances in those wallets are excluded via `TREASURY_BLACKLIST` at [`Constants.ts:89-96`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L89). This means no ERC20 `TokenRecord` is ever written for OHM or gOHM; their supply impact is tracked solely through `TokenSupply` records.
- **WETH:** `DAO_WALLET` (`0x245cc372c84b3645bf0ffe6538620b04a217988b`) is added as a supplementary address via `NON_TREASURY_ASSET_WHITELIST` at [`Contracts.ts:44`](../../subgraphs/arbitrum/src/contracts/Contracts.ts#L44). The wallet is already in the default protocol list so this has no practical effect (de-duplicated at [`Contracts.ts:63-70`](../../subgraphs/arbitrum/src/contracts/Contracts.ts#L63)).

### `CIRCULATING_SUPPLY_WALLETS` (used for OHM/gOHM treasury deduction)

Defined at [`Constants.ts:140-150`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L140):

`BONDS_DEPOSIT`, `BONDS_INVERSE_DEPOSIT`, `CROSS_CHAIN_ARBITRUM`, `DAO_WALLET`, `DAO_WORKING_CAPITAL`, `OTC_ESCROW`, `TREASURY_ADDRESS_V1`, `TREASURY_ADDRESS_V2`, `TREASURY_ADDRESS_V3`

---

## 4. Price Feeds and Routing

Sources: [`PriceChainlink.ts`](../../subgraphs/arbitrum/src/price/PriceChainlink.ts), [`PriceBase.ts`](../../subgraphs/arbitrum/src/price/PriceBase.ts), [`PriceLookup.ts`](../../subgraphs/arbitrum/src/price/PriceLookup.ts), [`shared/src/price/PriceRouter.ts`](../../subgraphs/shared/src/price/PriceRouter.ts).

### Chainlink price feeds (base tokens)

These are the only tokens treated as "base tokens" — prices fetched directly from Chainlink, not computed recursively. Decimals are fetched live from `ChainlinkPriceFeed.try_decimals()`, answer from `try_latestAnswer()`.

| Token | Token address | Feed address | Notes |
|---|---|---|---|
| LUSD | `0x93b346b6bc2548da6a1e7d98e9a421b42541425b` | `0x0411d28c94d85a36bc72cb0f875dfa8371d8ffff` | Skipped before block 80,000,000 (no feed existed yet) |
| USDC | `0xff970a61a04b1ca14834a43f5de4533ebddb5cc8` | `0x50834f3163758fcc1df9973b6e91f0f0f0434ad3` | |
| WETH | `0x82af49447d8a07e3bd95bd0d56f35241523fbab1` | `0x639fe6ab55c921f74e7fac1ee960c0b6293ba612` | Primary base token for recursive routing |

FRAX is listed as a stable in `ERC20_TOKENS_ARBITRUM` but has **no Chainlink feed entry** in `tokenPriceFeedMap`. Its price comes from the `PriceHandlerStablecoin` which maps it to 1 USD (alongside USDC) at [`PriceLookup.ts:42`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L42).

### Stable mapping (PriceHandlerStablecoin)

`[ERC20_FRAX, ERC20_USDC]` are treated as equivalent stablecoins. When pricing either, the handler returns the Chainlink price of the other (USDC feed). Source: [`PriceLookup.ts:42`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L42).

### Recursive routing via PRICE_HANDLERS

Defined at [`PriceLookup.ts:37-50`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L37). Order matters for tie-breaking only; highest-liquidity result wins.

| Handler type | Pool ID / address | Tokens |
|---|---|---|
| `PriceHandlerBalancer` | `LP_BALANCER_POOL_WETH_VESTA` | WETH, VSTA |
| `PriceHandlerBalancer` | `LP_BALANCER_POOL_WETH_OHM` | WETH, OHM |
| `PriceHandlerBalancer` | `LP_BALANCER_POOL_OHM_USDC` | OHM, USDC |
| `PriceHandlerStablecoin` | _(n/a)_ | FRAX, USDC |
| `PriceHandlerUniswapV2` | `LP_UNISWAP_V2_GOHM_WETH` | gOHM (Synapse), WETH |
| `PriceHandlerUniswapV2` | `LP_UNISWAP_V2_JONES_WETH` | JONES, WETH |
| `PriceHandlerUniswapV2` | `LP_UNISWAP_V2_LQTY_WETH` | LQTY, WETH |
| `PriceHandlerUniswapV2` | `LP_UNISWAP_V2_MAGIC_WETH` | MAGIC, WETH |
| `PriceHandlerUniswapV2` | `LP_CAMELOT_OHM_WETH` | OHM, WETH |
| `PriceHandlerUniswapV3` | `LP_UNISWAP_V3_WETH_USDC` | USDC, WETH — position manager `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| `PriceHandlerUniswapV3` | `LP_UNISWAP_V3_ARB_WETH` | ARB, WETH — position manager `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |

**Disabled handler:** `PriceHandlerBalancer` for `LP_BALANCER_POOL_MAGIC_USDC` (`0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba`) is commented out at [`PriceLookup.ts:38`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L38) — this would cause an infinite loop (issue #94).

### Cycle-guard / same-token-set guard

Implemented in shared [`PriceRouter.ts:113-122`](../../subgraphs/shared/src/price/PriceRouter.ts#L113). When recursing to price a token in pool X, any handler with the same pool ID or the same sorted token set as the current pool is skipped. This prevents OHM→WETH→OHM cycles across multiple pools that share the same pair.

### Routing logic summary

1. `getPrice(token)` → `getPriceRecursive(token, block, null)`
2. If token is a base token (LUSD/USDC/WETH), return Chainlink feed value directly. Max-uint liquidity is returned so base-token results always dominate.
3. Otherwise, iterate `PRICE_HANDLERS`, skip same pool and same token-set handlers, collect results, return the one with highest liquidity.
4. If no result found, log a warning and return `BigDecimal.zero()` (does **not** throw).

---

## 5. Liquidity Pools / Handlers

Sources: [`PriceLookup.ts`](../../subgraphs/arbitrum/src/price/PriceLookup.ts), [`OwnedLiquidity.ts`](../../subgraphs/arbitrum/src/treasury/OwnedLiquidity.ts), [`Constants.ts`](../../subgraphs/arbitrum/src/contracts/Constants.ts).

For owned-liquidity `TokenRecord` construction, the multiplier applied is `includedValue / totalValue` where `includedValue` = pool value excluding OHM tokens and `totalValue` = total pool value. OHM tokens for this calculation are `[ERC20_GOHM_SYNAPSE, ERC20_OHM]`.

| Pool name | Address / Pool ID | Type | Tokens | Treasury-owned? | Handler-specific quirks |
|---|---|---|---|---|---|
| Balancer MAGIC-USDC | `0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba` | Balancer | MAGIC, USDC | yes (POL) | Price handler **disabled** (infinite-loop risk, issue #94). Appears in `ERC20_TOKENS_ARBITRUM` as POL but `getOwnedLiquidityBalance` will have no price handler → will return zero records. |
| Balancer wETH-VSTA | `0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d` | Balancer | WETH, VSTA | yes (POL) | Vault: `0xBA12222222228d8Ba445958a75a0704d566BF2C8` |
| Balancer wETH-OHM | `0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423` | Balancer | WETH, OHM | yes (POL) | Contains OHM → multiplier < 1 |
| Balancer OHM-USDC | `0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424` | Balancer | OHM, USDC | yes (POL) | Contains OHM → multiplier < 1 |
| UniswapV2 gOHM-WETH | `0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d` | UniswapV2 | gOHM, WETH | yes (POL) | Contains gOHM → multiplier < 1 |
| UniswapV2 jgOHM-gOHM | `0x292d1587a6bb37e34574c9ad5993f221d8a5616c` | UniswapV2 | Jones-gOHM, gOHM | yes (POL) | **No price handler in `PRICE_HANDLERS`**. Appears in `ERC20_TOKENS_ARBITRUM` but `getOwnedLiquidityBalances` iterates `PRICE_HANDLERS` — this pool will never produce records. |
| UniswapV2 JONES-WETH | `0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c` | UniswapV2 | JONES, WETH | yes (POL) | |
| Ramses LQTY-WETH | `0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf` | UniswapV2 interface | LQTY, WETH | yes (POL) | Treated as UniswapV2 |
| UniswapV2 MAGIC-WETH | `0xb7e50106a5bd3cf21af210a755f9c8740890a8c9` | UniswapV2 | MAGIC, WETH | yes (POL) | |
| Camelot OHM-WETH | `0x8acd42e4b5a5750b44a28c5fb50906ebff145359` | UniswapV2 interface | OHM, WETH | yes (POL) | Contains OHM → multiplier < 1; treated as UniswapV2 |
| UniswapV3 WETH-USDC | `0xc31e54c7a869b9fcbecc14363cf510d1c41fa443` | UniswapV3 | USDC, WETH | yes (POL) | Position manager: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| UniswapV3 ARB-WETH | `0xc6f780497a95e246eb9449f5e4770916dcd6396a` | UniswapV3 | ARB, WETH | yes (POL) | Position manager: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |

**Balancer vault address:** `0xba12222222228d8ba445958a75a0704d566bf2c8` (used for all Balancer pool queries).

Owned-liquidity `TokenRecord` records are created for each protocol wallet that holds LP tokens, with `multiplier = includedValue / totalValue` (OHM-weighted). If `totalValue` is zero, no records are emitted (early return at [`OwnedLiquidity.ts:38-39`](../../subgraphs/arbitrum/src/treasury/OwnedLiquidity.ts#L38)).

---

## 6. Snapshot Cadence

There are **no block handlers** wired in the manifest. All snapshots are triggered exclusively by Chainlink `NewRound` events from the FRAX-USD aggregator (or its replacement). Sources: [`subgraph.yaml:54-57`](../../subgraphs/arbitrum/subgraph.yaml#L54), [`Assets.ts:66-72`](../../subgraphs/arbitrum/src/treasury/Assets.ts#L66).

| Trigger | Event signature | Entry point | Records generated |
|---|---|---|---|
| `NewRound` on FRAX-USD aggregator | `NewRound(indexed uint256,indexed address,uint256)` | `handleEvent(event: NewRound)` in [`Assets.ts:66`](../../subgraphs/arbitrum/src/treasury/Assets.ts#L66) | Full set of `TokenRecord` + `TokenSupply` at each event block |

The FRAX-USD feed emitted rounds approximately every hour on Arbitrum, giving roughly hourly snapshots. From block 451,191,255, the replacement aggregator takes over with the same trigger.

`handleBlock` (dead code) at [`Assets.ts:74`](../../subgraphs/arbitrum/src/treasury/Assets.ts#L74) is not referenced in `subgraph.yaml` and does not execute.

Records are stored via entity `.save()` calls inside the shared helper functions — the arrays returned by `generateTokenRecords` and `generateTokenSupplies` are not themselves persisted; each helper saves records individually.

---

## 7. Manual Offsets / Migration / Quirks

### JONES write-off (block 130,482,707)

Defined as `JONES_WRITE_OFF_BLOCK = "130482707"` at [`Constants.ts:48`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L48). At or after this block:
- ERC20 wallet balance records for JONES: `record.multiplier = BigDecimal.zero()`, `record.valueExcludingOhm` recalculated. Source: [`Contracts.ts:112-119`](../../subgraphs/arbitrum/src/contracts/Contracts.ts#L112).
- Jones staked balance records for JONES: same treatment. Source: [`JonesStaking.ts:121-127`](../../subgraphs/arbitrum/src/contracts/JonesStaking.ts#L121).
- JONES still appears in treasury market value (multiplier=1 applied to `value`), but is excluded from liquid backing (`valueExcludingOhm`=0).

### LUSD start block (block 80,000,000)

`LUSD_START_BLOCK = "80000000"` at [`Constants.ts:49`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L49). LUSD token balances are skipped entirely before this block because the Chainlink feed did not exist. Source: [`TokenBalances.ts:43-49`](../../subgraphs/arbitrum/src/treasury/TokenBalances.ts#L43).

### gOHM/OHM supply accounting start block (block 84,000,000)

`START_BLOCK = "84000000"` at [`OhmCalculations.ts:194`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L194). `getTreasuryOHMRecords` and `getProtocolOwnedLiquiditySupplyRecords` both return empty arrays before this block. Rationale per code comment: "Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports."

### Silo manual deployment entries (before block 130,482,707)

Two hard-coded `LendingMarketDeployment` entries for OHM deposited into the Silo lending market at [`Constants.ts:52-53`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L52):
- Block 99,067,079: 25,000 OHM to `SILO_ADDRESS` (`0x9992f660137979c1ca7f8b119cd16361594e3681`)
- Block 100,875,469: another 25,000 OHM to `SILO_ADDRESS`

After block 130,482,707 (`SILO_REPOSITORY_BLOCK`), the live `getSiloSupply()` is used instead, which reads the ERC20 balance of the hard-coded Silo OHM collateral token `0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae`. Sources: [`OhmCalculations.ts:20-21`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L20), [`OhmCalculations.ts:160-172`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L160).

### Sentiment manual deployment entries (before block 130,482,707)

One hard-coded entry at [`Constants.ts:56`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L56):
- Block 100,875,583: 5,000 OHM to `SENTIMENT_LTOKEN` (`0x37e6a0ecb9e8e5d90104590049a0a197e1363b67`)

After block 130,482,707 (`SENTIMENT_LOHM_BLOCK`), the live `getSentimentSupply()` is used, reading ERC20 balance of `SENTIMENT_LTOKEN`. Sources: [`OhmCalculations.ts:22-25`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L22), [`OhmCalculations.ts:173-186`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L173).

### gOHM Synapse — no index conversion on-chain

Per comment in [`OhmCalculations.ts:220-227`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L220): the OHM index is not available on the gOHM Synapse contract on Arbitrum. `TokenSupply` records are emitted with the raw gOHM balance; the **frontend** is expected to convert gOHM → OHM using the index.

### VSTA liquid-backing multiplier (0.77)

Static discount applied at token definition time in [`Constants.ts:66`](../../subgraphs/arbitrum/src/contracts/Constants.ts#L66). This is a permanent discount to `valueExcludingOhm`, not block-gated.

### Balancer MAGIC-USDC pool — disabled price handler

Price handler for `LP_BALANCER_POOL_MAGIC_USDC` is commented out in `PRICE_HANDLERS` at [`PriceLookup.ts:38`](../../subgraphs/arbitrum/src/price/PriceLookup.ts#L38) due to infinite-loop risk (GitHub issue #94). The pool ID is still in `ERC20_TOKENS_ARBITRUM` as POL, but no `TokenRecord` will be created for it because `getOwnedLiquidityBalance` calls `liquidityHandler.getTotalValue(...)` — without a price handler entry, this pool is never iterated in `getOwnedLiquidityBalances`.

### Grafting

The subgraph grafts onto `QmNQfMN2GjnGYx2mGo92gAc7z47fMbTMRR9M1gGEUjLZHX` at block 450,845,846. This means any Envio migration must reproduce historical data from block 10,950,000 or accept the graft point as the migration start. The comment in `subgraph.yaml` notes grafting exists because "it is abominably slow to index from scratch" on Arbitrum.

---

## 8. Chain-Specific Protocol Entities

### OlympusLender / Lending AMO

**Contract:** `0x868c3ae18fdea85bbb7a303e379c5b7e23b30f03` (`OLYMPUS_LENDER`) — ABI at [`abis/OlympusLender.json`](../../subgraphs/arbitrum/abis/OlympusLender.json).

**Computation:** at each snapshot block, `getLendingAMOOHMRecords` at [`OhmCalculations.ts:48-96`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L48):
1. Call `OlympusLender.try_activeAMOCount()` → get count.
2. For each index 0..count-1, call `try_activeAMOs(i)` → get AMO address.
3. For each AMO address, call `try_getDeployedOhm(amoAddress)` → get deployed OHM (uint256, 9 decimals).
4. If `deployedOhm > 0`, create a `TokenSupply` record of type `TYPE_LENDING` with multiplier `-1` (subtractive), source label `"Olympus Lender - {amoAddress}"`.

All three calls gracefully handle reverts by skipping. This is a **view-call** approach (not cumulative), pulling current deployed OHM at each snapshot.

### Silo Lending Market

Two phases — see §7 for block windows.

**Phase 1 (manual, blocks < 130,482,707):** Cumulative sum of `SILO_DEPLOYMENTS` entries active at the current block. Source: [`OhmCalculations.ts:98-141`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L98). Produces a `TokenSupply` of type `TYPE_LENDING`, multiplier `-1`, source = `getContractName(SILO_ADDRESS)`.

**Phase 2 (live, blocks >= 130,482,707):** [`getSiloSupply`](../../subgraphs/arbitrum/src/contracts/Silo.ts) reads ERC20 balance of the Silo OHM collateral token (`0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae`) across all wallets returned by `getWalletAddressesForContract(SILO_OHM_COLLATERAL_TOKEN)`. For each non-zero balance, creates a `TokenSupply` of type `TYPE_LENDING`, multiplier `-1`, pool label `"Silo"`, pool address = collateral token address.

### Sentiment Finance

Two phases — see §7 for block windows.

**Phase 1 (manual, blocks < 130,482,707):** Cumulative sum of `SENTIMENT_DEPLOYMENTS` entries. Same pattern as Silo manual phase.

**Phase 2 (live, blocks >= 130,482,707):** [`getSentimentSupply`](../../subgraphs/arbitrum/src/contracts/Sentiment.ts) reads ERC20 balance of `SENTIMENT_LTOKEN` (`0x37e6a0ecb9e8e5d90104590049a0a197e1363b67`) across all wallets from `getWalletAddressesForContract(SENTIMENT_LTOKEN)`. For each non-zero balance, creates a `TokenSupply` of type `TYPE_LENDING`, multiplier `-1`, pool label `"Sentiment lOHM"`, pool address = `SENTIMENT_LTOKEN`.

### Jones DAO Staking

**Contract:** `0xb94d1959084081c5a11c460012ab522f5a0fd756` (`JONES_STAKING`) — ABI at [`abis/JONESStaking.json`](../../subgraphs/arbitrum/abis/JONESStaking.json).

**Pool IDs indexed:** `[0]` (`JONES_STAKING_POOL_IDS`).

**Computation** at [`JonesStaking.ts:78-133`](../../subgraphs/arbitrum/src/contracts/JonesStaking.ts#L78): for each protocol wallet × pool ID:
1. Call `JONESStaking.try_poolInfo(poolId)` — get `lpToken` address; if it doesn't match the requested `tokenAddress`, skip.
2. Call `JONESStaking.deposited(poolId, walletAddress)` — get balance (using `lpToken` decimals).
3. Create a `TokenRecord` of type `getContractName(tokenAddress, "Staked")`.
4. If `block >= JONES_WRITE_OFF_BLOCK`, set `record.multiplier = 0` (excluded from liquid backing).

Unclaimed rewards are explicitly not included.

**Contribution to `TokenRecord`:** Staked JONES appears as an additional `TokenRecord` record for each wallet+pool combination that has a non-zero balance.

### TreasureDAO Atlas Mine (MAGIC staking)

**Contract:** `0xa0a89db1c899c49f98e6326b764bafcf167fc2ce` (`TREASURE_ATLAS_MINE`) — ABI at [`abis/TreasureMining.json`](../../subgraphs/arbitrum/abis/TreasureMining.json).

**Computation** at [`TreasureMining.ts:81-126`](../../subgraphs/arbitrum/src/contracts/TreasureMining.ts#L81): for each protocol wallet:
1. Call `TreasureMining.try_getAllUserDepositIds(walletAddress)` → get list of deposit IDs.
2. For each deposit ID, call `TreasureMining.userInfo(walletAddress, depositId).getDepositAmount()` — get MAGIC balance (hardcoded 18 decimals at [`TreasureMining.ts:68`](../../subgraphs/arbitrum/src/contracts/TreasureMining.ts#L68)).
3. Only runs when `tokenAddress == ERC20_MAGIC`.
4. Create a `TokenRecord` with `isLiquid = false` (locked), name suffix `"Staked"`, abbreviation `"veMAGIC"`.

**Contribution to `TokenRecord`:** Locked (illiquid) staked MAGIC. Separate record from wallet ERC20 balance.

### OHM Total Supply

At each snapshot, `getTotalSupply` at [`OhmCalculations.ts:27-38`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L27) calls `ERC20(ERC20_OHM).try_totalSupply()` and creates a `TokenSupply` record of type `TYPE_TOTAL_SUPPLY`.

### Protocol-Owned Liquidity OHM Supply

`getProtocolOwnedLiquiditySupplyRecords` at [`OhmCalculations.ts:277-328`](../../subgraphs/arbitrum/src/treasury/OhmCalculations.ts#L277) (only for blocks >= 84,000,000):
- Iterates `PRICE_HANDLERS` × `[ERC20_GOHM_SYNAPSE, ERC20_OHM]` × `CIRCULATING_SUPPLY_WALLETS`.
- For each handler that `matches` an OHM token and wallet with non-zero LP balance, calls `pairHandler.getUnderlyingTokenBalance(wallet, ohmToken, block)`.
- Creates a `TokenSupply` of type `TYPE_LIQUIDITY`, multiplier `-1`.

### Clearinghouse Receivables

_None._ The `CIRCULATING_SUPPLY_WALLETS` array contains the clearinghouse addresses (`COOLER_LOANS_CLEARINGHOUSE_V1`, `V1_1`, `V2`) from the shared wallet list, but there is no Arbitrum-specific clearinghouse receivables accounting. The clearinghouses may hold OHM that would be caught by `getTreasuryOHMRecords`, but no dedicated receivables computation exists for Arbitrum.

---

## 9. Tests in Tree

| File | Framework | Summary |
|---|---|---|
| [`tests/dummy.test.ts`](../../subgraphs/arbitrum/tests/dummy.test.ts) | Matchstick | Empty file (1 line). No behavior pinned. |
| [`tests/olympusLender.test.ts`](../../subgraphs/arbitrum/tests/olympusLender.test.ts) | Matchstick | Tests `getLendingAMOOHMRecords`. |
| [`tests/priceChainlink.test.ts`](../../subgraphs/arbitrum/tests/priceChainlink.test.ts) | Matchstick | Tests Chainlink-based price lookup for LUSD via `getPrice`. |
| [`tests/priceLookup.test.ts`](../../subgraphs/arbitrum/tests/priceLookup.test.ts) | Matchstick | Tests USDC base-token price lookup via `getPrice`, including case-insensitivity of token address and feed mock. |
| [`tests/chainlink.ts`](../../subgraphs/arbitrum/tests/chainlink.ts) | _(helper)_ | Shared mock helpers: `mockPriceFeed` (mocks `decimals` + `latestAnswer` on a Chainlink feed), `mockStablecoinsPriceFeeds` (mocks LUSD, USDC, WETH at price 1). Not a test file. |

### Edge-case coverage per test

**`olympusLender.test.ts`:**
- Pins that `getLendingAMOOHMRecords` returns one `TokenSupply` record per active AMO, with correct `source`, `sourceAddress`, `type = TYPE_LENDING`, `balance`, and negative `supplyBalance`.
- Pins revert-safety: if `activeAMOCount` reverts → returns empty array (no panic).
- Pins revert-safety: if `activeAMOs(i)` reverts → skips that AMO.
- Pins revert-safety: if `getDeployedOhm` reverts → skips that AMO.

**`priceChainlink.test.ts`:**
- Pins that `getPrice(ERC20_LUSD, block)` returns the Chainlink feed value (LUSD has a feed entry).

**`priceLookup.test.ts`:**
- Pins that `getPrice(ERC20_USDC)` returns the Chainlink feed value for USDC.
- Pins case-insensitivity: `getPrice("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8")` (mixed case) resolves correctly.
- Pins case-insensitivity: mock with mixed-case feed address also resolves correctly.

**Not tested in tree:**
- JONES write-off multiplier behavior.
- LUSD start-block skip.
- gOHM/OHM supply start-block guard (block 84,000,000).
- Silo and Sentiment manual vs. live phase transitions.
- Treasury OHM blacklist (OHM/gOHM excluded from `TokenRecord`).
- TreasureDAO staking (Atlas Mine).
- Jones staking staked-balance records.
- Same-token-set cycle guard in price routing.
- Owned-liquidity multiplier computation.

---

## 10. Open Questions for New Envio Implementation

1. **Grafting start block vs. full history.** The legacy subgraph grafts at block 450,845,846. For the Envio implementation, should indexing begin at the graft block (dropping pre-graft history) or at the original `startBlock` (10,950,000)? Arbitrum's block speed makes full re-indexing expensive. The plan document should clarify the acceptable data range.

2. **`handleBlock` dead code.** [`Assets.ts:74-78`](../../subgraphs/arbitrum/src/treasury/Assets.ts#L74) defines `handleBlock` but it is never called by the manifest. In the Envio implementation, should block-level triggering be introduced to replace the FRAX-USD `NewRound` pattern, or should the Envio indexer also be event-driven (using an equivalent HyperSync event or a different Chainlink feed's `NewRound` event)?

3. **jgOHM-gOHM pool (no price handler).** `LP_UNISWAP_V2_JONES_GOHM_GOHM` (`0x292d1587a6bb37e34574c9ad5993f221d8a5616c`) appears in `ERC20_TOKENS_ARBITRUM` as POL but has no entry in `PRICE_HANDLERS`. It appears this pool is intentionally unindexed (dead config). Should the Envio implementation preserve this omission or clean it up?

4. **Balancer MAGIC-USDC pool (disabled handler).** The price handler for this pool is commented out due to an infinite loop (issue #94). If the Envio price routing is re-architected (e.g., by eliminating recursive Balancer pricing), this pool could potentially be re-enabled. Confirm whether that is in scope for the migration.

5. **gOHM Synapse index conversion.** The legacy code creates `TokenSupply` records for gOHM Synapse with raw gOHM balances and delegates OHM conversion to the frontend (no index available on the Synapse bridge contract). Should the Envio implementation maintain this same pattern, or is there now an index source on Arbitrum that should be used?

6. **Silo collateral token hard-code.** In `getSiloSupply`, the Silo OHM collateral token is hardcoded to `0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae` with a comment: "Hard-coding this for now. If we wanted this to be generalisable, we would use the Silo Repository contract." The Silo repository address is defined as `0x8658047e48CC09161f4152c79155Dac1d710Ff0a`. Should the Envio implementation use the repository contract for dynamic lookup?

7. **SENTIMENT_LTOKEN wallet scope.** `getSentimentSupply` uses `getWalletAddressesForContract(SENTIMENT_LTOKEN)` from `Contracts.ts`, which does NOT apply the OHM/gOHM blacklist (that blacklist lives in `Constants.ts:getWalletAddressesForContract`). The Sentiment lOHM balance is fetched across the full protocol address list. This appears intentional (it's a lending market OHM token, not OHM itself), but should be confirmed.

8. **VSTA and JONES liquid-backing multipliers.** VSTA uses a static multiplier of `0.77` and JONES uses a runtime multiplier override to `0` after block 130,482,707. Both are domain decisions: are these values still current? Is there a governance record for these discounts?

9. **`LUSD_ALLOCATOR` / `LUSD_ALLOCATOR_V2` same address.** Both `LUSD_ALLOCATOR` and `LUSD_ALLOCATOR_V2` resolve to `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` (same address). This means the address appears twice in `WALLET_ADDRESSES`. The Envio implementation should de-duplicate to avoid double-counting — or confirm that `WALLET_ADDRESSES` is already de-duplicated at query time.

10. **`DAO_MULTISIG` == `CROSS_CHAIN_ARBITRUM`.** Both constants resolve to `0x012bbf0481b97170577745d2167ee14f63e2ad4c`. `getProtocolAddresses()` concatenates `WALLET_ADDRESSES` (which already includes `CROSS_CHAIN_ARBITRUM`) with `[DAO_MULTISIG]`, resulting in this address appearing twice. The de-duplication in `getWalletAddressesForContract` (`Contracts.ts:63-70`) handles this for the WETH whitelist, but the base `getProtocolAddresses()` array still has duplicates. Confirm whether this causes double-counting in balance summation.

11. **FRAX price routing.** FRAX is in the `PriceHandlerStablecoin` alongside USDC. The stablecoin handler presumably returns 1 USD for both. However, the event trigger is the FRAX-USD Chainlink aggregator's `NewRound` event — the price of FRAX is never actually used from this feed. Confirm whether `PriceHandlerStablecoin` uses the Chainlink feed for one of its tokens or simply returns 1 USD for all members.

12. **No block-interval guard.** Unlike some other chains' subgraphs, Arbitrum has no minimum block-interval check (e.g., "only process if block >= lastProcessedBlock + N"). Each `NewRound` event triggers a full snapshot. On Arbitrum with ~1 second block times, this could mean multiple snapshots per hour. Confirm whether the Envio implementation should introduce rate-limiting or match the legacy one-snapshot-per-`NewRound` cadence.
