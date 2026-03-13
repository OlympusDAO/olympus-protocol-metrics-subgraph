import type { Address } from "viem";
import type { ChainConfig, TokenDefinition, PriceHandlerConfig, ChainlinkFeed } from "../types";

// --- Token Addresses ---

const ERC20_DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063" as Address;
const ERC20_FRAX = "0x45c32fa6df82ead1e2ef74d17b76547eddfaff89" as Address;
const ERC20_GOHM = "0xd8ca34fd379d9ca3c6ee3b3905678320f5b45195" as Address;
const ERC20_KLIMA = "0x4e78011ce80ee02d2c3e649fb657e45898257815" as Address;
const ERC20_KLIMA_STAKED = "0xb0c22d8d350c67420f06f48936654f567c73e8c8" as Address;
const ERC20_SYN = "0x50b728d8d964fd00c2d0aad81718b71311fef68a" as Address;
const ERC20_USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174" as Address;
const ERC20_WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619" as Address;

// --- LP Addresses ---

const LP_UNISWAP_V2_KLIMA_USDC = "0x5786b267d35f9d011c4750e0b0ba584e1fdbead1" as Address;
const LP_UNISWAP_V2_SYN_WETH = "0x4a86c01d67965f8cb3d0aaa2c655705e64097c31" as Address;
const LP_UNISWAP_V2_USDC_WETH = "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d" as Address;
const LP_UNISWAP_V2_WETH_GOHM = "0x1549e0e8127d380080aab448b82d280433ce4030" as Address;

// --- Shared Wallet Addresses (Ethereum treasury addresses) ---

const TREASURY_ADDRESS_V1 = "0x886ce997aa9ee4f8c2282e182ab72a705762399d" as Address;
const TREASURY_ADDRESS_V2 = "0x31f8cc382c9898b273eff4e0b7626a6987c846e8" as Address;
const TREASURY_ADDRESS_V3 = "0x9a315bdf513367c0377fb36545857d12e85813ef" as Address;
const BONDS_DEPOSIT = "0x9025046c6fb25fb39e720d97a8fd881ed69a1ef6" as Address;
const BONDS_INVERSE_DEPOSIT = "0xba42be149e5260eba4b82418a6306f55d532ea47" as Address;
const DAO_WALLET = "0x245cc372c84b3645bf0ffe6538620b04a217988b" as Address;
const DAO_WORKING_CAPITAL = "0xf65a665d650b5de224f46d729e2bd0885eea9da5" as Address;
const OTC_ESCROW = "0xe3312c3f1ab30878d9686452f7205ebe11e965eb" as Address;
const TRSRY = "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613" as Address;
const COOLER_LOANS_CLEARINGHOUSE_V1 = "0xd6a6e8d9e82534bd65821142fccd91ec9cf31880" as Address;
const COOLER_LOANS_CLEARINGHOUSE_V1_1 = "0xe6343ad0675c9b8d3f32679ae6adba0766a2ab4c" as Address;
const COOLER_LOANS_CLEARINGHOUSE_V2 = "0x1e094fe00e13fd06d64eea4fb3cd912893606fe0" as Address;
const COOLER_LOANS_V2_MONOCOOLER = "0xdb591ea2e5db886da872654d58f6cc584b68e7cc" as Address;
const BUYBACK_MS = "0xf7deb867e65306be0cb33918ac1b8f89a72109db" as Address;
const CROSS_CHAIN_ARBITRUM = "0x012bbf0481b97170577745d2167ee14f63e2ad4c" as Address;
const CROSS_CHAIN_FANTOM = "0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10" as Address;
const CROSS_CHAIN_POLYGON = "0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7" as Address;

// --- Allocators ---

