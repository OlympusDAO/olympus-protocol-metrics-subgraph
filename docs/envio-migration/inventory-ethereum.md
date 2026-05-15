# Ethereum Subgraph Behavioral Inventory

This document exhaustively captures the behavior of the legacy Ethereum Graph subgraph at
`subgraphs/ethereum/` for use in the Envio HyperIndex migration. Every rule that affects
what ends up in `TokenRecord` or `TokenSupply` is cited with file:line references.

---

## 1. Manifest Summary

Source: [`subgraph.yaml`](../../subgraphs/ethereum/subgraph.yaml)

### Data Sources

| Name | Kind | Start Block | Contract Address | ABI | Entry Point |
|------|------|-------------|-----------------|-----|-------------|
| `ProtocolMetrics` | `ethereum/contract` | 14690000 | `0x0ab87046fBb341D058F17CBC4c1133F25a20a52f` (gOHM) | gOHM | block handler |
| `BondManager` | `ethereum/contract` | 16226955 | `0xf577c77ee3578c7f216327f41b5d7221ead2b2a3` | BondManager | event handler |
| `GnosisEasyAuction` | `ethereum/contract` | 16226955 | `0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101` | GnosisEasyAuction | event handler |

### Block Handler

- Handler: `handleMetricsBlock` ([`ProtocolMetrics.ts:82`](../../subgraphs/ethereum/src/protocolMetrics/ProtocolMetrics.ts#L82))
- Filter: polling every `2400` blocks (~8 hours at 5 blocks/min)
- Trigger: anchored to the `ProtocolMetrics` data source (gOHM contract address `0x0ab87046fBb341D058F17CBC4c1133F25a20a52f`)

### Event Handlers

| Event | Handler | File |
|-------|---------|------|
| `GnosisAuctionLaunched(uint256,address,uint96,uint48)` | `handleGnosisAuctionLaunched` | [`GnosisAuction.ts:10`](../../subgraphs/ethereum/src/GnosisAuction.ts#L10) |
| `AuctionCleared(indexed uint256,uint96,uint96,bytes32)` | `handleGnosisAuctionCleared` | [`GnosisAuction.ts:32`](../../subgraphs/ethereum/src/GnosisAuction.ts#L32) |

### ABI List (ProtocolMetrics data source)

Over 40 ABIs are bundled with the `ProtocolMetrics` data source:
OlympusStakingV1/V2/V3, sOlympusERC20/V2/V3, OlympusERC20, wsOHM, UniswapV2Pair, UniswapV3Pair, CirculatingSupply, ERC20, MasterChef, VeFXS, RariAllocator, BalancerVault, BalancerPoolToken, ConvexBaseRewardPool, CurvePool/V2, TokeAllocator, LUSDAllocatorV2, TokemakStaking, LQTYStaking, BalancerLiquidityGauge, gOHM, FraxSwapPool, vlCVX, AuraStaking/Locker/VirtualBalanceRewardPool, FraxFarm, MakerDSR, rlBTRFLY, ChainlinkPriceFeed, LiquityStabilityPool, ERC4626, UniswapV3PositionManager, BondManager, GnosisEasyAuction, BondFixedExpiryTeller, OlympusBoostedLiquidityRegistry/VaultLido, IncurDebt, CoolerLoansClearinghouse/MonoCooler, BophadesKernel/Treasury/ClearinghouseRegistry.

---

## 2. Tokens

Sources: [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts) lines 222–553

### OHM / Staking Tokens

| Symbol | Address | Category | Decimals | Active Block Window | Notes |
|--------|---------|----------|----------|---------------------|-------|
| OHM V1 | `0x383518188c0c6d7730d91b2c03a03c837814a899` | Volatile | 9 | genesis – ∞ | Blacklisted from treasury market value in protocol wallets; used as `ohmContractAddress` before block 13782589 |
| OHM V2 | `0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5` | Volatile | 9 | 13782589 – ∞ | `ERC20_OHM_V2_BLOCK = "13782589"` ([Constants.ts:225](../../subgraphs/ethereum/src/utils/Constants.ts#L225)); multiplier `BigDecimal.zero()` — value excluded from treasury MV when held by protocol wallets |
| sOHM V1 | `0x31932e6e45012476ba3a3a4953cba62aee77fbbe` | — | 9 | genesis – 12622596 | Used only for sOHM circulating supply before sOHM V2 block |
| sOHM V2 | `0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f` | — | 9 | 12622596 – 13806000 | `ERC20_SOHM_V2_BLOCK`; converted via wsOHM.sOHMTowOHM() for treasury OHM indexing after block 18260000 (`SOHM_V2_INDEX_BLOCK`) |
| sOHM V3 | `0x04906695D6D12CF5459975d7C3C03356E4Ccd460` | — | 9 | 13806000 – ∞ | `ERC20_SOHM_V3_BLOCK`; index() used to calculate migration offset; treasury OHM indexed after block 17115000 (`GOHM_INDEXING_BLOCK`) |
| gOHM | `0x0ab87046fBb341D058F17CBC4c1133F25a20a52f` | Volatile | 18 | genesis – ∞ | Multiplier `BigDecimal.zero()` — value 0 in market value; price = OHM price × current index; blacklisted from treasury wallets; treasury OHM indexed after block 17115000 |
| wsOHM | `0xCa76543Cf381ebBB277bE79574059e32108e3E65` | — | 18 | genesis – ∞ | V1 wrapper; used internally only for sOHM V2 → OHM conversion via `sOHMTowOHM()` |

### Stablecoin Tokens (ERC20_TOKENS)

| Symbol | Address | Category | Start Block | Notes |
|--------|---------|----------|-------------|-------|
| aDAI | `0x028171bca77440897b824ca71d1c56cac55b68a3` | Stable | genesis | Aave V2 aDAI receipt |
| aEthSUSDe | `0x4579a27af00a62c0eb156349f31b345c08386419` | Stable | 24707147 | Aave V3 sUSDe supply receipt; priced via sUSDe ERC4626 `convertToAssets()`, NOT a Chainlink feed |
| aEthUSDe | `0x4f5923fc5fd4a93352581b38b7cd26943012decf` | Stable | 24707147 | Aave V3 USDe supply receipt; priced via Chainlink USDe feed |
| varDebtEthUSDT | `0x6df1c1e379bc5a00a7b4c6e67a203333772f45a8` | Stable | 24707147 | Aave V3 variable debt USDT; **isLiability=true** — value subtracts from treasury |
| varDebtEthUSDC | `0x72e95b8931767c79ba4eee721354d6e99a61d004` | Stable | 24707147 | Aave V3 variable debt USDC; **isLiability=true** — value subtracts from treasury |
| DAI | `0x6b175474e89094c44da98b954eedeac495271d0f` | Stable | genesis | Chainlink feed: DAI/USD `0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9` |
| FEI | `0x956F47F50A910163D8BF957Cf5846D573E7f87CA` | Stable | genesis | |
| FRAX | `0x853d955acef822db058eb8505911ed77f175b99e` | Stable | genesis | Chainlink feed: FRAX/USD `0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd` |
| FRAX-3CRV | `0xd632f22692fac7611d2aa1c0d552930d43caed3b` | Stable | genesis | Priced at USDC rate (special case in `resolvePrice`) |
| FraxBP (CRV FRAX-USDC) | `0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC` | Stable | genesis | Priced at USDC rate (special case in `resolvePrice`) |
| LUSD | `0x5f98805a4e8be255a32880fdec7f6728c6568ba0` | Stable | 12178594 | Chainlink LUSD/USD feed: `0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Stable | genesis | Chainlink feed: USDC/USD `0x8fffffd4afb6115b954bd326cbe7b4ba576818f6` |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | Stable | 4634877 | Chainlink feed: USDT/USD `0x3e7d1eab13ad0104d2750b8863b489d65364e32d` |
| USDe | `0x4c9EDD5852cd905f086C759E8383e09bff1E68B3` | Stable | 20289094 | Chainlink USDe/USD feed: `0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961` |
| USDS | `0xdC035D45d973E3EC169d2276DDab16f1e407384F` | Stable | genesis | Uses DAI Chainlink feed (no USDS feed exists): `0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9` |
| UST | `0xa693b19d2931d498c5b318df961919bb4aee87a5` | Stable | 13408366 – 14730000 | Priced at $0 after block 14730000 (`ERC20_UST_BLOCK_DEATH`); special-cased in `resolvePrice` |
| bb-a-USD | `0xA13a9247ea42D743238089903570127DdA72fE44` | Stable | genesis | Priced at USDC rate (special case in `resolvePrice`) |
| cvxFRAX3CRV | `0xbe0f6478e0e4894cfb14f32855603a083a57c7da` | Stable | genesis | Staked version of FRAX-3CRV; listed in `ERC20_TOKENS` explicitly to force indexing |

### Volatile Tokens (ERC20_TOKENS)

| Symbol | Address | Category | IsLiquid | IsBluechip | Start Block | Notes |
|--------|---------|----------|----------|-----------|-------------|-------|
| agEUR | `0x1a7e4e63778b4f12a199c062f3efdd288afcbce8` | Volatile | true | false | genesis | |
| ALCX | `0xdbdb4d16eda451d0503b854cf79d55697f90c8df` | Volatile | true | false | genesis | |
| auraBal | `0x616e8BfA43F920657B3497DBf40D6b1A02D4608d` | Volatile | true | false | genesis | |
| vlAURA | `0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC` | Volatile | true | false | genesis | Locked 16 weeks; unstaked → AURA for pricing |
| AURA | `0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF` | Volatile | true | false | genesis | |
| BAL | `0xba100000625a3754423978a60c9317c58a424e3d` | Volatile | true | false | genesis | |
| BARNBRIDGE (BOND) | `0x0391D2021f89DC339F60Fff84546EA23E337750f` | Volatile | true | false | genesis | Hard-coded multiplier `0.77` (manual discount) |
| xBTRFLY (staked BTRFLY V1) | `0xCC94Faf235cC5D3Bf4bEd3a30db5984306c86aBC` | Volatile | true | false | genesis | |
| BTRFLY V1 | `0xc0d4ceb216b3ba9c3701b291766fdcba977cec3a` | Volatile | true | false | genesis | |
| rlBTRFLY | `0x742B70151cd3Bc7ab598aAFF1d54B90c3ebC6027` | Volatile | false | false | genesis | Illiquid; hard-coded multiplier `0.89` |
| BTRFLY V2 | `0xc55126051b22ebb829d00368f4b12bde432de5da` | Volatile | true | false | genesis | |
| 3CRV | `0x6c3f90f043a72fa612cbac8115ee7e52bde6e490` | Volatile | true | false | genesis | |
| CRV | `0xd533a949740bb3306d119cc777fa900ba034cd52` | Volatile | true | false | genesis | |
| cvxCRV | `0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7` | Volatile | true | false | genesis | Listed explicitly; not POL |
| vlCVX V1 | `0xd18140b4b819b895a3dba5442f959fa44994af50` | Volatile | true | false | 13153663 | |
| vlCVX V2 | `0x72a19342e8F1838460eBFCCEf09F6585e32db86E` | Volatile | true | false | genesis | Unlocked but not-yet-withdrawn balance indexed separately |
| CVX | `0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b` | Volatile | true | false | 12460000 | Hard-coded decimals=18 at block 14712001 due to overflow |
| FDT | `0xEd1480d12bE41d92F36f5f7bDd88212E381A3677` | Volatile | true | false | genesis | |
| FOX | `0xc770eefad204b5180df6a14ee197d99d808ee52d` | Volatile | true | false | genesis | |
| FPIS | `0xc2544a32872a91f4a553b404c6950e89de901fdb` | Volatile | true | false | 14482720 | |
| FXS | `0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0` | Volatile | true | false | 11465584 | |
| veFXS | `0xc8418af6358ffdda74e09ca9cc3fe03ca6adc5b0` | Volatile | false | false | 13833298 | Illiquid (locked till 2026); balanceOf returns boosted voting power, NOT FXS, so skipped in wallet iteration; balance retrieved via `VeFXS.locked()` in `getVeFXSAllocatorRecords` |
| KP3R | `0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44` | Volatile | true | false | genesis | |
| LDO | `0x5a98fcbea516cf06857215779fd812ca3bef1b32` | Volatile | true | false | genesis | |
| LQTY | `0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d` | Volatile | true | false | genesis | Staked balance indexed via LQTY Staking contract |
| PRIME (D2D) | `0x43d4a3cd90ddd2f8f4f693170c9c8098163502ad` | Volatile | true | false | genesis | |
| SUSHI | `0x6B3595068778DD592e39A122f4f5a5cF09C90fE2` | Volatile | true | false | genesis | |
| stETH | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | — | — | — | genesis | Commented out in ERC20_TOKENS (`// ERC20_TOKENS.set(ERC20_STETH, ...)`) — price lookup exists in LIQUIDITY_POOL_TOKEN_LOOKUP but token is NOT indexed |
| SYN | `0x0f2d719407fdbeff09d87557abb7232601fd9f29` | Volatile | true | false | genesis | |
| THOR | `0xa5f2211b9b8170f694421f2046281775e8468044` | Volatile | true | false | genesis | |
| TOKE | `0x2e9d63788249371f1dfc918a52f8d799f4a38c94` | Volatile | true | false | genesis | Staked balance indexed via TokemakStaking contract |
| TRIBE | `0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B` | Volatile | true | false | genesis | |
| WBTC | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | Volatile | true | true (bluechip) | genesis | |
| weETH | `0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee` | Volatile | true | true | 18961223 | |
| WETH | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` | Volatile | true | true | genesis | Chainlink feed: ETH/USD `0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419` |
| wstETH | `0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0` | Volatile | true | true | genesis | |
| xSUSHI | `0x8798249c2e607446efb7ad49ec89dd1865ff4272` | Volatile | true | false | genesis | |
| Native ETH | `0x0000000000000000000000000000000000000000` | Volatile | true | true | 21810000 | Indexed via `getNativeTokenBalances()`; start block `NATIVE_ETH_BLOCK = "21810000"` |

### ERC4626 Vault Tokens

| Symbol | Vault Address | Category | Start Block | Notes |
|--------|--------------|----------|-------------|-------|
| sDAI | `0x83F20F44975D03b1b09e64809B757c47f942BEeA` | Stable | genesis | Underlying: DAI; rate via `convertToAssets(1e18)` |
| sUSDe | `0x9D39A5DE30e57443BfF2A8307A4256c8797A3497` | Stable | 20289094 | Underlying: USDe; rate via `convertToAssets(1e18)` |
| sUSDS | `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` | Stable | genesis | Underlying: USDS; also used as a **base token** for OHM/sUSDS Univ3 pool pricing |
| Gauntlet sUSDS Vault | `0x3365184e87d2Bd75961780454A5810BEc956F0dD` | Stable | genesis | Underlying: sUSDS (itself an ERC4626); rate via `convertToAssets(1e18)` on this vault, then on sUSDS |

### Convex Staked LP Tokens (tracked as `CONVEX_STAKED_TOKENS`, not in ERC20_TOKENS directly)

| Underlying | Staked (Convex) Token | Category |
|-----------|----------------------|----------|
| FRAX-USDC (Curve LP) | `0x8a53ee42FB458D4897e15cc7dEa3F75D0F1c3475` | Stable |
| OHM-ETH (Curve LP) | `0x9bb0daf4361e1b84f5a44914595c46f07e9d12a4` | POL |
| OHM-FraxBP (Curve LP) | `0x81b0dCDa53482A2EA9eb496342dC787643323e95` | POL |
| CRV | cvxCRV `0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7` | Volatile |
| FRAX-3CRV | cvxFRAX3CRV `0xbe0f6478e0e4894cfb14f32855603a083a57c7da` | Stable |
| FXS | cvxFXS `0xfeef77d3f69374f66429c91d732a244f074bdf74` | Volatile |

### Frax Staked Tokens

| Underlying | Staked (Frax) Token | Category |
|-----------|---------------------|----------|
| FRAX-USDC (Curve LP) | `0x8a53ee42FB458D4897e15cc7dEa3F75D0F1c3475` | Stable |
| OHM-FraxBP (Curve LP) | `0x81b0dCDa53482A2EA9eb496342dC787643323e95` | POL |

### Aura Staked BPT Tokens

| Underlying BPT | Aura Staked Address | Category |
|---------------|---------------------|----------|
| auraBal | auraBal (self) | Volatile |
| OHM-DAI-WETH BPT | `0x622A725a79C7fE37AD839C640cD62d546712B3A9` | POL |
| OHM-DAI BPT | `0xB23Dfc0C4502a271976F1ee65321C51Be2529640` | POL |
| OHM-WETH BPT | `0xA02D8861FBFD0bA3D8EbaFA447Fe7680a3FA9a93` | POL |
| OHM-wstETH BPT | `0x0EF97ef0e20F84e82ec2D79CBD9Eda923C3DAF09` | POL |

### Unstaked Token Mappings (for pricing)

[`Constants.ts:685-689`](../../subgraphs/ethereum/src/utils/Constants.ts#L685)

| Staked/Locked | Priced As |
|--------------|-----------|
| vlAURA | AURA |
| vlCVX V1 | CVX |
| vlCVX V2 | CVX |
| veFXS | FXS |

---

## 3. Wallets

Sources: [`ProtocolAddresses.ts`](../../subgraphs/ethereum/src/utils/ProtocolAddresses.ts), [`Wallets.ts`](../../subgraphs/shared/src/Wallets.ts), [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts)

### Core Protocol Addresses (`PROTOCOL_ADDRESSES` / `getWalletAddressesForContract`)

[`ProtocolAddresses.ts:99-128`](../../subgraphs/ethereum/src/utils/ProtocolAddresses.ts#L99)

| Name | Address | Role | Active Window | Notes |
|------|---------|------|---------------|-------|
| Treasury V1 | `0x886CE997aa9ee4F8c2282E182aB72A705762399D` | Treasury | genesis – ∞ | Replaced by V2 at block 12525281 but still indexed |
| Treasury V2 | `0x31f8cc382c9898b273eff4e0b7626a6987c846e8` | Treasury | 12525281 – ∞ | `TREASURY_ADDRESS_V2_BLOCK` |
| Treasury V3 | `0x9A315BdF513367C0377FB36545857d12e85813Ef` | Treasury | 13805100 – ∞ | `TREASURY_ADDRESS_V3_BLOCK` |
| TRSRY (Bophades) | resolved via Kernel `getModuleForKeycode("TRSRY")` | OlympusV3 Treasury | dynamic | Added dynamically per block; can be V1.0 `0xa8687A15D4BE32CC8F0a8a7B9704a4C3993D9613` or V1.1 `0xea1560F36F71a2F54deFA75ed9EaA15E8655bE22` |
| Bonds Deposit | `0x9025046c6fb25Fb39e720d97a8FD881ED69a1Ef6` | Bond depository | genesis – 19070000 | Removed from OHM supply calc after `BOND_DEPOSITORY_BLOCK = "19070000"` |
| Bonds Inverse Deposit | `0xBA42BE149e5260EbA4B82418A6306f55D532eA47` | Inverse bond | genesis – ∞ | OHM here is considered burned |
| DAO Wallet | `0x245cc372c84b3645bf0ffe6538620b04a217988b` | DAO | genesis – ∞ | Also listed in `CONVEX_ALLOCATORS` |
| DAO Working Capital | `0xF65A665D650B5De224F46D729e2bD0885EeA9dA5` | DAO working capital | genesis – ∞ | |
| Buyback MS | `0xf7deb867e65306be0cb33918ac1b8f89a72109db` | Buyback multisig | 20514801 – ∞ | OHM/gOHM included in treasury MV only after `OHM_IN_MARKET_VALUE_BLOCK = 20514801`; excluded from protocol OHM blacklist after this block |
| Yield Farming MS | `0x2075e3b46470cfcE124Daaf52b46Dcf965727Dd1` | Yield farming | 24707147 – ∞ | Start block `ERC20_AETH_SUSDE_START_BLOCK`; holds aEthSUSDe loop |
| Olympus Association | `0x4c71db02aeeb336cbd8f3d2cc866911f6e2fbd94` | Association (not protocol) | genesis – 17115000 | Removed from OHM supply wallets after `OLYMPUS_ASSOCIATION_BLOCK = "17115000"` |
| AAVE Allocator | `0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4` | AAVE V2 | genesis – ∞ | |
| AAVE Allocator V2 | `0x0d33c811d0fcc711bcb388dfb3a152de445be66f` | AAVE V2 | 14375500 – ∞ | `AAVE_ALLOCATOR_V2_BLOCK` |
| AURA Allocator | `0x872ebDd8129Aa328C89f6BF032bBD77a4c4BaC7e` | Aura | genesis – ∞ | |
| AURA Allocator V2 | `0x8CaF91A6bb38D55fB530dEc0faB535FA78d98FaD` | Aura | genesis – ∞ | |
| Balancer Allocator | `0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6` | Balancer | genesis – ∞ | Comment in source: "Incorrect?" |
| Convex Allocator 1 | `0x3dF5A355457dB3A4B5C744B8623A7721BF56dF78` | Convex | 13027359 – ∞ | |
| Convex Allocator 2 | `0x408a9A09d97103022F53300A3A14Ca6c3FF867E8` | Convex | 13308077 – ∞ | |
| Convex Allocator 3 | `0xDbf0683fC4FC8Ac11e64a6817d3285ec4f2Fc42d` | Convex | 13920000 – ∞ | |
| Convex CVX Allocator | `0xdfc95aaf0a107daae2b350458ded4b7906e7f728` | Convex CVX | genesis – 22278800 | Removed from wallet list after `CONVEX_ALLOCATOR_DEATH = "22278800"` (bricked allocator) |
| Convex CVX VL Allocator | `0x2d643df5de4e9ba063760d475beaa62821c71681` | Convex vlCVX | genesis – ∞ | |
| Convex Staking Proxy FraxBP | `0x943C1dfA7dA96e54242bD2c78DD3eF5C7b24b18C` | Convex | genesis – ∞ | |
| Convex Staking Proxy OHM-FraxBP | `0x75E7f7D871F4B5db0fA9B0f01B7422352Ec9618f` | Convex | genesis – ∞ | |
| LUSD Allocator | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Liquity | 14397867 – ∞ | `LUSD_ALLOCATOR_BLOCK` |
| LUSD Allocator V2 | `0x97b3ef4c558ec456d59cb95c65bfb79046e31fca` | Liquity V2 | — | Same address as V1 |
| Maker DSR Allocator | `0x0EA26319836fF05B8C5C5afD83b8aB17dd46d063` | Maker DSR | genesis – ∞ | |
| Maker DSR Allocator Proxy | `0x5db0761487e26B555F5Bfd5E40F4CBC3E1a7d11E` | Maker DSR proxy | genesis – ∞ | |
| OTC Escrow | `0xe3312c3f1ab30878d9686452f7205ebe11e965eb` | OTC | genesis – ∞ | |
| Rari Allocator | `0x061C8610A784b8A1599De5B1157631e35180d818` | Rari | 14550000 – ∞ | `RARI_ALLOCATOR_BLOCK` |
| VeFXS Allocator | `0xde7b85f52577b113181921a7aa8fc0c22e309475` | FXS | genesis – ∞ | |
| Myso Lending | `0xb339953fc028b9998775c00594a74dd1488ee2c6` | Lending | genesis – ∞ | NOT in PROTOCOL_ADDRESSES; hard-coded amounts |
| Vendor Lending | `0x83234a159dbd60a32457df158fafcbdf3d1ccc08` | Lending | genesis – ∞ | NOT in PROTOCOL_ADDRESSES; hard-coded amounts |

### Clearinghouse Addresses (dynamic)

[`Bophades.ts:88`](../../subgraphs/ethereum/src/utils/Bophades.ts#L88) — fetched from `CHREG` module via Kernel. Three hard-coded fallbacks are always added if not already in registry:

| Name | Address | Role |
|------|---------|------|
| Cooler Loans Clearinghouse V1 | `0xD6A6E8d9e82534bD65821142fcCd91ec9cF31880` | Cooler V1 |
| Cooler Loans Clearinghouse V1.1 | `0xE6343ad0675C9b8D3f32679ae6aDbA0766A2ab4c` | Cooler V1.1 |
| Cooler Loans Clearinghouse V2 | `0x1e094fE00E13Fd06D64EeA4FB3cD912893606fE0` | Cooler V2 |

### OHM / gOHM / sOHM Blacklist in Protocol Wallets

[`ProtocolAddresses.ts:130-141`](../../subgraphs/ethereum/src/utils/ProtocolAddresses.ts#L130) — All addresses in `PROTOCOL_ADDRESSES` are blacklisted for OHM V1, OHM V2, gOHM, sOHM V1/V2/V3. This prevents protocol-owned OHM from being counted in treasury market value.

**Exception**: Buyback MS (`0xf7deb867e65306be0cb33918ac1b8f89a72109db`) is removed from the blacklist after block `OHM_IN_MARKET_VALUE_BLOCK = 20514801`, meaning OHM/gOHM in the Buyback MS IS counted in market value after that block.

### Cross-Chain Bridges (not in protocol wallets, informational only)

| Name | Address |
|------|---------|
| Cross-Chain Arbitrum | `0x012bbf0481b97170577745d2167ee14f63e2ad4c` |
| Cross-Chain Fantom | `0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10` |
| Cross-Chain Polygon | `0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7` |

### Migration Contract (special-cased)

[`Constants.ts:76`](../../subgraphs/ethereum/src/utils/Constants.ts#L76)

Address: `0x184f3fad8618a6f458c16bae63f70c426fe784b3`

OHM V1, wsOHM, and gOHM in this contract are NOT counted as protocol assets. A manual migration offset (see section 7) accounts for stranded gOHM.

### Circulating Supply Wallets

[`Constants.ts:210-220`](../../subgraphs/ethereum/src/utils/Constants.ts#L210) — subset used in `getTreasuryOHMRecords()`:

`BONDS_DEPOSIT`, `BONDS_INVERSE_DEPOSIT`, `BUYBACK_MS`, `DAO_WALLET`, `DAO_WORKING_CAPITAL`, `OTC_ESCROW`, `TREASURY_ADDRESS_V1`, `TREASURY_ADDRESS_V2`, `TREASURY_ADDRESS_V3`

---

## 4. Price Feeds and Routing

### Chainlink Price Feeds

Source: [`PriceChainlink.ts`](../../subgraphs/ethereum/src/utils/PriceChainlink.ts)

| Token | Feed Address | Notes |
|-------|-------------|-------|
| aDAI | `0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9` | Same as DAI |
| aEthUSDe | `0xa569d910839ae8865da8f8e70fffb0cba869f961` | USDe/USD (~$1) |
| varDebtEthUSDT | `0x3e7d1eab13ad0104d2750b8863b489d65364e32d` | USDT/USD (~$1) |
| varDebtEthUSDC | `0x8fffffd4afb6115b954bd326cbe7b4ba576818f6` | USDC/USD (~$1) |
| DAI | `0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9` | DAI/USD |
| FRAX | `0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd` | FRAX/USD |
| LUSD | `0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0` | LUSD/USD |
| USDC | `0x8fffffd4afb6115b954bd326cbe7b4ba576818f6` | USDC/USD |
| USDT | `0x3e7d1eab13ad0104d2750b8863b489d65364e32d` | USDT/USD |
| USDe | `0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961` | USDe/USD |
| USDS | `0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9` | Uses DAI feed (no USDS feed exists) |
| WETH | `0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419` | ETH/USD |

These Chainlink feeds are the **base tokens** (`isBaseToken()` returns true for tokens in `tokenPriceFeedMap`). Any pair containing one of these as a leg uses the feed value directly.

### ERC4626 Base Tokens

[`PriceBase.ts:28-39`](../../subgraphs/ethereum/src/utils/PriceBase.ts#L28)

sUSDS (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`) is also treated as a base token — its price is fetched via `ERC4626.convertToAssets(1e18)` → underlying USDS rate → DAI Chainlink feed.

### OHM Price Routing

[`Price.ts:405-461`](../../subgraphs/ethereum/src/utils/Price.ts#L405)

OHM price (`getBaseOhmUsdRate`) picks the pair with the **largest non-OHM reserves** from `OHM_PRICE_PAIRS`:

| Priority | Pool | Type |
|----------|------|------|
| 1 | OHM-DAI V2 UniswapV2 (`0x055475920a8c93cffb64d039a8205f7acc7722d3`) | UniswapV2 |
| 2 | OHM-DAI-WETH Balancer (`POOL_BALANCER_OHM_DAI_WETH_ID`) | Balancer |
| 3 | OHM-DAI Balancer (`POOL_BALANCER_OHM_DAI`) | Balancer |
| 4 | WETH-OHM UniswapV3 (`0x88051b0eea095007d3bef21ab287be961f3d8598`) | UniswapV3 |
| 5 | OHM-sUSDS UniswapV3 (`0x0858e2B0F9D75f7300B38D64482aC2C8DF06a755`) | UniswapV3 |

Selection is dynamic at every block — not a fixed priority list. The one with highest non-OHM TVL wins.

### gOHM Price Routing

[`Price.ts:607-609`](../../subgraphs/ethereum/src/utils/Price.ts#L607)

`gOHM price = OHM price × getCurrentIndex(blockNumber)` — uses sOHM V3 `index()`.

### Special Price Overrides in `resolvePrice`

[`Price.ts:578-647`](../../subgraphs/ethereum/src/utils/Price.ts#L578)

1. **UST after block 14730000**: forced to `$0` — hard-coded in `resolvePrice`
2. **Contract before start block**: returns `$0`; checked via `contractExistsAtBlock()`
3. **NATIVE_ETH**: mapped to WETH address for price lookup
4. **Base tokens** (Chainlink feed tokens): resolved directly via `getBaseTokenRate()`
5. **OHM V1/V2**: resolved via `getBaseOhmUsdRate()`
6. **gOHM**: `OHM price × current index`
7. **bb-a-USD, cvxFRAX3CRV, FRAX-3CRV, FraxBP**: hardcoded to USDC Chainlink rate
8. **All others**: resolved via `LIQUIDITY_POOL_TOKEN_LOOKUP` map

### Token → Price-Lookup Pair Routing (`LIQUIDITY_POOL_TOKEN_LOOKUP`)

[`Constants.ts:807-959`](../../subgraphs/ethereum/src/utils/Constants.ts#L807)

Key non-obvious routings:

| Token | Pair/Method | Type |
|-------|-------------|------|
| agEUR | AGEUR-USDC UniswapV3 | UniswapV3 |
| aEthSUSDe | sUSDe ERC4626 vault | ERC4626 (NOT Chainlink) |
| ALCX | ALCX-ETH UniswapV2 | UniswapV2 |
| auraBal | graviAURA-auraBal-WETH Balancer | Balancer |
| vlAURA | AURA-WETH Balancer (priced as AURA) | Balancer |
| AURA | AURA-WETH Balancer | Balancer |
| BAL | BAL-WETH Balancer | Balancer |
| BARNBRIDGE | BOND-USDC UniswapV2 | UniswapV2 |
| BTRFLY V1/xBTRFLY | WETH-BTRFLY V1 UniswapV3 | UniswapV3 |
| rlBTRFLY/BTRFLY V2 | WETH-BTRFLY V2 UniswapV3 | UniswapV3 |
| 3CRV | 3CRV-USD UniswapV3 | UniswapV3 |
| OHM-FraxBP (Curve LP) | OHM-FraxBP Curve pool | Curve |
| cvxFXS | FXS-cvxFXS Curve | Curve |
| vlCVX V1 / vlCVX V2 / CVX | CVX-ETH UniswapV2 | UniswapV2 |
| FPIS | FPIS-FRAX UniswapV3 | UniswapV3 |
| FraxBP | FRAX-USDC Curve | Curve |
| veFXS | FXS-ETH UniswapV3 | UniswapV3 |
| FXS | FXS-ETH UniswapV3 | UniswapV3 |
| LDO | LDO-WETH UniswapV3 | UniswapV3 |
| LQTY | LQTY-WETH UniswapV3 | UniswapV3 |
| PRIME (D2D) | D2D-USDC Balancer | Balancer |
| weETH | weETH-WETH UniswapV3 | UniswapV3 |
| WSTETH | WETH-wstETH UniswapV3 | UniswapV3 |
| sDAI | sDAI ERC4626 | ERC4626 |
| sUSDe | sUSDe ERC4626 | ERC4626 |
| sUSDS | sUSDS ERC4626 | ERC4626 |
| Gauntlet sUSDS Vault | Gauntlet vault ERC4626 | ERC4626 |
| Native ETH | USDC-ETH UniswapV2 | UniswapV2 |

### Deprecated ETH/USD Rate

[`PriceBase.ts:123-147`](../../subgraphs/ethereum/src/utils/PriceBase.ts#L123) — `getBaseEthUsdRate()` is marked `@deprecated` and uses the USDC-ETH UniswapV2 pair (`0x397ff1542f962076d0bfe58ea045ffa2d347aca0`). Still called by `getUSDRateUniswapV2` when `contractAddress == WETH`.

---

## 5. Liquidity Pools / Handlers

### UniswapV2 Pools (Protocol-Owned Liquidity)

Source: [`Constants.ts:1047-1068`](../../subgraphs/ethereum/src/utils/Constants.ts#L1047) (`LIQUIDITY_OWNED` array), [`LiquidityUniswapV2.ts`](../../subgraphs/ethereum/src/liquidity/LiquidityUniswapV2.ts)

| Pool | Address | Tokens | Start Block | Notes |
|------|---------|--------|-------------|-------|
| OHM V1-DAI SLP | `0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c` | OHM V1 / DAI | genesis | V1 OHM pool |
| OHM V2-DAI SLP V2 | `0x055475920a8c93cffb64d039a8205f7acc7722d3` | DAI / OHM V2 | 13827000 | Primary OHM price source (largest reserves) |
| OHM V1-ETH SLP | `0xfffae4a0f4ac251f4705717cd24cadccc9f33e06` | WETH / OHM V1 | 12310798 | |
| OHM V2-ETH SLP V2 | `0x69b81152c5a8d35a67b32a4d3772795d96cae4da` | WETH / OHM V2 | 13805112 | |
| OHM V1-FRAX | `0x2dce0dda1c2f98e0f171de8333c3c6fe1bbf4877` | OHM V2 / FRAX | 12563434 | Note: V1 pool but token listed as OHM V2 in LIQUIDITY_PAIR_TOKENS |
| OHM V2-FRAX V2 | `0xb612c37688861f1f90761dc7f382c2af3a50cc39` | OHM V2 / FRAX | 13824000 | |
| OHM V1-LUSD | `0xfdf12d1f85b5082877a6e070524f50f6c84faa6b` | LUSD / OHM V1 | 13327921 | |
| OHM V2-LUSD V2 | `0x46E4D8A1322B9448905225E52F914094dBd6dDdF` | LUSD / OHM V2 | 14381693 | |
| OHM-BTRFLY V1 | `0xe9ab8038ee6dd4fcc7612997fe28d4e22019c4b4` | OHM V2 / BTRFLY V1 | genesis | |

Balance lookup uses `getReserves()` + `balanceOf(walletAddress)` on the LP token for wallet holdings. The pool shares owned by each protocol wallet are calculated as `walletLPBalance / totalSupply * poolReserves`.

### UniswapV3 Pools (Protocol-Owned Liquidity via NFT positions)

Sources: [`LiquidityUniswapV3.ts`](../../subgraphs/ethereum/src/liquidity/LiquidityUniswapV3.ts), [`Constants.ts:997`](../../subgraphs/ethereum/src/utils/Constants.ts#L997)

Position Manager: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` (`UNISWAP_V3_POSITION_MANAGER`)

| Pool | Address | Tokens | Notes |
|------|---------|--------|-------|
| WETH-OHM | `0x88051b0eea095007d3bef21ab287be961f3d8598` | OHM V2 / WETH | Major OHM price pool; POL via NFT |
| OHM-sUSDS | `0x0858e2B0F9D75f7300B38D64482aC2C8DF06a755` | OHM V2 / sUSDS | New OHM price pool |

**NFT Position Accounting**: For each protocol wallet, `positionManager.balanceOf(wallet)` is called, then each NFT position ID is iterated via `tokenOfOwnerByIndex`. Per position: `getPairBalances()` calculates token amounts from `liquidity`, `sqrtPriceX96`, `tickLower`, `tickUpper` using the Uniswap V3 math (integer approximation via `getSqrtRatioAtTick`). OHM-containing value is excluded from `valueExcludingOhm` by computing a `multiplier = includedValue / totalValue`. Records are aggregated per wallet (not per position ID).

[`LiquidityUniswapV3.ts:200-221`](../../subgraphs/ethereum/src/liquidity/LiquidityUniswapV3.ts#L200)

### Curve Pools

Source: [`LiquidityCurve.ts`](../../subgraphs/ethereum/src/liquidity/LiquidityCurve.ts), [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts)

| Pool | Address | Tokens | Convex Staking | Frax Locking |
|------|---------|--------|----------------|--------------|
| OHM-ETH | `0x6ec38b3228251a0C5D491Faf66858e2E23d7728B` | OHM V2 / native ETH (+ WETH) | `0xd683C7051a28fA150EB3F4BD92263865D4a67778` | none |
| OHM-FraxBP | `0xFc1e8bf3E81383Ef07Be24c3FD146745719DE48D` | OHM V2 / FraxBP | `0x27A8c58e3DE84280826d615D80ddb33930383fE9` | `0xc96e1a26264D965078bd01eaceB129A65C09FFE7` |
| FRAX-USDC (FraxBP) | `0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2` | FRAX / USDC | `0x7e880867363A7e321f5d260Cade2B0Bb2F717B02` | `0x963f487796d54d2f27bA6F3Fbe91154cA103b199` |

Curve pool LP token address resolved via:
- `CurvePool.token()` — used by most pools
- `CurvePoolV2.lp_token()` — fallback for FRAX-USDC pool

Pool balances use `CurvePool.balances(index)` for coins 0 and 1. Convex staked balances are fetched via `ConvexBaseRewardPool.balanceOf(wallet)`. Frax locked balances via `FraxFarm.lockedLiquidityOf(wallet)`.

### FraxSwap Pools (TWAMM)

Source: [`LiquidityFraxSwap.ts`](../../subgraphs/ethereum/src/liquidity/LiquidityFraxSwap.ts)

| Pool | Address | Tokens | Notes |
|------|---------|--------|-------|
| FraxSwap V1 OHM-FRAX | `0x38633ed142bcc8128b45ab04a2e4a6e53774699f` | OHM V2 / FRAX | TWAMM |
| FraxSwap V2 OHM-FRAX | `0x5769071665eb8Db80e7e9226F92336Bb2897DCFA` | OHM V2 / FRAX | TWAMM |

Uses `FraxSwapPool.getReserves()` (same ABI as UniswapV2Pair). Snapshot caches `token0/token1/balances/decimals/totalSupply`. Wallet LP balance divided by total supply to get proportional reserves.

### Balancer Pools

Source: [`LiquidityBalancer.ts`](../../subgraphs/ethereum/src/liquidity/LiquidityBalancer.ts), [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts)

Vault: `0xba12222222228d8ba445958a75a0704d566bf2c8`

| Pool Name | Pool ID | BPT Address | Aura Staking | Gauge |
|-----------|---------|-------------|--------------|-------|
| OHM-DAI-WETH | `0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e` | `0xc45D42f801105e861e86658648e3678aD7aa70f9` | `0xF01e29461f1FCEdD82f5258Da006295E23b4Fab3` | `0x852CF729dEF9beB9De2f18c97a0ea6bf93a7dF8B` |
| OHM-DAI | `0x76fcf0e8c7ff37a47a799fa2cd4c13cde0d981c90002000000000000000003d2` | `0x76FCf0e8C7Ff37A47a799FA2cd4c13cDe0D981C9` | `0xB9D6ED734Ccbdd0b9CadFED712Cf8AC6D0917EcD` | `0x107A2209883621aFe2968da31C03190e0B2782C2` |
| OHM-WETH | `0xd1ec5e215e8148d76f4460e4097fd3d5ae0a35580002000000000000000003d3` | `0xD1eC5e215E8148D76F4460e4097FD3d5ae0A3558` | `0x978653c02f2fbbdfd67cbc7f45c42262f213e0b5` | `0x5f2c3422a675860f0e019Ddd78C6fA681bE84bd4` |
| OHM-wstETH | `0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e` | `0xd4f79CA0Ac83192693bce4699d0c10C66Aa6Cf0F` | `0x636024f9ddef77e625161b2ccf3a2adfbfad3615` | `0xE879f17910E77c01952b97E4A098B0ED15B6295c` |
| WETH-FDT | `0x2d344a84bac123660b021eebe4eb6f12ba25fe8600020000000000000000018a` | `0x2D344A84BaC123660b021EEbE4eB6F12ba25fe86` | none | `0xbd0dae90cb4a0e08f1101929c2a01eb165045660` |
| OHM-BTRFLY V2 | `0x2de32a7c98c3ef6ec79e703500e8ca5b2ec819aa00020000000000000000031c` | `0x2de32a7c98c3ef6ec79e703500e8ca5b2ec819aa` | none | none |
| AURA-WETH | `0xc29562b045d80fd77c69bec09541f5c16fe20d9d000200000000000000000251` | `0xc29562b045D80fD77c69Bec09541F5c16fe20d9d` | none | none (price lookup only) |
| BAL-WETH | `0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014` | `0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56` | none | none (price lookup only) |
| graviAURA-auraBal-WETH | `0x0578292cb20a443ba1cde459c985ce14ca2bdee5000100000000000000000269` | `0x0578292CB20a443bA1CdE459c985CE14Ca2bDEe5` | none | none (price lookup only) |
| wstETH-WETH | `0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080` | `0x32296969ef14eb0c6d29669c550d4a0449130230` | none | none (price lookup only) |
| D2D-USDC | `0x27c9f71cc31464b906e0006d4fcbc8900f48f15f00020000000000000000010f` | — | none | none (price lookup for PRIME) |

Balancer pool data (`getPoolTokens`, `getPool`) is fetched once per block and cached in `BalancerPoolSnapshot` entities. Wallet LP balances come from: direct ERC20 `balanceOf`, Aura staking `stakedBalance`, and Balancer gauge `balanceOf`. Normalized weights from `BalancerPoolToken.getNormalizedWeights()` are used for the spot-price formula in price lookups.

**Aura Staking Contracts**:
- Stable reward pool: `0x62D7d772b2d909A0779d15299F4FC87e34513c6d`
- auraBal: `0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2`
- OHM-DAI-WETH: `0xF01e29461f1FCEdD82f5258Da006295E23b4Fab3`
- OHM-WETH: `0x978653c02f2fbbdfd67cbc7f45c42262f213e0b5`
- OHM-DAI: `0xB9D6ED734Ccbdd0b9CadFED712Cf8AC6D0917EcD`
- OHM-wstETH: `0x636024f9ddef77e625161b2ccf3a2adfbfad3615`

**Balancer Gauges**: Indexed for wallet balance lookups — `BalancerLiquidityGauge.balanceOf(wallet)`.

### Aura Pools (Wrapped Balancer LP)

Source: [`ContractHelper.ts`](../../subgraphs/ethereum/src/utils/ContractHelper.ts), [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts)

Aura is not a separate liquidity type — it uses the same Balancer pool math, but additionally:
1. Checks Aura staking contract `stakedBalance(wallet)` for the staked BPT amount
2. Checks `AuraVirtualBalanceRewardPool.earned(wallet)` for unclaimed reward tokens
3. Locked AURA via `AuraLocker.balances(wallet)` (for AURA token balance)

### Convex Pools (Wrapped Curve LP)

Source: [`ContractHelper.ts`](../../subgraphs/ethereum/src/utils/ContractHelper.ts), [`Constants.ts`](../../subgraphs/ethereum/src/utils/Constants.ts)

| Pool | Convex Reward Pool | Staked Token |
|------|--------------------|--------------|
| CRV (plain) | `0x3fe65692bfcd0e6cf84cb1e7d24108e434a7587e` | cvxCRV |
| FRAX-3CRV | `0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e` | cvxFRAX3CRV |
| FRAX-USDC | `0x7e880867363A7e321f5d260Cade2B0Bb2F717B02` | cvxFRAX-USDC-staked |
| OHM-ETH | `0xd683C7051a28fA150EB3F4BD92263865D4a67778` | cvxOHMETH |
| OHM-FraxBP | `0x27A8c58e3DE84280826d615D80ddb33930383fE9` | cvxOHMFraxBP |

Staked balance: `ConvexBaseRewardPool.balanceOf(wallet)`. The balance is attributed to the underlying (unstaked) LP token.

### ERC4626 Vaults

Source: [`ERC4626.ts`](../../subgraphs/ethereum/src/utils/ERC4626.ts)

Handled separately from the liquidity pool system. For each vault in `ERC4626_TOKENS`:
1. `vaultContract.asset()` → underlying token address
2. `getUSDRate(underlying)` → underlying USD price
3. `vaultContract.convertToAssets(10^decimals)` → shares-to-assets ratio
4. `rate = underlyingPrice × sharesRatio`
5. `vaultContract.balanceOf(wallet)` → shares held per wallet

Vaults: sDAI, sUSDe, sUSDS, Gauntlet sUSDS Vault.

**Note on aEthSUSDe pricing**: aEthSUSDe is NOT in `ERC4626_TOKENS` — it is in `ERC20_TOKENS` (Stable). Its price routes through `LIQUIDITY_POOL_TOKEN_LOOKUP` → `PairHandlerTypes.ERC4626` → sUSDe vault. This allows `getStablecoinBalance()` to pick it up, while the rate is still obtained via `sUSDe.convertToAssets()`.

### Other Custom Handlers in ContractHelper

| Protocol | Contract | Method | What It Returns |
|----------|---------|--------|----------------|
| Liquity Stability Pool | `0x66017d22b0f8556afdd19fc67041899eb65a21bb` | `deposits(wallet)`, `getDepositorETHGain(wallet)`, `getDepositorLQTYGain(wallet)` | LUSD, WETH, and LQTY balances for LUSD allocator |
| LQTY Staking | `0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d` | `stakes(wallet)` | LQTY staked balance |
| Maker DSR | `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7` | `chi()` (DSR accumulator), DAI-in-DSR balance | DAI value in DSR |
| Rari Allocator | `0x061C8610A784b8A1599De5B1157631e35180d818` | `amountAllocated(id)` | token balance by ID (DAI=3, LUSD=1, TRIBE=4, TOKE=9) |
| Toke Allocator | `0x0483DE8C11eE2f0538a29F0C294246677cbC92F5` | custom balance function | TOKE balance |
| TokemakStaking | `0x96f98ed74639689c3a11daf38ef86e59f43417d3` | `balanceOf(wallet)` | staked TOKE |
| Onsen (SushiMasterChef) | `0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd` | `userInfo(pid, wallet)` | OHM-DAI SLP (pid=185), OHM-LUSD SLP (pid=323) |
| VeFXS Allocator | `0xde7b85f52577b113181921a7aa8fc0c22e309475` | `VeFXS.locked()` | FXS locked amount (not balanceOf) |
| vlCVX (unlocked) | `0x72a19342e8F1838460eBFCCEf09F6585e32db86E` | `lockedBalances(wallet)` | CVX unlocked-but-not-withdrawn balance |
| rlBTRFLY | `0x742B70151cd3Bc7ab598aAFF1d54B90c3ebC6027` | `lockedBalances(wallet)` | BTRFLY V2 unlocked balance |
| Myso Finance | hard-coded `MYSO_DEPLOYMENTS` | running sum of deployment events | DAI principal (not actual contract balance) |
| Vendor Finance | hard-coded `VENDOR_DEPLOYMENTS` | running sum of deployment events | DAI principal (not actual contract balance) |
| Euler | hard-coded `EULER_DEPLOYMENTS` | running sum of deployment events | OHM minted/deployed (TYPE_LENDING) |
| Silo | `SILO_OHM_COLLATERAL_TOKEN = 0x907136B74abA7D5978341eBA903544134A66B065` | `balanceOf(wallet)` | OHM collateral in Silo (after block 18121728); before that: hard-coded `SILO_DEPLOYMENTS` |

---

## 6. Snapshot Cadence

Source: [`subgraph.yaml:133-140`](../../subgraphs/ethereum/subgraph.yaml#L133)

- **Block handler**: `handleMetricsBlock` fires every `2400` blocks (~8 hours at 5 blocks/min)
- **Entry point**: [`ProtocolMetrics.ts:82`](../../subgraphs/ethereum/src/protocolMetrics/ProtocolMetrics.ts#L82)
- **Flow per snapshot**:
  1. `generateTokenRecords()` → stablecoin balances, volatile balances, POL balances, ERC4626 balances, clearinghouse receivables, CoolerV2 receivables
  2. `generateTokenSupply()` → total OHM supply, treasury OHM, POL OHM, vesting bond OHM, borrowable OHM (Euler/Silo/IncurDebt), BLV OHM
  3. `updateProtocolMetrics()` → computes `ProtocolMetric` entity from the above records

Ethereum also has two **event-driven** data sources that fire outside of the block cadence:
- `BondManager.GnosisAuctionLaunched` → creates `GnosisAuction` and `GnosisAuctionRoot` records immediately on the event
- `GnosisEasyAuction.AuctionCleared` → updates `GnosisAuction` with `bidQuantity`

These event records are then consumed by the next block-handler snapshot's `getVestingBondSupplyRecords()`.

---

## 7. Manual Offsets / Migration / Quirks

### OHM V1 → V2 Migration Offset

Sources: [`OhmCalculations.ts:59-113`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L59), [`OhmCalculations.ts:189-224`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L189)

- **Problem**: When OHM V1 LP tokens were migrated, the corresponding pre-minted gOHM in the migration contract was not consumed. This leaves "stranded" gOHM that must be offset.
- **Offset value**: `2013 * current_index` (sOHM V3 `index()`)
- **Initial value** (before Jun-2022 adjustment): `5838.1668738299 * current_index`
- **Start block**: `14381564` (`MIGRATION_OFFSET_STARTING_BLOCK`)
- **End block**: `24550660` (`MIGRATION_OFFSET_REMOVAL_BLOCK`) — when gOHM was physically removed from the migration contract
- **Type**: `TYPE_OFFSET` with `supplyBalance` multiplier `-1` (subtracts from OHM supply)

### CVX Allocator Bricking

Source: [`ProtocolAddresses.ts:71-91`](../../subgraphs/ethereum/src/utils/ProtocolAddresses.ts#L71)

- After block `22278800`, `CONVEX_CVX_ALLOCATOR` is removed from the wallet list — funds there are bricked/inaccessible.

### UST Collapse (Terra)

Source: [`Price.ts:579-585`](../../subgraphs/ethereum/src/utils/Price.ts#L579)

- After block `14730000`, UST is priced at exactly `$0` regardless of any liquidity pool data.

### CVX Decimal Overflow

Source: [`ContractHelper.ts:180-188`](../../subgraphs/ethereum/src/utils/ContractHelper.ts#L180)

- At block `14712001`, reading CVX decimals causes an integer overflow. Hard-coded to `18` for that token.

### sOHM V2 Treasury Indexing Correction

Source: [`OhmCalculations.ts:97`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L97)

- Before block `18121728` (`SOHM_INDEX_CORRECTION_BLOCK`), sOHM V3 treasury balance was erroneously multiplied by the index. Corrected after that block (now `balance` is used directly).

### sOHM V2 Balance Indexing

Source: [`OhmCalculations.ts:107`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L107)

- sOHM V2 balances in protocol wallets only indexed after block `18260000` (`SOHM_V2_INDEX_BLOCK`). Uses `wsOHM.sOHMTowOHM(balance)` to convert sOHM V2 to gOHM units, then multiplies by current index.

### BLV Inclusion Block

Source: [`OhmCalculations.ts:86-86`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L86)

- Before block `17620000` (`BLV_INCLUSION_BLOCK`), OHM in Boosted Liquidity Vaults was deducted from floating/circulating supply. After that block, BLV OHM is included in floating/circulating supply.

### Bond Depository Removal

Source: [`OhmCalculations.ts:68`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L68)

- After block `19070000` (`BOND_DEPOSITORY_BLOCK`), the Bonds Deposit wallet is excluded from OHM circulating supply wallets. gOHM there is considered user funds.

### Olympus Association Removal

Source: [`OhmCalculations.ts:74`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L74)

- After block `17115000` (`OLYMPUS_ASSOCIATION_BLOCK`), the Association wallet is removed from OHM supply wallets.

### gOHM Indexing Start

Source: [`OhmCalculations.ts:80`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L80)

- gOHM and sOHM V3 in protocol/DAO wallets only counted toward treasury OHM after block `17115000` (`GOHM_INDEXING_BLOCK`).

### Silo Manual Deployments vs Token Balance

Source: [`OhmCalculations.ts:476-487`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L476), [`Silo.ts`](../../subgraphs/ethereum/src/utils/Silo.ts)

- Before block `18121728` (`SILO_TOKEN_BLOCK`): OHM deployed to Silo is computed from hard-coded `SILO_DEPLOYMENTS` (running balance of deployment events).
- After: OHM collateral token balance is used (`SILO_OHM_COLLATERAL_TOKEN = 0x907136B74abA7D5978341eBA903544134A66B065`).

### Myso / Vendor Finance Hard-coded Amounts

Source: [`Constants.ts:1181-1245`](../../subgraphs/ethereum/src/utils/Constants.ts#L1181)

Deployments are hard-coded as `LendingMarketDeployment` structs with a block number, amount (positive=deploy, negative=repay/write-off), and lender address. The code reconstructs the current balance as a running sum of all deployments prior to the current block. **No on-chain query is performed** — this is intentional, as the "balance" recognized is the deployed principal, not the actual contract balance.

### Euler Hard-coded Deployments

Source: [`Constants.ts:1281-1306`](../../subgraphs/ethereum/src/utils/Constants.ts#L1281)

Similar pattern to Silo/Myso/Vendor. Three events: initial deposit 30000 OHM (block 16627152), partial repayment -27239 OHM (block 16818299), settlement -2760 OHM in ETH/USDC (block 17348446). Final balance reaches zero after the settlement.

### BARNBRIDGE Discount

Source: [`Constants.ts:411-419`](../../subgraphs/ethereum/src/utils/Constants.ts#L411)

Hard-coded multiplier of `0.77` applied to the BOND token. This affects `valueExcludingOhm` and `value` in `TokenRecord`.

### rlBTRFLY Discount

Source: [`Constants.ts:432-441`](../../subgraphs/ethereum/src/utils/Constants.ts#L432)

Hard-coded multiplier of `0.89`. Token is also `isLiquid=false`.

---

## 8. Chain-Specific Protocol Entities

### OHM Supply Chain

Source: [`OhmCalculations.ts`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts), [`TreasuryCalculations.ts`](../../subgraphs/ethereum/src/utils/TreasuryCalculations.ts)

**`generateTokenSupply()` pipeline** ([`TreasuryCalculations.ts:75-122`](../../subgraphs/ethereum/src/utils/TreasuryCalculations.ts#L75)):

1. **Total supply** (`TYPE_TOTAL_SUPPLY`, +1): raw `totalSupply()` of OHM V1 (before block 13782589) or OHM V2 (after)
2. **Treasury OHM** (`TYPE_TREASURY`, -1): OHM/sOHM/gOHM balances held in circulating supply wallets
3. **POL OHM** (`TYPE_LIQUIDITY`, -1): OHM in protocol-owned pools across all pool types
4. **Vesting bond OHM** (various types, -1): from GnosisAuction records
5. **Borrowable OHM** (`TYPE_LENDING`, -1): Silo/Euler/IncurDebt
6. **BLV OHM** (`TYPE_BOOSTED_LIQUIDITY_VAULT`, -1): from `OlympusBoostedLiquidityRegistry.activeVaults()`
7. **Migration offset** (`TYPE_OFFSET`, -1): `2013 × index` (block-gated, see section 7)

### Staking

Source: [`Rebase.ts`](../../subgraphs/ethereum/src/protocolMetrics/Rebase.ts), [`OhmCalculations.ts`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts)

- **sOHM V1 circulating supply**: `sOlympusERC20.circulatingSupply()` — used before block 12622596
- **sOHM V2 circulating supply**: `sOlympusERC20V2.circulatingSupply()` — used between blocks 12622596 and 13806000
- **sOHM V3 circulating supply**: `sOlympusERC20V3.circulatingSupply()` — used after block 13806000
- **Next OHM rebase** (`getNextOHMRebase`): queries staking V1 `ohmToDistributeNextEpoch()`, V2 `epoch().value3`, V3 `epoch().value3` (only the active contract version at each block)
- **APY calculation**: `nextEpochRebase = distributedOHM / sOHMCirculatingSupply × 100`; `currentAPY = (1 + nextEpochRebase/100)^(365×3) - 1`
- **TVL**: `sOHMCirculatingSupply × OHM_price`

### gOHM Metrics

Source: [`GOhmCalculations.ts`](../../subgraphs/ethereum/src/utils/GOhmCalculations.ts), [`ProtocolMetrics.ts`](../../subgraphs/ethereum/src/protocolMetrics/ProtocolMetrics.ts)

- `gOhmTotalSupply`: `ERC20.totalSupply()` on gOHM contract
- `gOhmSyntheticSupply`: `ohmFloatingSupply / currentIndex`
- `gOhmPrice`: `ohmPrice × currentIndex`
- `currentIndex`: from `shared/src/supply/OhmCalculations.getCurrentIndex()` — binds sOHM V3 `index()` method

### Bonds / GnosisAuction

Source: [`GnosisAuction.ts`](../../subgraphs/ethereum/src/GnosisAuction.ts), [`OhmCalculations.ts`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts)

**Schema entities**: `GnosisAuctionRoot` (singleton, stores list of all market IDs), `GnosisAuction` (per-auction, stores capacity/vesting term/close timestamp/bid quantity)

**Event → entity mapping**:
- `GnosisAuctionLaunched(marketId, auctionToken, capacity, bondTerm)`: creates `GnosisAuction` with `payoutCapacity = capacity / 1e9`, `termSeconds = bondTerm`
- `AuctionCleared(auctionId, soldBiddingTokens, ...)`: sets `bidQuantity = soldBiddingTokens / 1e9`, `auctionCloseTimestamp`

**Block-time supply accounting** (`getVestingBondSupplyRecords`):
- **Open auction**: `TYPE_BONDS_PREMINTED` at teller address = `payoutCapacity` (pre-minted OHM, not yet sold)
- **Closed, vesting**: `TYPE_BONDS_VESTING_DEPOSITS` at BondManager = `bidQuantity` + `TYPE_BONDS_VESTING_TOKENS` at teller = `payoutCapacity`
- **Fully vested**: `TYPE_BONDS_DEPOSITS` at BondManager = `adjustedBidQuantity` (adjusted for partial burns)

**Bond Manager**: `0xf577c77ee3578c7f216327f41b5d7221ead2b2a3` — `isActive()` checked before processing; `fixedExpiryTeller()` provides teller address dynamically.

### Clearinghouse Receivables (Cooler Loans)

Source: [`CoolerLoansClearinghouse.ts`](../../subgraphs/ethereum/src/contracts/CoolerLoansClearinghouse.ts), [`CoolerLoansV2Monocooler.ts`](../../subgraphs/ethereum/src/contracts/CoolerLoansV2Monocooler.ts)

**V1/V1.1/V2 Clearinghouses**:
- Addresses resolved dynamically from Bophades `CHREG` module, with three hard-coded fallbacks
- Per clearinghouse: `CoolerLoansClearinghouse.principalReceivables()` → DAI balance
- Creates `TokenRecord` with token=DAI, `isLiquid=true`, source=clearinghouse address, label `"DAI - Borrowed Through Cooler Loans"`

**V2 MonoCooler** (from block 22423121):
- Contract: `0xdb591Ea2e5Db886dA872654D58f6cc584b68e7cC`
- `CoolerLoansMonoCooler.totalDebt()` → USDS balance (NOT DAI)
- Creates `TokenRecord` with token=USDS, label `"USDS - Borrowed Through Cooler Loans V2"`
- **Note**: The rate used is `getUSDRate(ERC20_DAI)`, not `getUSDRate(ERC20_USDS)` — likely a bug or intentional since USDS ≈ DAI in price

### Boosted Liquidity Vaults (BLV)

Source: [`OhmCalculations.ts:818-861`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L818)

- Registry: `OlympusBoostedLiquidityRegistry` at `0x375E06C694B5E50aF8be8FB03495A612eA3e2275`
- Iterates `activeVaultCount()` and `activeVaults(i)` to discover vaults dynamically
- Per vault: `OlympusBoostedLiquidityVaultLido.getPoolOhmShare()` → OHM in pool
- Creates `TokenSupply` with `TYPE_BOOSTED_LIQUIDITY_VAULT`, source = vault address (not a human-readable name)
- Only active after block `17620000` (`OLYMPUS_INCUR_DEBT_BLOCK`) — actually this constant is shared with IncurDebt

### IncurDebt

Source: [`OhmCalculations.ts:765-807`](../../subgraphs/ethereum/src/utils/OhmCalculations.ts#L765)

- Contract: `0xd9d87586774fb9d036fa95a5991474513ff6c96e`
- `IncurDebt.totalOutstandingGlobalDebt()` → total OHM debt outstanding
- `TYPE_BOOSTED_LIQUIDITY_VAULT` (same type as BLV, analogous treatment)
- Only active after block `17620000`

### Bophades Treasury Module

Source: [`Bophades.ts`](../../subgraphs/ethereum/src/utils/Bophades.ts)

- Kernel: `0x2286d7f9639e8158FaD1169e76d1FbC38247f54b` (mainnet)
- `TRSRY` module address resolved dynamically per-block via `kernel.getModuleForKeycode("TRSRY")` and cached in `BophadesModule` entity
- `CHREG` module address resolved similarly, then `BophadesClearinghouseRegistry.registry(i)` iterated for clearinghouse list, cached in `ClearinghouseAddress` entity

### Lending Markets (Myso, Vendor, Euler, Silo)

All tracked via `TYPE_LENDING` in `TokenSupply` or `TokenRecord`. Details in section 7.

---

## 9. Tests in Tree

Source: [`tests/`](../../subgraphs/ethereum/tests/)

| File | Topic | Key Edge Cases |
|------|-------|----------------|
| [`decimals.test.ts`](../../subgraphs/ethereum/tests/decimals.test.ts) | Decimal conversion utilities (`toDecimal`, `toBigInt`) | Standard cases; not protocol-specific |
| [`priceBase.test.ts`](../../subgraphs/ethereum/tests/priceBase.test.ts) | Base token orientation, ETH/USD rate from UniswapV2, `getBaseTokenUSDRate` | Tests pre-`ERC20_OHM_V2_BLOCK` behavior (OHM V1 price); USDC/ETH pair fallback; base token detection |
| [`price.test.ts`](../../subgraphs/ethereum/tests/price.test.ts) | Full `getUSDRate` routing: Chainlink, UniswapV2, UniswapV3, Balancer, stablecoin identities, OHM/gOHM, WEETH start block gate | `ERC20_WEETH` returns $0 before block 18961223; UST returns $0 after block 14730000; OHM V1 pre-migration route; FPIS/FXS via UniswapV3; BTRFLY V1/V2 via UniswapV3; 3CRV via V3; `NATIVE_ETH` routed to WETH; DAI route pre/post OHM-DAI V2 start block |
| [`tokenRecordHelper.test.ts`](../../subgraphs/ethereum/tests/tokenRecordHelper.test.ts) | `createTokenRecord`, category checks, `isTokenAddressInCategory`, `getTokenAddressesInCategory` | Tests that ERC20_TOKENS map correctly classifies stable vs volatile |
| [`tokenStablecoins.test.ts`](../../subgraphs/ethereum/tests/tokenStablecoins.test.ts) | `getStablecoinBalance` with native ETH | Confirms native ETH returns zero records (not ERC20) without throwing |
| [`tokenUsdt.test.ts`](../../subgraphs/ethereum/tests/tokenUsdt.test.ts) | USDT stablecoin balance indexed via Yield Farming MS | Tests that USDT is indexed from Yield Farming MS wallet; `before_start_block` guard works |
| [`tokenAethSusde.test.ts`](../../subgraphs/ethereum/tests/tokenAethSusde.test.ts) | aEthSUSDe indexed from Yield Farming MS | aEthSUSDe priced via sUSDe ERC4626 `convertToAssets`; start block guard (24707147); Convex/Aura reward contracts reverted gracefully |
| [`erc4626.test.ts`](../../subgraphs/ethereum/tests/erc4626.test.ts) | `getAllERC4626Balances` for sDAI, sUSDe, sUSDS, Gauntlet sUSDS Vault | `convertToAssets()` revert handling; correct `asset()` → price chain; zero balance skipped; multiple vaults in one pass |
| [`contractHelper.test.ts`](../../subgraphs/ethereum/tests/contractHelper.test.ts) | Staking pool contract helpers: Aura staking, Aura locker, Aura rewards, Balancer gauge, Convex staked balance, LQTY staking, vlCVX unlocked, TOKE staking | Tests that wallet iteration works across allocators; zero balance skipped; correct integration of each allocator type |
| [`liquidityUniswapV2.test.ts`](../../subgraphs/ethereum/tests/liquidityUniswapV2.test.ts) | UniswapV2 POL: `getUniswapV2PairTotalValue`, `getUniswapV2PairTotalTokenQuantity`, `getUniswapV2PairValue`, `getUniswapV2PairTokenQuantity`, `getLiquidityBalances` | OHM V1 vs V2 pools; pre-block gates for V2 pairs; BTRFLY-OHM V1 pair; correct OHM/non-OHM split in value calculation |
| [`liquidityUniswapV3.test.ts`](../../subgraphs/ethereum/tests/liquidityUniswapV3.test.ts) | UniswapV3 POL via NFT positions | Position manager integration; token amount calculation from sqrt-price math; OHM exclusion multiplier; zero-liquidity position skipped |
| [`liquidityBalancer.test.ts`](../../subgraphs/ethereum/tests/liquidityBalancer.test.ts) | Balancer POL: `getBalancerPoolTotalValue`, `getBalancerPoolTotalTokenQuantity`, `getBalancerPoolTokenQuantity`, `getBalancerRecords` | Gauge balance vs direct balance; Aura staking balance; OHM-BTRFLY V2 pool; WETH-FDT pool; OHM V1 in pool (should return 0) |
| [`liquidityCurve.test.ts`](../../subgraphs/ethereum/tests/liquidityCurve.test.ts) | Curve POL: OHM-ETH, FraxBP pools; Convex staked balance on Curve LP | `getCurvePairToken()` fallback between `CurvePool.token()` and `CurvePoolV2.lp_token()`; Convex reward pool staked balance attribution |
| [`liquidityFraxSwap.test.ts`](../../subgraphs/ethereum/tests/liquidityFraxSwap.test.ts) | FraxSwap V1/V2 OHM-FRAX TWAMM | `getReserves()` revert handling; proportional share calculation |
| [`liquidityCalculations.test.ts`](../../subgraphs/ethereum/tests/liquidityCalculations.test.ts) | `getOwnedLiquidityPoolValue` across all pool types | Integration: all LIQUIDITY_OWNED pools iterated; token-address filter; OHM/non-OHM value split |
| [`OhmCalculations.test.ts`](../../subgraphs/ethereum/tests/OhmCalculations.test.ts) | Supply calc: `getTreasuryOHMRecords`, `getVestingBondSupplyRecords`, `getMintedBorrowableOHMRecords` | Migration offset applied/not-applied by block; bond life-cycle states (open/vesting/vested); partial burn of Bond Manager OHM; Euler/Silo `TYPE_LENDING`; gOHM and sOHM V3 in wallets included after GOHM_INDEXING_BLOCK |
| [`protocolMetrics.test.ts`](../../subgraphs/ethereum/tests/protocolMetrics.test.ts) | `getTreasuryMarketValue`, `getTreasuryLiquidBacking` | OHM/gOHM excluded from treasury MV; Buyback MS OHM included after OHM_IN_MARKET_VALUE_BLOCK (20514801); liquid-only filter for liquid backing |
| [`liquityAllocator.test.ts`](../../subgraphs/ethereum/tests/liquityAllocator.test.ts) | `getLiquityStabilityPoolRecords` for LUSD allocator | LUSD balance from `deposits()`; WETH gain from `getDepositorETHGain()`; LQTY gain from `getDepositorLQTYGain()` |

---

## 10. Open Questions for New Envio Implementation

1. **Event-driven vs block-driven snapshot conflict**: The GnosisAuction state (bond vesting lifecycle) is written by event handlers (`GnosisAuctionLaunched`, `AuctionCleared`) and read by the block handler. In Envio, if these are in the same indexer but different handlers, entity ordering/consistency guarantees must be verified — especially if the block handler fires at a block that also contains a GnosisAuction event.

2. **Dynamic clearinghouse address resolution via Bophades Kernel**: `getClearinghouseAddresses()` calls `kernel.getModuleForKeycode("CHREG")` and then `registry.registryCount()` + `registry.registry(i)` on every snapshot block. This requires `context.effect()` (external call) in Envio. The caching mechanism (`BophadesModule` and `ClearinghouseAddress` entities keyed by block) needs to be replicated or replaced with a more Envio-native approach.

3. **CoolerV2 MonoCooler USDS receivable priced via DAI rate**: [`CoolerLoansV2Monocooler.ts:34`](../../subgraphs/ethereum/src/contracts/CoolerLoansV2Monocooler.ts#L34) calls `getUSDRate(ERC20_DAI)` but the underlying token is USDS. Clarify: is this intentional (DAI ≈ USDS in value) or a copy-paste bug? The Envio port should reproduce exactly, but this should be confirmed with domain experts.

4. **UniswapV3 NFT position math uses integer sqrt approximation**: [`LiquidityUniswapV3.ts:38-43`](../../subgraphs/ethereum/src/liquidity/LiquidityUniswapV3.ts#L38) uses `sqrt(1.0001^tick)` via JS `Math.pow`, then casts to `u64`. This is a lossy approximation. The Envio port should replicate the same approximation for historical parity, or use a more precise formula (noting that this will produce different historical numbers).

5. **Balancer `BALANCER_ALLOCATOR` address marked "Incorrect?"**: [`ProtocolAddresses.ts:45`](../../subgraphs/ethereum/src/utils/ProtocolAddresses.ts#L45) has a comment "Incorrect?" on the Balancer Allocator address `0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6`. Confirm whether this address should be included or corrected.

6. **`CONVEX_CVX_ALLOCATOR` bricking at block 22278800**: Both `getConvexAllocators()` and `getWalletAddressesForContract()` have separate logic to remove this allocator. The block check is duplicated — one of them may be redundant. For Envio, a single source of truth is preferable.

7. **gOHM in Buyback MS included in market value after block 20514801**: The `TREASURY_BLACKLIST` in `getWalletAddressesForContract` removes Buyback MS from OHM/gOHM indexing, but with a carve-out after `OHM_IN_MARKET_VALUE_BLOCK`. Meanwhile, `TreasuryMetrics.getTreasuryMarketValue()` filters OHM records differently. These two mechanisms interact non-obviously — confirm the intended behavior (MV vs liquid backing) across both block windows.

8. **sOHM V2 indexed only from block 18260000 (`SOHM_V2_INDEX_BLOCK`) even though sOHM V2 was deployed at block 12622596**: A 5.6M-block gap where sOHM V2 in treasury wallets was ignored. The Envio port should reproduce this exactly to maintain historical consistency.

9. **LUSD/OHM V1 SLP (Onsen pid=323)**: `OHMLUSD_ONSEN_ID = 323` is defined but the OHM-LUSD pool (`PAIR_UNISWAP_V2_OHM_LUSD`) is also in `LIQUIDITY_OWNED`. Confirm whether the Onsen allocation double-counts with the direct wallet balance, or if the SLP is only in Onsen (not a protocol wallet ERC20 balance).

10. **VeFXS price and balance**: `veFXS` balance uses `VeFXS.locked()` (actual locked FXS) rather than `balanceOf()` (voting power). Price is routed to the FXS UniswapV3 pool. This means the FXS value of the lock is reported, not a "veFXS market price." Confirm this is the intended semantics for the Envio implementation.

11. **OHM price selection from deepest pool — timing sensitivity**: `getBaseOhmUsdRate()` selects the pool with the largest non-OHM reserves. Pool depths can change between blocks, potentially flipping the source pool mid-history. The Envio implementation should replicate this dynamic selection; if using event-sourced snapshots, care is needed to ensure pool snapshots are current at each block.

12. **Missing `LIQUIDITY_PAIR_TOKENS` for OHM-FRAX V1/V2 UniswapV2 pools**: Comment at [`Constants.ts:1069`](../../subgraphs/ethereum/src/utils/Constants.ts#L1069): `// TODO if extending far into the past, add OHM-FRAX V1 & V2`. These pools are NOT in `LIQUIDITY_OWNED` or `LIQUIDITY_PAIR_TOKENS`. This means they are not counted in POL and not in OHM supply calculations. Confirm if this is intentional.

13. **Grafting from QmToGXtryBXFX1bx1mfu9RoXxD3kKia1jbRzwkKj6EGDMn at block 24707147**: The subgraph grafts from a previous version. The Envio migration will need to backfill from block 14690000 from scratch, including all the historical state changes covered by the graft. Confirm that no post-graft entity schema changes exist that would prevent a clean cold-start.
