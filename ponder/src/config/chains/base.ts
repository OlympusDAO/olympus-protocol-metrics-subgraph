import type { Address } from "viem";
import type { ChainConfig, TokenDefinition, PriceHandlerConfig, ChainlinkFeed } from "../types";

// --- Token Addresses ---

const ERC20_OHM = "0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0" as Address;
const ERC20_WETH = "0x4200000000000000000000000000000000000006" as Address;
const ERC20_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address;

// --- LP Addresses ---

const LP_UNISWAP_V2_OHM_WETH = "0x5ab4b9e96aeed4820e4be267f42411d722985482" as Address;
const LP_UNISWAP_V3_OHM_USDC = "0x183ea22691c54806fe96555436dd312b6befac2f" as Address;

// --- Infrastructure ---

const UNISWAP_V3_POSITION_MANAGER = "0x03a520b32c04bf3beef7beb72e919cf822ed34f1" as Address;
const DAO_MULTISIG = "0x18a390bd45bcc92652b9a91ad51aed7f1c1358f5" as Address;

// --- Composed Address Lists ---

const PROTOCOL_ADDRESSES: Address[] = [DAO_MULTISIG];

const CIRCULATING_SUPPLY_WALLETS: Address[] = [DAO_MULTISIG];

// --- Treasury Blacklist ---

const TREASURY_BLACKLIST = new Map<Address, Address[]>([
  [ERC20_OHM, [DAO_MULTISIG]],
]);

// --- Token Definitions ---

const TOKEN_DEFINITIONS: TokenDefinition[] = [
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
    address: LP_UNISWAP_V2_OHM_WETH,
    name: "UniswapV2 OHM-WETH",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_UNISWAP_V3_OHM_USDC,
    name: "UniswapV3 OHM-USDC",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
];

// --- Chainlink Feeds ---

const CHAINLINK_FEEDS: ChainlinkFeed[] = [
  { token: "WETH", feedAddress: "0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70" as Address },
  { token: "USDC", feedAddress: "0x7e860098f58bbfc8648a4311b374b1d669a2bc6b" as Address },
];

// --- Price Handlers ---

const PRICE_HANDLERS: PriceHandlerConfig[] = [
  {
    type: "uniswapV2",
    id: "univ2-ohm-weth",
    tokens: ["OHM", "WETH"],
    pool: LP_UNISWAP_V2_OHM_WETH,
  },
  {
    type: "uniswapV3",
    id: "univ3-ohm-usdc",
    tokens: ["OHM", "USDC"],
    pool: LP_UNISWAP_V3_OHM_USDC,
    auxContract: UNISWAP_V3_POSITION_MANAGER,
  },
];

// --- Block Guards ---

const START_BLOCK = 0n;

// --- Export ---

export const baseConfig: ChainConfig = {
  chainId: 8453,
  blockchain: "Base",

  ohmAddress: ERC20_OHM,
  ohmTokens: [ERC20_OHM],

  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: CIRCULATING_SUPPLY_WALLETS,
  treasuryBlacklist: TREASURY_BLACKLIST,

  tokenDefinitions: TOKEN_DEFINITIONS,
  priceHandlers: PRICE_HANDLERS,
  chainlinkFeeds: CHAINLINK_FEEDS,

  startBlock: START_BLOCK,
};