const AAVE_ALLOCATOR = "0x0e1177e47151be72e5992e0975000e73ab5fd9d4" as Address;
const AURA_ALLOCATOR = "0x872ebdd8129370f6c4f9e5b1ebd22bb6bdefc01c" as Address;
const BALANCER_ALLOCATOR = "0xa9078e573ec536c4066a5e89f715553ed67b13e0" as Address;
const CONVEX_ALLOCATOR1 = "0x3df5a355457db3a4b5c744b8623a7721bf56df78" as Address;

// --- Composed Address Lists ---

const WALLET_ADDRESSES: Address[] = [
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TRSRY,
  COOLER_LOANS_CLEARINGHOUSE_V1,
  COOLER_LOANS_CLEARINGHOUSE_V1_1,
  COOLER_LOANS_CLEARINGHOUSE_V2,
  COOLER_LOANS_V2_MONOCOOLER,
  BUYBACK_MS,
  CROSS_CHAIN_ARBITRUM,
  CROSS_CHAIN_FANTOM,
  CROSS_CHAIN_POLYGON,
  AAVE_ALLOCATOR,
  AURA_ALLOCATOR,
  BALANCER_ALLOCATOR,
  CONVEX_ALLOCATOR1,
];

const PROTOCOL_ADDRESSES: Address[] = [...WALLET_ADDRESSES];

const CIRCULATING_SUPPLY_WALLETS: Address[] = [...WALLET_ADDRESSES];

// --- Treasury Blacklist ---

const TREASURY_BLACKLIST = new Map<Address, Address[]>();

// --- Token Definitions ---

const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    address: ERC20_DAI,
    name: "DAI",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_FRAX,
    name: "FRAX",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_KLIMA_STAKED,
    name: "sKLIMA",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 0.85,
  },
  {
    address: ERC20_KLIMA,
    name: "KLIMA",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 0.85,
  },
  {
    address: ERC20_SYN,
    name: "SYN",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_USDC,
    name: "USDC",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_WETH,
    name: "WETH",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_WETH_GOHM,
    name: "SushiSwap WETH-gOHM",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
];

// --- Chainlink Feeds ---

const CHAINLINK_FEEDS: ChainlinkFeed[] = [];

// --- Price Handlers ---

const PRICE_HANDLERS: PriceHandlerConfig[] = [
  {
    type: "customMapping",
    id: "custom-klima-sklima",
    tokens: ["KLIMA", "KLIMA_STAKED"],
  },
  {
    type: "stablecoin",
    id: "stablecoin-dai-frax-usdc",
    tokens: ["DAI", "FRAX", "USDC"],
  },
  {
    type: "uniswapV2",
    id: "univ2-gohm-weth",
    tokens: ["GOHM", "WETH"],
    pool: LP_UNISWAP_V2_WETH_GOHM,
  },
  {
    type: "uniswapV2",
    id: "univ2-klima-usdc",
    tokens: ["KLIMA", "USDC"],
    pool: LP_UNISWAP_V2_KLIMA_USDC,
  },
  {
    type: "uniswapV2",
    id: "univ2-syn-weth",
    tokens: ["SYN", "WETH"],
    pool: LP_UNISWAP_V2_SYN_WETH,
  },
  {
    type: "uniswapV2",
    id: "univ2-usdc-weth",
    tokens: ["USDC", "WETH"],
    pool: LP_UNISWAP_V2_USDC_WETH,
  },
];

// --- Block Guards ---

const START_BLOCK = 0n;

// --- Export ---

export const polygonConfig: ChainConfig = {
  chainId: 137,
  blockchain: "Polygon",

  ohmAddress: ERC20_GOHM,
  ohmTokens: [ERC20_GOHM],

  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: CIRCULATING_SUPPLY_WALLETS,
  treasuryBlacklist: TREASURY_BLACKLIST,

  tokenDefinitions: TOKEN_DEFINITIONS,
  priceHandlers: PRICE_HANDLERS,
  chainlinkFeeds: CHAINLINK_FEEDS,

  startBlock: START_BLOCK,
};
