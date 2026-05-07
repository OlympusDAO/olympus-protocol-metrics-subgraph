import { addr, bytes32, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { rpcUrls } from "./rpc";

const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
const DAO_WORKING_CAPITAL = addr("0xF65A665D650B5De224F46D729e2bD0885EeA9dA5");
const BONDS_DEPOSIT = addr("0x9025046c6fb25Fb39e720d97a8FD881ED69a1Ef6");
const BONDS_INVERSE_DEPOSIT = addr("0xBA42BE149e5260EbA4B82418A6306f55D532eA47");
const TREASURY_ADDRESS_V1 = addr("0x886CE997aa9ee4F8c2282E182aB72A705762399D");
const TREASURY_ADDRESS_V2 = addr("0x31f8cc382c9898b273eff4e0b7626a6987c846e8");
const TREASURY_ADDRESS_V3 = addr("0x9A315BdF513367C0377FB36545857d12e85813Ef");
const CROSS_CHAIN_ARBITRUM = addr("0x012BBf0481b97170577745D2167ee14f63E2aD4C");
const CROSS_CHAIN_FANTOM = addr("0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10");
const CROSS_CHAIN_POLYGON = addr("0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7");
const OTC_ESCROW = addr("0xe3312c3f1ab30878d9686452f7205ebe11e965eb");
const AAVE_ALLOCATOR_V2 = addr("0x0d33c811d0fcc711bcb388dfb3a152de445be66f");
const AAVE_ALLOCATOR = addr("0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4");
const BALANCER_ALLOCATOR = addr("0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6");
const BUYBACK_MS = addr("0xf7deb867e65306be0cb33918ac1b8f89a72109db");
export const OLYMPUS_LENDER = addr("0x868C3ae18Fdea85bBb7a303e379c5B7e23b30F03");
export const SILO_COLLATERAL = addr("0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae");
export const SENTIMENT_LTOKEN = addr("0x37E6a0EcB9e8E5D90104590049a0A197E1363b67");

const ERC20_ARB = addr("0x912ce59144191c1204e64559fe8253a0e49e6548");
const ERC20_FRAX = addr("0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F");
const ERC20_OHM = addr("0xf0cb2dc0db5e6c66B9a70Ac27B06b878da017028");
const ERC20_GOHM_SYNAPSE = addr("0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1");
const ERC20_JONES = addr("0x10393c20975cf177a3513071bc110f7962cd67da");
const ERC20_LQTY = addr("0xfb9E5D956D889D91a82737B9bFCDaC1DCE3e1449");
const ERC20_LUSD = addr("0x93b346b6bc2548da6a1e7d98e9a421b42541425b");
const ERC20_MAGIC = addr("0x539bde0d7dbd336b79148aa742883198bbf60342");
const ERC20_USDC = addr("0xff970a61a04b1ca14834a43f5de4533ebddb5cc8");
const ERC20_VSTA = addr("0xa684cd057951541187f288294a1e1c2646aa2d24");
const ERC20_WETH = addr("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1");

const BALANCER_VAULT = addr("0xBA12222222228d8Ba445958a75a0704d566BF2C8");
const LP_BALANCER_POOL_WETH_VESTA = bytes32(
  "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d",
);
const LP_BALANCER_POOL_WETH_OHM = bytes32(
  "0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423",
);
const LP_BALANCER_POOL_OHM_USDC = bytes32(
  "0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424",
);
const LP_UNISWAP_V2_GOHM_WETH = addr("0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d");
const LP_UNISWAP_V2_JONES_WETH = addr("0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c");
const LP_UNISWAP_V2_LQTY_WETH = addr("0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf");
const LP_UNISWAP_V2_MAGIC_WETH = addr("0xb7e50106a5bd3cf21af210a755f9c8740890a8c9");
const LP_CAMELOT_OHM_WETH = addr("0x8aCd42e4B5A5750B44A28C5fb50906eBfF145359");
const LP_UNISWAP_V3_ARB_WETH = addr("0xc6f780497a95e246eb9449f5e4770916dcd6396a");
const LP_UNISWAP_V3_WETH_USDC = addr("0xc31e54c7a869b9fcbecc14363cf510d1c41fa443");

export const ARBITRUM_PROTOCOL_ADDRESSES = [
  AAVE_ALLOCATOR_V2,
  AAVE_ALLOCATOR,
  BALANCER_ALLOCATOR,
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  BUYBACK_MS,
  CROSS_CHAIN_ARBITRUM,
  CROSS_CHAIN_FANTOM,
  CROSS_CHAIN_POLYGON,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
];

const names: Record<string, string> = {
  [AAVE_ALLOCATOR]: "Aave Allocator V1",
  [AAVE_ALLOCATOR_V2]: "Aave Allocator V2",
  [BALANCER_ALLOCATOR]: "Balancer Allocator",
  [BALANCER_VAULT]: "Balancer Vault",
  [BONDS_DEPOSIT]: "Bond Depository",
  [BONDS_INVERSE_DEPOSIT]: "Bond (Inverse) Depository",
  [BUYBACK_MS]: "Buyback MS",
  [CROSS_CHAIN_ARBITRUM]: "Cross-Chain Arbitrum",
  [CROSS_CHAIN_FANTOM]: "Cross-Chain Fantom",
  [CROSS_CHAIN_POLYGON]: "Cross-Chain Polygon",
  [DAO_WALLET]: "Treasury MS (Formerly DAO Wallet)",
  [DAO_WORKING_CAPITAL]: "DAO Working Capital",
  [ERC20_ARB]: "Arbitrum",
  [ERC20_FRAX]: "FRAX",
  [ERC20_GOHM_SYNAPSE]: "Governance OHM (Synapse)",
  [ERC20_JONES]: "JonesDAO",
  [ERC20_LQTY]: "Liquity",
  [ERC20_LUSD]: "Liquity USD",
  [ERC20_MAGIC]: "TreasureDAO",
  [ERC20_OHM]: "OHM",
  [ERC20_USDC]: "USDC",
  [ERC20_VSTA]: "Vesta",
  [ERC20_WETH]: "Wrapped ETH",
  [OLYMPUS_LENDER]: "Olympus Lender",
  [OTC_ESCROW]: "OTC Escrow",
  [SENTIMENT_LTOKEN]: "Sentiment Finance",
  [SILO_COLLATERAL]: "Silo OHM Collateral",
  [TREASURY_ADDRESS_V1]: "Treasury Wallet V1",
  [TREASURY_ADDRESS_V2]: "Treasury Wallet V2",
  [TREASURY_ADDRESS_V3]: "Treasury Wallet V3",
  [LP_BALANCER_POOL_WETH_VESTA]: "Balancer wETH-VSTA Liquidity Pool",
  [LP_BALANCER_POOL_WETH_OHM]: "Balancer wETH-OHM Liquidity Pool",
  [LP_BALANCER_POOL_OHM_USDC]: "Balancer OHM-USDC Liquidity Pool",
  [LP_UNISWAP_V2_GOHM_WETH]: "UniswapV2 gOHM-wETH Liquidity Pool",
  [LP_UNISWAP_V2_JONES_WETH]: "UniswapV2 JONES-wETH Liquidity Pool",
  [LP_UNISWAP_V2_LQTY_WETH]: "Ramses LQTY-wETH Liquidity Pool",
  [LP_UNISWAP_V2_MAGIC_WETH]: "UniswapV2 MAGIC-wETH Liquidity Pool",
  [LP_CAMELOT_OHM_WETH]: "Camelot OHM-wETH Liquidity Pool",
  [LP_UNISWAP_V3_ARB_WETH]: "UniswapV3 ARB-wETH Liquidity Pool",
  [LP_UNISWAP_V3_WETH_USDC]: "UniswapV3 wETH-USDC Liquidity Pool",
};

const liquidityHandlers: LiquidityHandler[] = [
  {
    kind: "balancer",
    tokens: [ERC20_WETH, ERC20_VSTA],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_WETH_VESTA,
  },
  {
    kind: "balancer",
    tokens: [ERC20_WETH, ERC20_OHM],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_WETH_OHM,
  },
  {
    kind: "balancer",
    tokens: [ERC20_OHM, ERC20_USDC],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_USDC,
  },
  { kind: "stable", tokens: [ERC20_FRAX, ERC20_USDC], id: "frax-usdc" },
  { kind: "univ2", tokens: [ERC20_GOHM_SYNAPSE, ERC20_WETH], id: LP_UNISWAP_V2_GOHM_WETH },
  { kind: "univ2", tokens: [ERC20_JONES, ERC20_WETH], id: LP_UNISWAP_V2_JONES_WETH },
  { kind: "univ2", tokens: [ERC20_LQTY, ERC20_WETH], id: LP_UNISWAP_V2_LQTY_WETH },
  { kind: "univ2", tokens: [ERC20_MAGIC, ERC20_WETH], id: LP_UNISWAP_V2_MAGIC_WETH },
  { kind: "univ2", tokens: [ERC20_OHM, ERC20_WETH], id: LP_CAMELOT_OHM_WETH },
  { kind: "univ3", tokens: [ERC20_USDC, ERC20_WETH], id: LP_UNISWAP_V3_WETH_USDC },
  { kind: "univ3", tokens: [ERC20_ARB, ERC20_WETH], id: LP_UNISWAP_V3_ARB_WETH },
];

export const ARBITRUM: ChainConfig = {
  chainId: 42161,
  blockchain: "Arbitrum",
  rpcUrls: rpcUrls("ARBITRUM", "https://arb1.arbitrum.io/rpc"),
  ohmToken: ERC20_OHM,
  tokens: [
    token(ERC20_ARB, "Volatile", true, false),
    token(ERC20_FRAX, "Stable", true, false),
    token(ERC20_JONES, "Volatile", true, false, "0.83"),
    token(ERC20_LQTY, "Volatile", true, false),
    token(ERC20_LUSD, "Stable", true, false),
    token(ERC20_MAGIC, "Volatile", true, false),
    token(ERC20_USDC, "Stable", true, false),
    token(ERC20_VSTA, "Volatile", true, false, "0.77"),
    token(ERC20_WETH, "Volatile", true, true),
    token(LP_BALANCER_POOL_WETH_VESTA, "Protocol-Owned Liquidity", true, false),
    token(LP_BALANCER_POOL_WETH_OHM, "Protocol-Owned Liquidity", true, false),
    token(LP_BALANCER_POOL_OHM_USDC, "Protocol-Owned Liquidity", true, false),
    token(LP_UNISWAP_V2_GOHM_WETH, "Protocol-Owned Liquidity", true, false),
    token(LP_UNISWAP_V2_JONES_WETH, "Protocol-Owned Liquidity", true, false),
    token(LP_UNISWAP_V2_MAGIC_WETH, "Protocol-Owned Liquidity", true, false),
    token(LP_CAMELOT_OHM_WETH, "Protocol-Owned Liquidity", true, false),
    token(LP_UNISWAP_V3_ARB_WETH, "Protocol-Owned Liquidity", true, false),
    token(LP_UNISWAP_V3_WETH_USDC, "Protocol-Owned Liquidity", true, false),
  ],
  names,
  abbreviations: {
    [ERC20_ARB]: "ARB",
    [ERC20_JONES]: "JONES",
    [ERC20_LQTY]: "LQTY",
    [ERC20_LUSD]: "LUSD",
    [ERC20_MAGIC]: "MAGIC",
    [ERC20_VSTA]: "VSTA",
    [ERC20_WETH]: "wETH",
    [ERC20_GOHM_SYNAPSE]: "gOHM",
  },
  protocolAddresses: ARBITRUM_PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: [
    BONDS_DEPOSIT,
    BONDS_INVERSE_DEPOSIT,
    CROSS_CHAIN_ARBITRUM,
    DAO_WALLET,
    DAO_WORKING_CAPITAL,
    OTC_ESCROW,
    TREASURY_ADDRESS_V1,
    TREASURY_ADDRESS_V2,
    TREASURY_ADDRESS_V3,
  ],
  treasuryBlacklist: {
    [ERC20_OHM]: ARBITRUM_PROTOCOL_ADDRESSES,
    [ERC20_GOHM_SYNAPSE]: ARBITRUM_PROTOCOL_ADDRESSES,
  },
  basePriceFeeds: {
    [ERC20_LUSD]: addr("0x0411d28c94d85a36bc72cb0f875dfa8371d8ffff"),
    [ERC20_USDC]: addr("0x50834f3163758fcc1df9973b6e91f0f0f0434ad3"),
    [ERC20_WETH]: addr("0x639fe6ab55c921f74e7fac1ee960c0b6293ba612"),
  },
  liquidityHandlers,
  ownedLiquidityHandlers: liquidityHandlers,
};
