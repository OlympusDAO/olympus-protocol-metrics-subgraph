import { addr, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { WALLET_ADDRESSES } from "../wallets";
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

const ERC20_DAI = addr("0x6b175474e89094c44da98b954eedeac495271d0f");
const ERC20_FRAX = addr("0x853d955acef822db058eb8505911ed77f175b99e");
const ERC20_LUSD = addr("0x5f98805a4e8be255a32880fdec7f6728c6568ba0");
const ERC20_USDC = addr("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const ERC20_USDT = addr("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const ERC20_USDE = addr("0x4c9EDD5852cd905f086C759E8383e09bff1E68B3");
const ERC20_USDS = addr("0xdC035D45d973E3EC169d2276DDab16f1e407384F");

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

const LP_UNISWAP_V3_WETH_OHM = addr("0x88051b0eea095007d3bef21ab287be961f3d8598");
const LP_UNISWAP_V3_WETH_WSTETH = addr("0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa");
const LP_UNISWAP_V3_WEETH_WETH = addr("0x202A6012894Ae5c288eA824cbc8A9bfb26A49b93");
const LP_UNISWAP_V3_FXS_ETH = addr("0xcd8286b48936cdac20518247dbd310ab681a9fbf");
const LP_UNISWAP_V3_LDO_WETH = addr("0xa3f558aebaecaf0e11ca4b2199cc5ed341edfd74");
const LP_UNISWAP_V3_LQTY_WETH = addr("0xd1d5a4c0ea98971894772dcd6d2f1dc71083c44e");
const LP_UNISWAP_V3_WETH_BTRFLY_V1 = addr("0xdf9ab3c649005ebfdf682d2302ca1f673e0d37a2");
const LP_UNISWAP_V3_WETH_BTRFLY_V2 = addr("0x3e6e23198679419cd73bb6376518dcc5168c8260");

// ---- Block windows (per inventory section 2.1). ----

const ETHEREUM_START_BLOCK = 12_000_000; // ~2021-04-29, before Treasury V2 (12525281).
const ERC20_OHM_V2_BLOCK = 13_782_589;
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
  // Native ETH prices via WETH (1:1).
  { kind: "remap", tokens: [NATIVE_ETH], id: NATIVE_ETH, target: ERC20_WETH },
  // gOHM price = OHM price × index — implemented as a follow-up; for now
  // gOHM falls through and prices at 0 unless a pool handler covers it.
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
  liquidityHandlers,
  ownedLiquidityHandlers,
};
