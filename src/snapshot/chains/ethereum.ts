import { addr, bytes32, token } from "../math";
import type { ChainConfig, CoolerClearinghouse, LiquidityHandler } from "../types";
import {
  COOLER_LOANS_CLEARINGHOUSE_V1,
  COOLER_LOANS_CLEARINGHOUSE_V1_1,
  COOLER_LOANS_CLEARINGHOUSE_V2,
  COOLER_LOANS_V2_MONOCOOLER,
  WALLET_ADDRESSES,
} from "../wallets";
import { rpcUrls } from "./rpc";

// Ethereum mainnet — the largest surface in the migration. This file is the
// "baseline" Ethereum config: core treasury tokens, the inherited 36-wallet
// list from shared/Wallets.ts, Chainlink feeds for the major stables + WETH,
// and the minimum pool set to give OHM / wstETH / weETH a price. Phase 4
// follow-up commits add the exotic positions documented in
// docs/envio-migration/inventory-ethereum.md: Bophades dynamic resolution,
// Cooler clearinghouse receivables, BLV vault registry, GnosisAuction
// cross-data-source state, OHM v1→v2 migration offsets, Aura/Convex wrappers,
// Curve / FraxSwap / ERC4626 vault handlers, Univ3 NFT POL positions.

// ---- Token addresses (per inventory-ethereum.md sections 2.1 and 2.4). ----

const ERC20_OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const ERC20_OHM_V2 = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
const ERC20_GOHM = addr("0x0ab87046fBb341D058F17CBC4c1133F25a20a52f");
const ERC20_SOHM_V3 = addr("0x04906695D6D12CF5459975d7C3C03356E4Ccd460");

