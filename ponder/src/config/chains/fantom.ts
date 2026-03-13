import type { Address } from "viem";
import type { ChainConfig, TokenDefinition, PriceHandlerConfig, ChainlinkFeed } from "../types";

// --- Token Addresses ---

const ERC20_BEETS = "0xf24bcf4d1e507740041c9cfd2dddb29585adce1e" as Address;
const ERC20_BOO = "0x841fad6eae12c286d1fd18d1d525dffa75c7effe" as Address;
const ERC20_DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e" as Address;
const ERC20_DEI = "0xde1e704dae0b4051e80dabb26ab6ad6c12262da0" as Address;
const ERC20_FRAX = "0xdc301622e621166bd8e82f2ca0a26c13ad0be355" as Address;
const ERC20_GOHM = "0x91fa20244fb509e8289ca630e5db3e9166233fdc" as Address;
const ERC20_LQDR = "0x10b620b2dbac4faa7d7ffd71da486f5d44cd86f9" as Address;
const ERC20_OXD = "0xc5a9848b9d145965d821aaec8fa32aaee026492d" as Address;
const ERC20_USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75" as Address;
const ERC20_WETH = "0x74b23882a30290451a17c44f4f05243b6b58c76d" as Address;
const ERC20_WFTM = "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83" as Address;

// --- LP Addresses ---

const LP_UNISWAP_V2_BOO_WFTM = "0xec7178f4c41f346b2721907f5cf7628e388a7a58" as Address;
const LP_UNISWAP_V2_LQDR_WFTM = "0x4fe6f19031239f105f753d1df8a0d24857d0caa2" as Address;
const LP_UNISWAP_V2_WFTM_BEETS = "0x648a7452da25b4fb4bdb79badf374a8f8a5ea2b5" as Address;
const LP_UNISWAP_V2_WFTM_ETH = "0xf0702249f4d3a25cd3ded7859a165693685ab577" as Address;
const LP_UNISWAP_V2_WFTM_GOHM = "0xae9bba22e87866e48ccacff0689afaa41eb94995" as Address;
const LP_UNISWAP_V2_WFTM_OXD = "0xcb6eab779780c7fd6d014ab90d8b10e97a1227e2" as Address;
const LP_UNISWAP_V2_WFTM_USDC = "0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c" as Address;

// --- Infrastructure ---

const CROSS_CHAIN_FANTOM = "0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10" as Address;
const DAO_WALLET = "0x245cc372c84b3645bf0ffe6538620b04a217988b" as Address;

// --- Composed Address Lists ---

const PROTOCOL_ADDRESSES: Address[] = [CROSS_CHAIN_FANTOM, DAO_WALLET];

const CIRCULATING_SUPPLY_WALLETS: Address[] = [CROSS_CHAIN_FANTOM, DAO_WALLET];

// --- Treasury Blacklist ---

const TREASURY_BLACKLIST = new Map<Address, Address[]>();

// --- Token Definitions ---

const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    address: ERC20_BEETS,
    name: "BEETS",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_BOO,
    name: "BOO",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_DAI,
    name: "DAI",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_DEI,
    name: "DEI",
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
    address: ERC20_LQDR,
    name: "LQDR",
    category: "Volatile",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_OXD,
    name: "OXD",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
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
    address: ERC20_WFTM,
    name: "WFTM",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V2_WFTM_GOHM,
    name: "SpookySwap WFTM-gOHM",
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
    type: "stablecoin",
    id: "stablecoin-dai-dei-frax-usdc",
    tokens: ["DAI", "DEI", "FRAX", "USDC"],
  },
  {
    type: "uniswapV2",
    id: "univ2-boo-wftm",
    tokens: ["BOO", "WFTM"],
    pool: LP_UNISWAP_V2_BOO_WFTM,
  },
  {
    type: "uniswapV2",
    id: "univ2-gohm-wftm",
    tokens: ["GOHM", "WFTM"],
    pool: LP_UNISWAP_V2_WFTM_GOHM,
  },
  {
    type: "uniswapV2",
    id: "univ2-lqdr-wftm",
    tokens: ["LQDR", "WFTM"],
    pool: LP_UNISWAP_V2_LQDR_WFTM,
  },
  {
    type: "uniswapV2",
    id: "univ2-usdc-wftm",
    tokens: ["USDC", "WFTM"],
    pool: LP_UNISWAP_V2_WFTM_USDC,
  },
  {
    type: "uniswapV2",
    id: "univ2-wftm-beets",
    tokens: ["WFTM", "BEETS"],
    pool: LP_UNISWAP_V2_WFTM_BEETS,
  },
  {
    type: "uniswapV2",
    id: "univ2-wftm-oxd",
    tokens: ["WFTM", "OXD"],
    pool: LP_UNISWAP_V2_WFTM_OXD,
  },
  {
    type: "uniswapV2",
    id: "univ2-wftm-weth",
    tokens: ["WFTM", "WETH"],
    pool: LP_UNISWAP_V2_WFTM_ETH,
  },
];

// --- Block Guards ---

const START_BLOCK = 0n;

// --- Export ---

export const fantomConfig: ChainConfig = {
  chainId: 250,
  blockchain: "Fantom",

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
