import type { Address } from "viem";
import type { ChainConfig, TokenDefinition, PriceHandlerConfig, ChainlinkFeed } from "../types";

// --- Token Addresses ---

const ERC20_ARB = "0x912ce59144191c1204e64559fe8253a0e49e6548" as Address;
const ERC20_FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f" as Address;
const ERC20_OHM = "0xf0cb2dc0db5e6c66b9a70ac27b06b878da017028" as Address;
const ERC20_GOHM_SYNAPSE = "0x8d9ba570d6cb60c7e3e0f31343efe75ab8e65fb1" as Address;
const ERC20_JONES = "0x10393c20975cf177a3513071bc110f7962cd67da" as Address;
const ERC20_LQTY = "0xfb9e5d956d889d91a82737b9bfcdac1dce3e1449" as Address;
const ERC20_LUSD = "0x93b346b6bc2548da6a1e7d98e9a421b42541425b" as Address;
const ERC20_MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342" as Address;
const ERC20_USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8" as Address;
const ERC20_VSTA = "0xa684cd057951541187f288294a1e1c2646aa2d24" as Address;
const ERC20_WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address;

// --- LP Addresses ---

const LP_BALANCER_POOL_WETH_VESTA = "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d";
const LP_BALANCER_POOL_WETH_OHM = "0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423";
const LP_BALANCER_POOL_OHM_USDC = "0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424";
const LP_UNISWAP_V2_GOHM_WETH = "0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d" as Address;
const LP_UNISWAP_V2_JONES_GOHM_GOHM = "0x292d1587a6bb37e34574c9ad5993f221d8a5616c" as Address;
const LP_UNISWAP_V2_JONES_WETH = "0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c" as Address;
const LP_UNISWAP_V2_LQTY_WETH = "0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf" as Address;
const LP_UNISWAP_V2_MAGIC_WETH = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9" as Address;
const LP_CAMELOT_OHM_WETH = "0x8acd42e4b5a5750b44a28c5fb50906ebff145359" as Address;
const LP_UNISWAP_V3_ARB_WETH = "0xc6f780497a95e246eb9449f5e4770916dcd6396a" as Address;
const LP_UNISWAP_V3_WETH_USDC = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443" as Address;

// --- Infrastructure ---

const BALANCER_VAULT = "0xba12222222228d8ba445958a75a0704d566bf2c8" as Address;
const JONES_STAKING = "0xb94d1959084081c5a11c460012ab522f5a0fd756" as Address;
const TREASURE_ATLAS_MINE = "0xa0a89db1c899c49f98e6326b764bafcf167fc2ce" as Address;
const OLYMPUS_LENDER = "0x868c3ae18fdea85bbb7a303e379c5b7e23b30f03" as Address;
const SILO_REPOSITORY = "0x8658047e48cc09161f4152c79155dac1d710ff0a" as Address;
const SILO_ADDRESS = "0x9992f660137979c1ca7f8b119cd16361594e3681" as Address;
const SENTIMENT_LTOKEN = "0x37e6a0ecb9e8e5d90104590049a0a197e1363b67" as Address;
const DAO_MULTISIG = "0x012bbf0481b97170577745d2167ee14f63e2ad4c" as Address;
const UNISWAP_V3_POSITION_MANAGER = "0xc36442b4a4522e871399cd717abdd847ab11fe88" as Address;

// --- Shared Wallet Addresses ---

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

// --- Allocators ---

const AAVE_ALLOCATOR = "0x0e1177e47151be72e5992e0975000e73ab5fd9d4" as Address;
const AURA_ALLOCATOR = "0x872ebdd8129370f6c4f9e5b1ebd22bb6bdefc01c" as Address;
const BALANCER_ALLOCATOR = "0xa9078e573ec536c4066a5e89f715553ed67b13e0" as Address;
const CONVEX_ALLOCATOR1 = "0x3df5a355457db3a4b5c744b8623a7721bf56df78" as Address;

// --- Composed Address Lists ---

const WALLET_ADDRESSES = [
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
  AAVE_ALLOCATOR,
  AURA_ALLOCATOR,
  BALANCER_ALLOCATOR,
  CONVEX_ALLOCATOR1,
] as const;

const PROTOCOL_ADDRESSES: Address[] = [...WALLET_ADDRESSES, DAO_MULTISIG];

const CIRCULATING_SUPPLY_WALLETS: Address[] = [
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  DAO_MULTISIG,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
];

// --- Treasury Blacklist ---

const TREASURY_BLACKLIST = new Map<Address, Address[]>([
  [ERC20_GOHM_SYNAPSE, [...PROTOCOL_ADDRESSES]],
  [ERC20_OHM, [...PROTOCOL_ADDRESSES]],
]);

// --- Token Definitions ---