const ERC20_DAI = addr("0x6b175474e89094c44da98b954eedeac495271d0f");
const ERC20_FRAX = addr("0x853d955acef822db058eb8505911ed77f175b99e");
const ERC20_LUSD = addr("0x5f98805a4e8be255a32880fdec7f6728c6568ba0");
const ERC20_USDC = addr("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const ERC20_USDT = addr("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const ERC20_USDE = addr("0x4c9EDD5852cd905f086C759E8383e09bff1E68B3");
const ERC20_USDS = addr("0xdC035D45d973E3EC169d2276DDab16f1e407384F");

// ERC4626 yield-bearing vault tokens (per inventory §2.3 + §5).
// `convertToAssets()` provides the share→asset rate; the underlying is
// independently priced via Chainlink. Prices recurse through their
// underlying asset.
const ERC20_SDAI = addr("0x83F20F44975D03b1b09e64809B757c47f942BEeA");
const ERC20_SUSDE = addr("0x9D39A5DE30e57443BfF2A8307A4256c8797A3497");
const ERC20_SUSDS = addr("0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD");
const ERC20_GAUNTLET_SUSDS_VAULT = addr("0x0Eb5B03c0303f2F47cD81d7BE4275AF8Ed347576");

// Aave receipt tokens (assets) + variable-debt tokens (liabilities). Receipts
// price at the underlying asset's rate; variable-debt tokens carry
// isLiability=true so their value subtracts from treasury MV.
const ERC20_ADAI = addr("0x028171bca77440897b824ca71d1c56cac55b68a3");
const ERC20_AETH_USDE = addr("0x4f5923fc5fd4a93352581b38b7cd26943012decf");
const ERC20_VAR_DEBT_ETH_USDT = addr("0x6df1c1e379bc5a00a7b4c6e67a203333772f45a8");
const ERC20_VAR_DEBT_ETH_USDC = addr("0x72e95b8931767c79ba4eee721354d6e99a61d004");

const ERC20_WETH = addr("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const ERC20_WSTETH = addr("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0");
const ERC20_WEETH = addr("0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee");

// Long-tail volatiles (per inventory §2.2).
const ERC20_FXS = addr("0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0");
const ERC20_LDO = addr("0x5a98fcbea516cf06857215779fd812ca3bef1b32");
const ERC20_LQTY = addr("0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d");
const ERC20_BTRFLY_V1 = addr("0xc0d4ceb216b3ba9c3701b291766fdcba977cec3a");
const ERC20_BTRFLY_V1_STAKED = addr("0xCC94Faf235cC5D3Bf4bEd3a30db5984306c86aBC"); // xBTRFLY
const ERC20_BTRFLY_V2 = addr("0xc55126051b22ebb829d00368f4b12bde432de5da");
const ERC20_BTRFLY_V2_RL = addr("0x742B70151cd3Bc7ab598aAFF1d54B90c3ebC6027"); // rlBTRFLY

const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// ---- Chainlink feeds (per inventory section 4.1). ----

const CHAINLINK_FEED_DAI_USD = addr("0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9");
const CHAINLINK_FEED_FRAX_USD = addr("0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd");
const CHAINLINK_FEED_LUSD_USD = addr("0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0");
const CHAINLINK_FEED_USDC_USD = addr("0x8fffffd4afb6115b954bd326cbe7b4ba576818f6");
const CHAINLINK_FEED_USDT_USD = addr("0x3e7d1eab13ad0104d2750b8863b489d65364e32d");
const CHAINLINK_FEED_USDE_USD = addr("0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961");
const CHAINLINK_FEED_ETH_USD = addr("0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419");

// ---- Pricing pools (per inventory section 5). ----

// Curve POL pools (per inventory §5).
const LP_CURVE_OHM_ETH = addr("0x6ec38b3228251a0C5D491Faf66858e2E23d7728B");
const LP_CURVE_OHM_FRAXBP = addr("0xFc1e8bf3E81383Ef07Be24c3FD146745719DE48D");
const LP_CURVE_FRAX_USDC_POOL = addr("0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2");
// FraxBP LP token (separate from the pool address per Curve V2 lp_token()).
const LP_CURVE_FRAX_USDC_LP = addr("0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");

// Curve OHM-ETH uses native ETH (sentinel address) as coin 1. FraxBP coins
// are FRAX and USDC. Coin order per Curve registry.
const CURVE_OHM_ETH_COINS = [ERC20_OHM_V2, NATIVE_ETH];
const CURVE_OHM_FRAXBP_COINS = [ERC20_OHM_V2, LP_CURVE_FRAX_USDC_LP];
const CURVE_FRAX_USDC_COINS = [ERC20_FRAX, ERC20_USDC];

// FraxSwap pools (per inventory §5).
const LP_FRAXSWAP_V1_OHM_FRAX = addr("0x38633ed142bcc8128b45ab04a2e4a6e53774699f");
const LP_FRAXSWAP_V2_OHM_FRAX = addr("0x5769071665eb8Db80e7e9226F92336Bb2897DCFA");

// Convex BaseRewardPool wrappers — 1:1 ERC20 wrappers of staked Curve LP
// tokens. Pricing recurses through the `remap` handlers below back to the
// underlying Curve LP pool. Per inventory §5.
const CONVEX_REWARD_OHM_ETH = addr("0xd683C7051a28fA150EB3F4BD92263865D4a67778"); // wraps Curve OHM-ETH LP
const CONVEX_REWARD_OHM_FRAXBP = addr("0x27A8c58e3DE84280826d615D80ddb33930383fE9"); // wraps Curve OHM-FraxBP LP
const CONVEX_REWARD_FRAX_USDC = addr("0x7e880867363A7e321f5d260Cade2B0Bb2F717B02"); // wraps Curve FRAX-USDC LP

// Balancer V2 Vault.
const BALANCER_VAULT = addr("0xba12222222228d8ba445958a75a0704d566bf2c8");

// Balancer pools + BPTs (per inventory §5). For Balancer V2 weighted pools,
// the first 20 bytes of poolId == the BPT address.
const LP_BALANCER_POOL_OHM_WETH = bytes32(
  "0xd1ec5e215e8148d76f4460e4097fd3d5ae0a35580002000000000000000003d3",
);
const LP_BALANCER_POOL_OHM_DAI = bytes32(
  "0x76fcf0e8c7ff37a47a799fa2cd4c13cde0d981c90002000000000000000003d2",
);
const LP_BALANCER_POOL_OHM_DAI_WETH = bytes32(
  "0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e",
);
const LP_BALANCER_POOL_OHM_WSTETH = bytes32(
  "0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e",
);
const BPT_OHM_WETH = addr("0xd1ec5e215e8148d76f4460e4097fd3d5ae0a3558");
const BPT_OHM_DAI = addr("0x76fcf0e8c7ff37a47a799fa2cd4c13cde0d981c9");
const BPT_OHM_DAI_WETH = addr("0xc45d42f801105e861e86658648e3678ad7aa70f9");
const BPT_OHM_WSTETH = addr("0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f");

// Aura vault wrappers (per inventory §5 "Aura Staking Contracts"). 1:1 ERC20
// wrappers of the underlying BPT — priced via `remap` to the BPT.
const AURA_VAULT_OHM_WETH = addr("0x978653c02f2fbbdfd67cbc7f45c42262f213e0b5");
const AURA_VAULT_OHM_DAI = addr("0xB9D6ED734Ccbdd0b9CadFED712Cf8AC6D0917EcD");
const AURA_VAULT_OHM_DAI_WETH = addr("0xF01e29461f1FCEdD82f5258Da006295E23b4Fab3");
const AURA_VAULT_OHM_WSTETH = addr("0x636024f9ddef77e625161b2ccf3a2adfbfad3615");

const LP_UNISWAP_V3_WETH_OHM = addr("0x88051b0eea095007d3bef21ab287be961f3d8598");
const LP_UNISWAP_V3_WETH_WSTETH = addr("0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa");
const LP_UNISWAP_V3_WEETH_WETH = addr("0x202A6012894Ae5c288eA824cbc8A9bfb26A49b93");
const LP_UNISWAP_V3_FXS_ETH = addr("0xcd8286b48936cdac20518247dbd310ab681a9fbf");
const LP_UNISWAP_V3_LDO_WETH = addr("0xa3f558aebaecaf0e11ca4b2199cc5ed341edfd74");
const LP_UNISWAP_V3_LQTY_WETH = addr("0xd1d5a4c0ea98971894772dcd6d2f1dc71083c44e");
const LP_UNISWAP_V3_WETH_BTRFLY_V1 = addr("0xdf9ab3c649005ebfdf682d2302ca1f673e0d37a2");
const LP_UNISWAP_V3_WETH_BTRFLY_V2 = addr("0x3e6e23198679419cd73bb6376518dcc5168c8260");

// Curve / FraxSwap pool deployment blocks. These pools' POL contributions
// only start at the listed blocks; before that the effect's revert handling
// makes the contribution zero anyway, but startBlock keeps the indexer
// from doing useless RPC calls.
const LP_CURVE_OHM_ETH_BLOCK = 14_490_000; // ~2022-03-22
const LP_CURVE_OHM_FRAXBP_BLOCK = 15_300_000; // ~2022-08-15
const LP_CURVE_FRAX_USDC_BLOCK = 14_950_000; // ~2022-05-28
const LP_FRAXSWAP_V1_OHM_FRAX_BLOCK = 14_490_000;
const LP_FRAXSWAP_V2_OHM_FRAX_BLOCK = 17_000_000;

// Balancer + Aura deployment blocks (approximate; effect reverts before
// the actual creation gracefully zero out).
const LP_BALANCER_OHM_WETH_BLOCK = 15_650_000;
const LP_BALANCER_OHM_DAI_BLOCK = 15_650_000;
const LP_BALANCER_OHM_DAI_WETH_BLOCK = 14_790_000;
const LP_BALANCER_OHM_WSTETH_BLOCK = 16_800_000;

// ---- Block windows (per inventory section 2.1). ----

const ETHEREUM_START_BLOCK = 12_000_000; // ~2021-04-29, before Treasury V2 (12525281).
const ERC20_OHM_V2_BLOCK = 13_782_589;
// sOHM V3 deployment (per inventory-ethereum.md §2.1). LogRebase from sOHM V3
// feeds OhmIndexState; gOHM pricing becomes available once the first rebase
// after this block is observed.
const ERC20_SOHM_V3_BLOCK = 13_806_000;
const ERC20_SDAI_BLOCK = 17_675_440;
const ERC20_SUSDE_BLOCK = 20_265_440;
const ERC20_SUSDS_BLOCK = 20_722_900;
const ERC20_GAUNTLET_SUSDS_VAULT_BLOCK = 21_300_000;
const ERC20_USDE_BLOCK = 20_289_094;
const ERC20_WEETH_BLOCK = 18_961_223;
const NATIVE_ETH_BLOCK = 21_810_000;
const ERC20_FXS_BLOCK = 11_465_584;
// Olympus's Aave V3 position deployment block on Ethereum (per
// inventory-ethereum.md §2 + §5: aEthUSDe, varDebtEth USDC/USDT, aEthSUSDe).
// Also the graft block on the legacy subgraph; matches when the treasury first
// took an Aave V3 position. Indexing earlier yields no Transfers to/from
// treasury wallets so it's pure waste.
const ERC20_AAVE_V3_BLOCK = 24_707_147;

const PROTOCOL_ADDRESSES = WALLET_ADDRESSES;

const names: Record<string, string> = {
  [CONVEX_REWARD_OHM_ETH]: "Convex Staked Curve OHM-ETH",
  [CONVEX_REWARD_OHM_FRAXBP]: "Convex Staked Curve OHM-FraxBP",
  [CONVEX_REWARD_FRAX_USDC]: "Convex Staked Curve FRAX-USDC",
  [BPT_OHM_WETH]: "Balancer OHM-WETH BPT",
  [BPT_OHM_DAI]: "Balancer OHM-DAI BPT",
  [BPT_OHM_DAI_WETH]: "Balancer OHM-DAI-WETH BPT",
  [BPT_OHM_WSTETH]: "Balancer OHM-wstETH BPT",
  [AURA_VAULT_OHM_WETH]: "Aura Staked OHM-WETH",
  [AURA_VAULT_OHM_DAI]: "Aura Staked OHM-DAI",
  [AURA_VAULT_OHM_DAI_WETH]: "Aura Staked OHM-DAI-WETH",
  [AURA_VAULT_OHM_WSTETH]: "Aura Staked OHM-wstETH",
  [LP_CURVE_OHM_ETH]: "Curve OHM-ETH",
  [LP_CURVE_OHM_FRAXBP]: "Curve OHM-FraxBP",
  [LP_CURVE_FRAX_USDC_LP]: "Curve FRAX-USDC",
  [LP_FRAXSWAP_V1_OHM_FRAX]: "FraxSwap V1 OHM-FRAX",
  [LP_FRAXSWAP_V2_OHM_FRAX]: "FraxSwap V2 OHM-FRAX",
  [ERC20_SDAI]: "Savings DAI",
  [ERC20_SUSDE]: "Staked USDe",
  [ERC20_SUSDS]: "Savings USDS",
  [ERC20_GAUNTLET_SUSDS_VAULT]: "Gauntlet sUSDS Vault",
  [ERC20_ADAI]: "Aave DAI",
  [ERC20_AETH_USDE]: "Aave Ethereum USDe",
  [ERC20_VAR_DEBT_ETH_USDC]: "Aave Ethereum Variable Debt USDC",
  [ERC20_VAR_DEBT_ETH_USDT]: "Aave Ethereum Variable Debt USDT",
  [ERC20_BTRFLY_V1]: "BTRFLY",
  [ERC20_BTRFLY_V1_STAKED]: "Staked BTRFLY",
  [ERC20_BTRFLY_V2]: "BTRFLY V2",
  [ERC20_BTRFLY_V2_RL]: "Revenue-Locked BTRFLY",
  [ERC20_DAI]: "DAI",
  [ERC20_FRAX]: "FRAX",
  [ERC20_FXS]: "Frax Share",
  [ERC20_GOHM]: "Governance OHM",
  [ERC20_LDO]: "Lido DAO",
  [ERC20_LQTY]: "Liquity",
  [ERC20_LUSD]: "Liquity USD",
  [ERC20_OHM_V1]: "OHM (V1)",
  [ERC20_OHM_V2]: "OHM",
  [ERC20_USDC]: "USDC",
  [ERC20_USDE]: "USDe",
  [ERC20_USDS]: "USDS",
  [ERC20_USDT]: "USDT",
  [ERC20_WEETH]: "Wrapped eETH",
  [ERC20_WETH]: "Wrapped ETH",
  [ERC20_WSTETH]: "Wrapped staked ETH",
  [LP_UNISWAP_V3_FXS_ETH]: "UniswapV3 FXS-ETH",
  [LP_UNISWAP_V3_LDO_WETH]: "UniswapV3 LDO-WETH",
  [LP_UNISWAP_V3_LQTY_WETH]: "UniswapV3 LQTY-WETH",
  [LP_UNISWAP_V3_WEETH_WETH]: "UniswapV3 weETH-WETH",
  [LP_UNISWAP_V3_WETH_BTRFLY_V1]: "UniswapV3 WETH-BTRFLY V1",
  [LP_UNISWAP_V3_WETH_BTRFLY_V2]: "UniswapV3 WETH-BTRFLY V2",
  [LP_UNISWAP_V3_WETH_OHM]: "UniswapV3 WETH-OHM",
  [LP_UNISWAP_V3_WETH_WSTETH]: "UniswapV3 WETH-wstETH",
};

const abbreviations: Record<string, string> = {
  [CONVEX_REWARD_OHM_ETH]: "cvxCurveOhmEth",
  [CONVEX_REWARD_OHM_FRAXBP]: "cvxCurveOhmFraxBp",
  [CONVEX_REWARD_FRAX_USDC]: "cvxFraxUsdc",
  [AURA_VAULT_OHM_WETH]: "auraOhmWeth",
  [AURA_VAULT_OHM_DAI]: "auraOhmDai",
  [AURA_VAULT_OHM_DAI_WETH]: "auraOhmDaiWeth",
  [AURA_VAULT_OHM_WSTETH]: "auraOhmWsteth",
  [ERC20_SDAI]: "sDAI",
  [ERC20_SUSDE]: "sUSDe",
  [ERC20_SUSDS]: "sUSDS",
  [ERC20_GAUNTLET_SUSDS_VAULT]: "gtSUSDS",
  [ERC20_ADAI]: "aDAI",
  [ERC20_AETH_USDE]: "aEthUSDe",
  [ERC20_VAR_DEBT_ETH_USDC]: "variableDebtEthUSDC",
  [ERC20_VAR_DEBT_ETH_USDT]: "variableDebtEthUSDT",
  [ERC20_BTRFLY_V1]: "BTRFLY",
  [ERC20_BTRFLY_V1_STAKED]: "xBTRFLY",
  [ERC20_BTRFLY_V2]: "BTRFLY",
  [ERC20_BTRFLY_V2_RL]: "rlBTRFLY",
  [ERC20_FXS]: "FXS",
  [ERC20_GOHM]: "gOHM",
  [ERC20_LDO]: "LDO",
  [ERC20_LQTY]: "LQTY",
  [ERC20_OHM_V1]: "OHM V1",
  [ERC20_OHM_V2]: "OHM",
  [ERC20_USDE]: "USDe",
  [ERC20_USDS]: "USDS",
  [ERC20_WEETH]: "weETH",
  [ERC20_WETH]: "wETH",
  [ERC20_WSTETH]: "wstETH",
};

// OHM gets priced via the WETH-OHM UniV3 pool, which recurses through WETH
// (Chainlink). Phase 4 follow-up wires the legacy "largest non-OHM reserves"
// dynamic OHM price selection across multiple pools (OHM-DAI V2 SLP, OHM-DAI
// Balancer, etc.).
const univ3WethOhm: LiquidityHandler = {
  kind: "univ3",
  tokens: [ERC20_OHM_V2, ERC20_WETH],
  id: LP_UNISWAP_V3_WETH_OHM,
  startBlock: ERC20_OHM_V2_BLOCK,
};

const ownedLiquidityHandlers: LiquidityHandler[] = [univ3WethOhm];

// Cooler Loans clearinghouses. Each clearinghouse's principal receivable is
// added to the snapshot as a DAI / USDS TokenRecord priced via the
// corresponding Chainlink feed. Start blocks are the approximate deployment
// windows from inventory-ethereum.md §3 "Clearinghouse Addresses"; the
// underlying RPC call gracefully returns null on revert (pre-deploy) so an
// over-broad start block is harmless.
const COOLER_LOANS_V1_BLOCK = 18_539_800;
const COOLER_LOANS_V1_1_BLOCK = 18_794_000;
const COOLER_LOANS_V2_BLOCK = 19_620_000;
const COOLER_LOANS_V2_MONOCOOLER_BLOCK = 22_423_121;

const coolerClearinghouses: CoolerClearinghouse[] = [
  {
    address: COOLER_LOANS_CLEARINGHOUSE_V1,
    kind: "clearinghouse",
    name: "Cooler Loans Clearinghouse V1",
    receivableToken: ERC20_DAI,
    startBlock: COOLER_LOANS_V1_BLOCK,
  },
  {
    address: COOLER_LOANS_CLEARINGHOUSE_V1_1,
    kind: "clearinghouse",
    name: "Cooler Loans Clearinghouse V1.1",
    receivableToken: ERC20_DAI,
    startBlock: COOLER_LOANS_V1_1_BLOCK,
  },
  {
    address: COOLER_LOANS_CLEARINGHOUSE_V2,
    kind: "clearinghouse",
    name: "Cooler Loans Clearinghouse V2",
    receivableToken: ERC20_DAI,
    startBlock: COOLER_LOANS_V2_BLOCK,
  },
  {
    address: COOLER_LOANS_V2_MONOCOOLER,
    kind: "monocooler",
    name: "Cooler Loans V2 MonoCooler",
    receivableToken: ERC20_USDS,
    // Per Phase 1 decision #5: MonoCooler debt is USDS-denominated but legacy
    // prices it via the DAI Chainlink rate. Preserve the exact behavior for
    // parity; flag for review in the Phase 6 changelog.
    priceToken: ERC20_DAI,
    startBlock: COOLER_LOANS_V2_MONOCOOLER_BLOCK,
  },
];

const liquidityHandlers: LiquidityHandler[] = [
  // Chainlink feeds (highest priority via CHAINLINK_PRIORITY = 10^30).
  // aDAI / aEthUSDe / varDebtEthUSDT / varDebtEthUSDC piggyback the same
  // feeds as their underlyings — one feed serves many tokens via the
  // handler's `tokens` array.
  {
    kind: "chainlink",
    tokens: [ERC20_DAI, ERC20_ADAI],
    id: CHAINLINK_FEED_DAI_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_FRAX],
    id: CHAINLINK_FEED_FRAX_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_LUSD],
    id: CHAINLINK_FEED_LUSD_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_USDC, ERC20_VAR_DEBT_ETH_USDC],
    id: CHAINLINK_FEED_USDC_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_USDT, ERC20_VAR_DEBT_ETH_USDT],
    id: CHAINLINK_FEED_USDT_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_USDE, ERC20_AETH_USDE],
    id: CHAINLINK_FEED_USDE_USD,
    decimals: 8,
    startBlock: ERC20_USDE_BLOCK,
  },
  // USDS uses the DAI feed (no USDS feed exists). Per inventory section 2.2.
  {
    kind: "chainlink",
    tokens: [ERC20_USDS],
    id: CHAINLINK_FEED_DAI_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_WETH],
    id: CHAINLINK_FEED_ETH_USD,
    decimals: 8,
    startBlock: ETHEREUM_START_BLOCK,
  },
  // Stable fallback for stables that may have Chainlink seeding lag.
  {
    kind: "stable",
    tokens: [ERC20_DAI, ERC20_FRAX, ERC20_LUSD, ERC20_USDC, ERC20_USDT, ERC20_USDE, ERC20_USDS],
    id: "stable-usd",
  },
  // OHM pricing via the WETH-OHM UniV3 pool (recurses to WETH via Chainlink).
  univ3WethOhm,
  // wstETH and weETH price via their WETH UniV3 pools.
  {
    kind: "univ3",
    tokens: [ERC20_WETH, ERC20_WSTETH],
    id: LP_UNISWAP_V3_WETH_WSTETH,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_WEETH, ERC20_WETH],
    id: LP_UNISWAP_V3_WEETH_WETH,
    startBlock: ERC20_WEETH_BLOCK,
  },
  // Long-tail volatiles priced via WETH UniV3 pools (each recurses to WETH
  // Chainlink). xBTRFLY and rlBTRFLY remap to their respective unwrapped/
  // unlocked equivalents; rlBTRFLY's 0.89 illiquid multiplier is encoded on
  // its TokenDefinition.
  {
    kind: "univ3",
    tokens: [ERC20_FXS, ERC20_WETH],
    id: LP_UNISWAP_V3_FXS_ETH,
    startBlock: ERC20_FXS_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_LDO, ERC20_WETH],
    id: LP_UNISWAP_V3_LDO_WETH,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_LQTY, ERC20_WETH],
    id: LP_UNISWAP_V3_LQTY_WETH,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_WETH, ERC20_BTRFLY_V1],
    id: LP_UNISWAP_V3_WETH_BTRFLY_V1,
    startBlock: ETHEREUM_START_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_WETH, ERC20_BTRFLY_V2],
    id: LP_UNISWAP_V3_WETH_BTRFLY_V2,
    startBlock: ETHEREUM_START_BLOCK,
  },
  // Staked / locked variants remap to their base tokens for pricing.
  {
    kind: "remap",
    tokens: [ERC20_BTRFLY_V1_STAKED],
    id: ERC20_BTRFLY_V1_STAKED,
    target: ERC20_BTRFLY_V1,
  },
  {
    kind: "remap",
    tokens: [ERC20_BTRFLY_V2_RL],
    id: ERC20_BTRFLY_V2_RL,
    target: ERC20_BTRFLY_V2,
  },
  // Balancer V2 POL pools. BPT pricing is handled by getPrice when the
  // requested token == bptAddressFromPoolId(handler.id).
  {
    kind: "balancer",
    tokens: [ERC20_OHM_V2, ERC20_WETH],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_WETH,
    startBlock: LP_BALANCER_OHM_WETH_BLOCK,
  },
  {
    kind: "balancer",
    tokens: [ERC20_OHM_V2, ERC20_DAI],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_DAI,
    startBlock: LP_BALANCER_OHM_DAI_BLOCK,
  },
  {
    kind: "balancer",
    tokens: [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_DAI_WETH,
    startBlock: LP_BALANCER_OHM_DAI_WETH_BLOCK,
  },
  {
    kind: "balancer",
    tokens: [ERC20_OHM_V2, ERC20_WSTETH],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_WSTETH,
    startBlock: LP_BALANCER_OHM_WSTETH_BLOCK,
  },
  // Aura vault wrappers — 1:1 ERC20 wrappers of underlying BPTs. Pricing
  // routes through the Balancer handler via the BPT address.
  {
    kind: "remap",
    tokens: [AURA_VAULT_OHM_WETH],
    id: AURA_VAULT_OHM_WETH,
    target: BPT_OHM_WETH,
  },
  {
    kind: "remap",
    tokens: [AURA_VAULT_OHM_DAI],
    id: AURA_VAULT_OHM_DAI,
    target: BPT_OHM_DAI,
  },
  {
    kind: "remap",
    tokens: [AURA_VAULT_OHM_DAI_WETH],
    id: AURA_VAULT_OHM_DAI_WETH,
    target: BPT_OHM_DAI_WETH,
  },
  {
    kind: "remap",
    tokens: [AURA_VAULT_OHM_WSTETH],
    id: AURA_VAULT_OHM_WSTETH,
    target: BPT_OHM_WSTETH,
  },
  // Convex staked-LP wrappers — 1:1 ERC20 wrappers of underlying Curve LPs.
  // Treasury balances of these come in via TreasuryERC20 Transfer events;
  // pricing routes through the underlying Curve handler. Per inventory §5.
  {
    kind: "remap",
    tokens: [CONVEX_REWARD_OHM_ETH],
    id: CONVEX_REWARD_OHM_ETH,
    target: LP_CURVE_OHM_ETH,
  },
  {
    kind: "remap",
    tokens: [CONVEX_REWARD_OHM_FRAXBP],
    id: CONVEX_REWARD_OHM_FRAXBP,
    target: LP_CURVE_OHM_FRAXBP,
  },
  {
    kind: "remap",
    tokens: [CONVEX_REWARD_FRAX_USDC],
    id: CONVEX_REWARD_FRAX_USDC,
    target: LP_CURVE_FRAX_USDC_LP,
  },
  // ERC4626 yield-bearing vault shares (sDAI / sUSDe / sUSDS / gauntlet
  // sUSDS). `convertToAssets()` provides the share→asset rate; underlying
  // recurses to its Chainlink feed. Carries Chainlink-equivalent priority.
  {
    kind: "erc4626",
    tokens: [ERC20_SDAI],
    id: ERC20_SDAI,
    underlying: ERC20_DAI,
    decimals: 18,
    underlyingDecimals: 18,
    startBlock: ERC20_SDAI_BLOCK,
  },
  {
    kind: "erc4626",
    tokens: [ERC20_SUSDE],
    id: ERC20_SUSDE,
    underlying: ERC20_USDE,
    decimals: 18,
    underlyingDecimals: 18,
    startBlock: ERC20_SUSDE_BLOCK,
  },
  {
    kind: "erc4626",
    tokens: [ERC20_SUSDS],
    id: ERC20_SUSDS,
    underlying: ERC20_USDS,
    decimals: 18,
    underlyingDecimals: 18,
    startBlock: ERC20_SUSDS_BLOCK,
  },
  {
    kind: "erc4626",
    tokens: [ERC20_GAUNTLET_SUSDS_VAULT],
    id: ERC20_GAUNTLET_SUSDS_VAULT,
    underlying: ERC20_USDS,
    decimals: 18,
    underlyingDecimals: 18,
    startBlock: ERC20_GAUNTLET_SUSDS_VAULT_BLOCK,
  },
  // Curve pools (POL). LP-token price = (Σ balance × coin price) / totalSupply.
  // Native ETH appears as a coin in the OHM-ETH pool; remap entry above
  // resolves it to WETH for pricing.
  {
    kind: "curve",
    tokens: [LP_CURVE_OHM_ETH],
    id: LP_CURVE_OHM_ETH,
    lpToken: LP_CURVE_OHM_ETH,
    coins: CURVE_OHM_ETH_COINS,
    coinDecimals: [9, 18],
    startBlock: LP_CURVE_OHM_ETH_BLOCK,
  },
  {
    kind: "curve",
    tokens: [LP_CURVE_OHM_FRAXBP],
    id: LP_CURVE_OHM_FRAXBP,
    lpToken: LP_CURVE_OHM_FRAXBP,
    coins: CURVE_OHM_FRAXBP_COINS,
    coinDecimals: [9, 18],
    startBlock: LP_CURVE_OHM_FRAXBP_BLOCK,
  },
  {
    kind: "curve",
    tokens: [LP_CURVE_FRAX_USDC_LP],
    id: LP_CURVE_FRAX_USDC_POOL,
    // FRAX-USDC is a Curve V2 pool — LP token lives at a separate address
    // (returned by lp_token() in legacy; hard-coded here).
    lpToken: LP_CURVE_FRAX_USDC_LP,
    coins: CURVE_FRAX_USDC_COINS,
    coinDecimals: [18, 6],
    startBlock: LP_CURVE_FRAX_USDC_BLOCK,
  },
  // FraxSwap V1/V2 OHM-FRAX (TWAMM, UniV2-compatible reserves).
  {
    kind: "fraxswap",
    tokens: [LP_FRAXSWAP_V1_OHM_FRAX],
    id: LP_FRAXSWAP_V1_OHM_FRAX,
    token0: ERC20_OHM_V2,
    token1: ERC20_FRAX,
    decimals0: 9,
    decimals1: 18,
    startBlock: LP_FRAXSWAP_V1_OHM_FRAX_BLOCK,
  },
  {
    kind: "fraxswap",
    tokens: [LP_FRAXSWAP_V2_OHM_FRAX],
    id: LP_FRAXSWAP_V2_OHM_FRAX,
    token0: ERC20_OHM_V2,
    token1: ERC20_FRAX,
    decimals0: 9,
    decimals1: 18,
    startBlock: LP_FRAXSWAP_V2_OHM_FRAX_BLOCK,
  },
  // Native ETH prices via WETH (1:1).
  { kind: "remap", tokens: [NATIVE_ETH], id: NATIVE_ETH, target: ERC20_WETH },
  // gOHM = OHM × sOHM-V3 rebase index. The handler reads OhmIndexState
  // (populated by SOhmV3.LogRebase) and recurses to the OHM price via the
  // WETH-OHM UniV3 pool. Carries GOHM_PRIORITY so the deterministic formula
  // wins over any pool-derived gOHM quote (matches legacy resolvePrice).
  {
    kind: "gohm",
    tokens: [ERC20_GOHM],
    id: ERC20_SOHM_V3,
    ohmToken: ERC20_OHM_V2,
    startBlock: ERC20_SOHM_V3_BLOCK,
  },
];

