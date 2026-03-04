import type { Address } from "viem";
import type { ChainConfig, TokenDefinition, PriceHandlerConfig, ChainlinkFeed } from "../types";

// --- Token Addresses ---

const ERC20_BGT = "0x656b95e550c07a9ffe548bd4085c72418ceb1dba" as Address;
const ERC20_OHM = "0x18878df23e2a36f81e820e4b47b4a40576d3159c" as Address;
const ERC20_IBERA = "0x9b6761bf2397bb5a6624a856cc84a3a14dcd3fe5" as Address;
const ERC20_IBGT = "0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b" as Address;
const ERC20_LBGT = "0xbaadcc2962417c01af99fb2b7c75706b9bd6babe" as Address;
const ERC20_STARGATE_USDC = "0x549943e04f40284185054145c6e4e9568c1d3241" as Address;
const ERC20_HONEY = "0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce" as Address;
const ERC20_WBERA = "0x6969696969696969696969696969696969696969" as Address;
const NATIVE_BERA = "0x0000000000000000000000000000000000000000" as Address;

// --- LP Addresses ---

const LP_UNISWAP_V3_WBERA_HONEY = "0x1127f801cb3ab7bdf8923272949aa7dba94b5805" as Address;
const LP_KODIAK_OHM_HONEY = "0x98bdeede9a45c28d229285d9d6e9139e9f505391" as Address;
const LP_BERADROME_KODIAK_OHM_HONEY = "0x555bad9ec18db19ded0057d2517242399d1c5d87" as Address;
const LP_KODIAK_IBERA_WBERA_3000 = "0x8dd1c3e5fb96ca0e45fe3c3cc521ad44e12f3e47" as Address;
const LP_KODIAK_IBERA_WBERA_500 = "0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f" as Address;
const LP_KODIAK_IBGT_WBERA = "0x12bf773f18cec56f14e7cb91d82984ef5a3148ee" as Address;
const LP_BEX_LBGT_WBERA = "0x705fc16ba5a1eb67051934f2fb17eacae660f6c7" as Address;
const LP_BEX_LBGT_WBERA_ID = "0x705fc16ba5a1eb67051934f2fb17eacae660f6c70002000000000000000000d5";

// --- Infrastructure ---

const BEX_VAULT = "0x4be03f781c497a489e3cb0287833452ca9b9e80b" as Address;
const TRSRY = "0xb1fa0ac44d399b778b14af0aaf4bcf8af3437ad1" as Address;
const DAO_MULTISIG = "0x91494d1bc2286343d51c55e46ae80c9356d099b5" as Address;
const DAO_OPS_MULTISIG = "0xe22b2d431838528bcad52d11c4744efcdc907a1c" as Address;
const THJ_CUSTODIAN = "0x082689241b09c600b3eaf3812b1d09791e7ded5a" as Address;
const INFRARED_CUSTODIAN = "0xb65e74f6b2c0633e30ba1be75db818bb9522a81a" as Address;
const KODIAK_QUOTER = "0x644c8d6e501f7c994b74f5cea96abe65d0ba662b" as Address;
const UNISWAP_V3_POSITION_MANAGER = "0xfe5e8c83ffe4d9627a75eaa7fee864768db989bd" as Address;
const BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1 = "0x017b4dd27782e2fe3421e71f33ce54801af696f8" as Address;
const BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2 = "0x8e5b2df607b43c8d0f28035210d4e1ad1e72b8ed" as Address;
const INFRARED_KODIAK_OHM_HONEY_VAULT = "0xa57cb177beebc35a1a26a286951a306d9b752524" as Address;
const BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT = "0x815596fa7c4d983d1ca5304e5b48978424c1b448" as Address;

// --- Composed Address Lists ---

const PROTOCOL_ADDRESSES: Address[] = [
  DAO_MULTISIG,
  TRSRY,
  DAO_OPS_MULTISIG,
  THJ_CUSTODIAN,
  INFRARED_CUSTODIAN,
];

const CIRCULATING_SUPPLY_WALLETS: Address[] = [
  DAO_MULTISIG,
  DAO_OPS_MULTISIG,
  TRSRY,
];

// --- Treasury Blacklist ---

const TREASURY_BLACKLIST = new Map<Address, Address[]>([
  [ERC20_OHM, [DAO_MULTISIG, DAO_OPS_MULTISIG, TRSRY]],
]);

// --- Token Definitions ---