const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    address: ERC20_ARB,
    name: "ARB",
    category: "Volatile",
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
    address: ERC20_JONES,
    name: "JONES",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 0.83,
  },
  {
    address: ERC20_LQTY,
    name: "LQTY",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_LUSD,
    name: "LUSD",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_MAGIC,
    name: "MAGIC",
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
    address: ERC20_VSTA,
    name: "VSTA",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 0.77,
  },
  {
    address: ERC20_WETH,
    name: "WETH",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
    liquidBackingMultiplier: 1.0,
  },
  // Balancer LPs
  {
    address: LP_BALANCER_POOL_WETH_VESTA.slice(0, 42) as Address,
    name: "Balancer WETH-VSTA",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_BALANCER_POOL_WETH_OHM.slice(0, 42) as Address,
    name: "Balancer WETH-OHM",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_BALANCER_POOL_OHM_USDC.slice(0, 42) as Address,
    name: "Balancer OHM-USDC",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  // UniswapV2 LPs
  {
    address: LP_UNISWAP_V2_GOHM_WETH,
    name: "SushiSwap gOHM-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_JONES_GOHM_GOHM,
    name: "SushiSwap JONES/gOHM-gOHM",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_JONES_WETH,
    name: "SushiSwap JONES-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_LQTY_WETH,
    name: "SushiSwap LQTY-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_MAGIC_WETH,
    name: "SushiSwap MAGIC-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  // Camelot LP
  {
    address: LP_CAMELOT_OHM_WETH,
    name: "Camelot OHM-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  // UniswapV3 LPs
  {
    address: LP_UNISWAP_V3_ARB_WETH,
    name: "UniswapV3 ARB-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V3_WETH_USDC,
    name: "UniswapV3 WETH-USDC",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
];

// --- Chainlink Feeds ---

const CHAINLINK_FEEDS: ChainlinkFeed[] = [
  { token: "LUSD", feedAddress: "0x0411d28c94d85a36bc72cb0f875dfa8371d8ffff" as Address },
  { token: "USDC", feedAddress: "0x50834f3163758fcc1df9973b6e91f0f0f0434ad3" as Address },
  { token: "WETH", feedAddress: "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612" as Address },
];

// --- Price Handlers ---

const PRICE_HANDLERS: PriceHandlerConfig[] = [
  {
    type: "balancer",
    id: "balancer-weth-vsta",
    tokens: ["WETH", "VSTA"],
    pool: LP_BALANCER_POOL_WETH_VESTA,
    auxContract: BALANCER_VAULT,
  },
  {
    type: "balancer",
    id: "balancer-weth-ohm",
    tokens: ["WETH", "OHM"],
    pool: LP_BALANCER_POOL_WETH_OHM,
    auxContract: BALANCER_VAULT,
  },
  {
    type: "balancer",
    id: "balancer-ohm-usdc",
    tokens: ["OHM", "USDC"],
    pool: LP_BALANCER_POOL_OHM_USDC,
    auxContract: BALANCER_VAULT,
  },
  {
    type: "stablecoin",
    id: "stablecoin-frax-usdc",
    tokens: ["FRAX", "USDC"],
  },
  {
    type: "uniswapV2",
    id: "univ2-gohm-weth",
    tokens: ["GOHM_SYNAPSE", "WETH"],
    pool: LP_UNISWAP_V2_GOHM_WETH,
  },
  {
    type: "uniswapV2",
    id: "univ2-jones-weth",
    tokens: ["JONES", "WETH"],
    pool: LP_UNISWAP_V2_JONES_WETH,
  },
  {
    type: "uniswapV2",
    id: "univ2-lqty-weth",
    tokens: ["LQTY", "WETH"],
    pool: LP_UNISWAP_V2_LQTY_WETH,
  },
  {
    type: "uniswapV2",
    id: "univ2-magic-weth",
    tokens: ["MAGIC", "WETH"],
    pool: LP_UNISWAP_V2_MAGIC_WETH,
  },
  {
    type: "uniswapV2",
    id: "camelot-ohm-weth",
    tokens: ["OHM", "WETH"],
    pool: LP_CAMELOT_OHM_WETH,
  },
  {
    type: "uniswapV3",
    id: "univ3-usdc-weth",
    tokens: ["USDC", "WETH"],
    pool: LP_UNISWAP_V3_WETH_USDC,
    auxContract: UNISWAP_V3_POSITION_MANAGER,
  },
  {
    type: "uniswapV3",
    id: "univ3-arb-weth",
    tokens: ["ARB", "WETH"],
    pool: LP_UNISWAP_V3_ARB_WETH,
    auxContract: UNISWAP_V3_POSITION_MANAGER,
  },
];

// --- Block Guards ---

const JONES_WRITE_OFF_BLOCK = 130482707n;
const LUSD_START_BLOCK = 80000000n;
const START_BLOCK = 84000000n;

// --- Export ---

export const arbitrumConfig: ChainConfig = {
  chainId: 42161,
  blockchain: "Arbitrum",

  ohmAddress: ERC20_OHM,
  ohmTokens: [ERC20_GOHM_SYNAPSE, ERC20_OHM],

  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: CIRCULATING_SUPPLY_WALLETS,
  treasuryBlacklist: TREASURY_BLACKLIST,

  tokenDefinitions: TOKEN_DEFINITIONS,
  priceHandlers: PRICE_HANDLERS,
  chainlinkFeeds: CHAINLINK_FEEDS,

  lendingMarkets: {
    siloRepository: SILO_REPOSITORY,
    siloAddress: SILO_ADDRESS,
    siloRepositoryBlock: 130482707n,
    siloDeployments: [
      { block: 99067079n, amount: 25000, targetAddress: SILO_ADDRESS },
      { block: 100875469n, amount: 25000, targetAddress: SILO_ADDRESS },
    ],
    sentimentLToken: SENTIMENT_LTOKEN,
    sentimentBlock: 130482707n,
    sentimentDeployments: [
      { block: 100875583n, amount: 5000, targetAddress: SENTIMENT_LTOKEN },
    ],
    olympusLender: OLYMPUS_LENDER,
  },

  stakingPositions: [
    {
      contractAddress: JONES_STAKING,
      poolIds: [0],
      tokenName: "JONES",
    },
    {
      contractAddress: TREASURE_ATLAS_MINE,
      poolIds: [],
      tokenName: "MAGIC",
    },
  ],

  startBlock: START_BLOCK,
  blockGuards: {
    JONES_WRITE_OFF_BLOCK: JONES_WRITE_OFF_BLOCK,
    LUSD_START_BLOCK: LUSD_START_BLOCK,
  },
};