export const ETHEREUM: ChainConfig = {
  chainId: 1,
  blockchain: "Ethereum",
  startBlock: ETHEREUM_START_BLOCK,
  rpcUrls: rpcUrls("ETHEREUM", "https://eth.llamarpc.com"),
  ohmToken: ERC20_OHM_V2,
  ohmStartBlock: ERC20_OHM_V2_BLOCK,
  nativeToken: NATIVE_ETH,
  tokens: [
    token(NATIVE_ETH, "Volatile", true, true, undefined, {
      startBlock: NATIVE_ETH_BLOCK,
      decimals: 18,
    }),
    token(ERC20_DAI, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_FRAX, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_LUSD, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_USDC, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 6,
    }),
    token(ERC20_USDT, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 6,
    }),
    token(ERC20_USDE, "Stable", true, false, undefined, {
      startBlock: ERC20_USDE_BLOCK,
      decimals: 18,
    }),
    token(ERC20_USDS, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    // Aave V2 aDAI receipt (matches underlying DAI rate via shared Chainlink feed).
    token(ERC20_ADAI, "Stable", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    // Aave V3 aEthUSDe receipt (matches underlying USDe rate via shared feed).
    token(ERC20_AETH_USDE, "Stable", true, false, undefined, {
      startBlock: ERC20_AAVE_V3_BLOCK,
      decimals: 18,
    }),
    // Aave V3 variable-debt receipts — liabilities (subtract from treasury MV).
    // Underlying tokens are 6-decimal USDC/USDT, so the debt tokens share those
    // decimals.
    token(ERC20_VAR_DEBT_ETH_USDC, "Stable", true, false, undefined, {
      startBlock: ERC20_AAVE_V3_BLOCK,
      decimals: 6,
      isLiability: true,
    }),
    token(ERC20_VAR_DEBT_ETH_USDT, "Stable", true, false, undefined, {
      startBlock: ERC20_AAVE_V3_BLOCK,
      decimals: 6,
      isLiability: true,
    }),
    // ERC4626 yield-bearing stables. Underlying price comes from Chainlink;
    // share→asset rate from `convertToAssets()` via Erc4626PriceHandler.
    token(ERC20_SDAI, "Stable", true, false, undefined, {
      startBlock: ERC20_SDAI_BLOCK,
      decimals: 18,
    }),
    token(ERC20_SUSDE, "Stable", true, false, undefined, {
      startBlock: ERC20_SUSDE_BLOCK,
      decimals: 18,
    }),
    token(ERC20_SUSDS, "Stable", true, false, undefined, {
      startBlock: ERC20_SUSDS_BLOCK,
      decimals: 18,
    }),
    token(ERC20_GAUNTLET_SUSDS_VAULT, "Stable", true, false, undefined, {
      startBlock: ERC20_GAUNTLET_SUSDS_VAULT_BLOCK,
      decimals: 18,
    }),
    // Convex staked-LP wrappers (POL category — protocol-owned liquidity).
    // Pricing routes through the underlying Curve LP via `remap` handlers.
    token(CONVEX_REWARD_OHM_ETH, "POL", false, false, undefined, {
      startBlock: LP_CURVE_OHM_ETH_BLOCK,
      decimals: 18,
    }),
    token(CONVEX_REWARD_OHM_FRAXBP, "POL", false, false, undefined, {
      startBlock: LP_CURVE_OHM_FRAXBP_BLOCK,
      decimals: 18,
    }),
    token(CONVEX_REWARD_FRAX_USDC, "POL", false, false, undefined, {
      startBlock: LP_CURVE_FRAX_USDC_BLOCK,
      decimals: 18,
    }),
    // Aura vault wrappers (POL). Pricing routes through Balancer BPT remap.
    token(AURA_VAULT_OHM_WETH, "POL", false, false, undefined, {
      startBlock: LP_BALANCER_OHM_WETH_BLOCK,
      decimals: 18,
    }),
    token(AURA_VAULT_OHM_DAI, "POL", false, false, undefined, {
      startBlock: LP_BALANCER_OHM_DAI_BLOCK,
      decimals: 18,
    }),
    token(AURA_VAULT_OHM_DAI_WETH, "POL", false, false, undefined, {
      startBlock: LP_BALANCER_OHM_DAI_WETH_BLOCK,
      decimals: 18,
    }),
    token(AURA_VAULT_OHM_WSTETH, "POL", false, false, undefined, {
      startBlock: LP_BALANCER_OHM_WSTETH_BLOCK,
      decimals: 18,
    }),
    token(ERC20_WETH, "Volatile", true, true, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_WSTETH, "Volatile", true, true, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_WEETH, "Volatile", true, true, undefined, {
      startBlock: ERC20_WEETH_BLOCK,
      decimals: 18,
    }),
    // Long-tail volatiles (no hard-coded multiplier).
    token(ERC20_FXS, "Volatile", true, false, undefined, {
      startBlock: ERC20_FXS_BLOCK,
      decimals: 18,
    }),
    token(ERC20_LDO, "Volatile", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_LQTY, "Volatile", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_BTRFLY_V1, "Volatile", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_BTRFLY_V1_STAKED, "Volatile", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_BTRFLY_V2, "Volatile", true, false, undefined, {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    // rlBTRFLY carries the legacy 0.89 illiquid multiplier (per inventory §2.2,
    // PriceHandlerCustomMapping legacy hard-code).
    token(ERC20_BTRFLY_V2_RL, "Volatile", false, false, "0.89", {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
    // OHM V1 and V2 are tracked but value-excluded from treasury MV when held
    // by protocol wallets (multiplier 0). For the baseline, the protocol
    // wallet blacklist below excludes both from treasury balance entirely;
    // they get counted on the supply side.
    token(ERC20_OHM_V1, "Volatile", true, false, "0", {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 9,
    }),
    token(ERC20_OHM_V2, "Volatile", true, false, "0", {
      startBlock: ERC20_OHM_V2_BLOCK,
      decimals: 9,
    }),
    token(ERC20_GOHM, "Volatile", true, false, "0", {
      startBlock: ETHEREUM_START_BLOCK,
      decimals: 18,
    }),
  ],
  names,
  abbreviations,
  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: PROTOCOL_ADDRESSES,
  // Per inventory section 3: OHM V1/V2/gOHM held in protocol wallets is
  // excluded from treasury market value (counted on the supply side via
  // getTreasuryOHMRecords). Phase 4 follow-up will refine this once Bophades
  // dynamic wallets are wired (Buyback MS becomes IN the MV after block
  // 20514801 per OHM_IN_MARKET_VALUE_BLOCK).
  treasuryBlacklist: {
    [ERC20_OHM_V1]: PROTOCOL_ADDRESSES,
    [ERC20_OHM_V2]: PROTOCOL_ADDRESSES,
    [ERC20_GOHM]: PROTOCOL_ADDRESSES,
  },
  basePriceFeeds: {},
  coolerClearinghouses,
  // Olympus Boosted Liquidity Vault registry (per inventory §8). The effect
  // iterates active vaults and reads getPoolOhmShare() per vault. Active
  // after the OHM_INCUR_DEBT_BLOCK = 17_620_000 gate.
  blvRegistry: {
    address: addr("0x375E06C694B5E50aF8be8FB03495A612eA3e2275"),
    startBlock: 17_620_000,
  },
  // Olympus V1 BondManager + Gnosis EasyAuction. Drives the bond
  // pre-minted / vesting / vested supply rows. Indexer-side runtime is
  // gated by the BOND_MANAGER_BLOCK = 16_226_955.
  bondManager: {
    address: addr("0xf577c77ee3578c7f216327f41b5d7221ead2b2a3"),
    startBlock: 16_226_955,
  },
  // OHM V1 → V2 migration offset. Per inventory §7: 2013 × sOHM-V3 index
  // OHM is subtracted from total supply between [14_381_564, 24_550_660)
  // to account for stranded gOHM pre-minted for OHM V1 LP migrations.
  migrationOffset: {
    migrationContract: addr("0x184f3fad8618a6f458c16bae63f70c426fe784b3"),
    sOhmAddress: ERC20_SOHM_V3,
    offsetOhm: "2013",
    startBlock: 14_381_564,
    endBlock: 24_550_660,
  },
  // Olympus staking contracts (per inventory §8 + Constants.ts:139-143). The
  // APY effect reads the per-epoch distribution from whichever versions are
  // active at the snapshot block (V1 always tried; V2/V3 gated).
  stakingContracts: {
    v1: addr("0x0822f3c03dcc24d200aff33493dc08d0e1f274a2"),
    v2: addr("0xfd31c7d00ca47653c6ce64af53c1571f9c36566a"),
    v2StartBlock: 12_622_679,
    v3: addr("0xB63cac384247597756545b500253ff8E607a8020"),
    v3StartBlock: 13_804_019,
  },
  // UniV3 NonfungiblePositionManager (per inventory §5). Treasury POL via
  // UniV3 NFTs (WETH-OHM, OHM-sUSDS) is enumerated per snapshot.
  univ3PositionManager: {
    address: addr("0xC36442b4a4522E871399CD717aBDD847Ab11FE88"),
    startBlock: ERC20_OHM_V2_BLOCK,
  },
  liquidityHandlers,
  ownedLiquidityHandlers,
};