const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    address: ERC20_IBERA,
    name: "IBERA",
    category: "Volatile",
    isLiquid: false,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_IBGT,
    name: "IBGT",
    category: "Volatile",
    isLiquid: false,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_LBGT,
    name: "LBGT",
    category: "Volatile",
    isLiquid: false,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_STARGATE_USDC,
    name: "STARGATE_USDC",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_HONEY,
    name: "HONEY",
    category: "Stable",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: ERC20_WBERA,
    name: "WBERA",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: NATIVE_BERA,
    name: "NATIVE_BERA",
    category: "Volatile",
    isLiquid: true,
    isBluechip: true,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_KODIAK_OHM_HONEY,
    name: "Kodiak OHM-HONEY",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: LP_BERADROME_KODIAK_OHM_HONEY,
    name: "Beradrome Kodiak OHM-HONEY",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: INFRARED_KODIAK_OHM_HONEY_VAULT,
    name: "Infrared Kodiak OHM-HONEY Vault",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
  {
    address: BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT,
    name: "BeraHub Kodiak OHM-HONEY Reward Vault",
    category: "ProtocolOwnedLiquidity",
    isLiquid: true,
    isBluechip: false,
    liquidBackingMultiplier: 1.0,
  },
];

// --- Chainlink/Redstone Feeds ---

const CHAINLINK_FEEDS: ChainlinkFeed[] = [
  { token: "HONEY", feedAddress: "0x4bad96dd1c7d541270a0c92e1d4e5f12eeea7a57" as Address },
  { token: "STARGATE_USDC", feedAddress: "0x4bad96dd1c7d541270a0c92e1d4e5f12eeea7a57" as Address },
];

// --- Price Handlers ---

const PRICE_HANDLERS: PriceHandlerConfig[] = [
  {
    type: "uniswapV3Quoter",
    id: "kodiak-quoter-honey-wbera",
    tokens: ["HONEY", "WBERA"],
    pool: LP_UNISWAP_V3_WBERA_HONEY,
    auxContract: KODIAK_QUOTER,
  },
  {
    type: "uniswapV3Quoter",
    id: "kodiak-quoter-ibera-wbera-3000",
    tokens: ["IBERA", "WBERA"],
    pool: LP_KODIAK_IBERA_WBERA_3000,
    auxContract: KODIAK_QUOTER,
  },
  {
    type: "uniswapV3Quoter",
    id: "kodiak-quoter-ibera-wbera-500",
    tokens: ["IBERA", "WBERA"],
    pool: LP_KODIAK_IBERA_WBERA_500,
    auxContract: KODIAK_QUOTER,
  },
  {
    type: "kodiakIsland",
    id: "kodiak-island-ohm-honey",
    tokens: ["HONEY", "OHM"],
    pool: LP_KODIAK_OHM_HONEY,
    auxContract: KODIAK_QUOTER,
  },
  {
    type: "kodiakIsland",
    id: "kodiak-island-ohm-honey-beradrome-v1",
    tokens: ["HONEY", "OHM"],
    pool: LP_KODIAK_OHM_HONEY,
    auxContract: KODIAK_QUOTER,
    stakedWrapper: BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1,
  },
  {
    type: "kodiakIsland",
    id: "kodiak-island-ohm-honey-beradrome-v2",
    tokens: ["HONEY", "OHM"],
    pool: LP_KODIAK_OHM_HONEY,
    auxContract: KODIAK_QUOTER,
    stakedWrapper: BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2,
  },
  {
    type: "kodiakIsland",
    id: "kodiak-island-ohm-honey-berahub",
    tokens: ["HONEY", "OHM"],
    pool: LP_KODIAK_OHM_HONEY,
    auxContract: KODIAK_QUOTER,
    stakedWrapper: BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT,
  },
  {
    type: "uniswapV3Quoter",
    id: "kodiak-quoter-ibgt-wbera",
    tokens: ["IBGT", "WBERA"],
    pool: LP_KODIAK_IBGT_WBERA,
    auxContract: KODIAK_QUOTER,
  },
  {
    type: "remapping",
    id: "remapping-native-bera-wbera",
    tokens: ["NATIVE_BERA", "WBERA"],
    remapTarget: ERC20_WBERA,
  },
  {
    type: "balancer",
    id: "bex-lbgt-wbera",
    tokens: ["LBGT", "WBERA"],
    pool: LP_BEX_LBGT_WBERA_ID,
    auxContract: BEX_VAULT,
  },
];

// --- Block Guards ---

const START_BLOCK = 0n;

// --- Export ---

export const berachainConfig: ChainConfig = {
  chainId: 80094,
  blockchain: "Berachain",

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
