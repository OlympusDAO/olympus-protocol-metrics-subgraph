import BigNumber from "bignumber.js";
import { createEffect, S } from "envio";
import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  createPublicClient,
  getAddress,
  http,
  type PublicClient,
  parseAbi,
  type ReadContractReturnType,
  zeroAddress,
} from "viem";
import { arbitrum } from "viem/chains";

type SerializedTokenRecord = {
  id: string;
  block: string;
  timestamp: string;
  date: string;
  token: string;
  tokenAddress: string;
  source: string;
  sourceAddress: string;
  rate: string;
  balance: string;
  multiplier: string;
  value: string;
  valueExcludingOhm: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
  blockchain: string;
};

type SerializedTokenSupply = {
  id: string;
  block: string;
  timestamp: string;
  date: string;
  token: string;
  tokenAddress: string;
  pool?: string;
  poolAddress?: string;
  source?: string;
  sourceAddress?: string;
  recordType: string;
  balance: string;
  supplyBalance: string;
};

export type Snapshot = {
  tokenRecords: SerializedTokenRecord[];
  tokenSupplies: SerializedTokenSupply[];
};

type TokenDefinition = {
  address: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
  multiplier?: string;
  isLiability?: boolean;
};

type ChainConfig = {
  chainId: 42161 | 80094;
  blockchain: string;
  rpcUrl: string;
  tokens: TokenDefinition[];
  names: Record<string, string>;
  abbreviations: Record<string, string>;
  protocolAddresses: string[];
  circulatingSupplyWallets: string[];
  treasuryBlacklist: Record<string, string[]>;
  basePriceFeeds: Record<string, string>;
  ohmToken: string;
  nativeToken?: string;
  liquidityHandlers: LiquidityHandler[];
  ownedLiquidityHandlers: LiquidityHandler[];
};

type LiquidityHandler =
  | { kind: "stable"; id: string; tokens: string[] }
  | { kind: "univ2"; id: string; tokens: string[] }
  | { kind: "univ3"; id: string; tokens: string[] }
  | { kind: "balancer"; id: string; vault: string; tokens: string[] }
  | {
      kind: "kodiak";
      id: string;
      pool: string;
      rewardVault?: string;
      tokens: string[];
    };

const ZERO = new BigNumber(0);
const ONE = new BigNumber(1);
const ERC20_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const CHAINLINK_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestAnswer() view returns (int256)",
]);

const UNIV2_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const UNIV3_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const BALANCER_VAULT_ABI = parseAbi([
  "function getPool(bytes32 poolId) view returns (address poolAddress, uint8 specialization)",
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
]);

const BALANCER_POOL_TOKEN_ABI = parseAbi([
  "function getNormalizedWeights() view returns (uint256[])",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const KODIAK_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getUnderlyingBalances() view returns (uint256 amount0Current, uint256 amount1Current)",
]);

const OLYMPUS_LENDER_ABI = parseAbi([
  "function activeAMOCount() view returns (uint256)",
  "function activeAMOs(uint256) view returns (address)",
  "function getDeployedOhm(address) view returns (uint256)",
]);

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

const ARBITRUM_PROTOCOL_ADDRESSES = [
  addr("0x0d33c811d0fcc711bcb388dfb3a152de445be66f"),
  addr("0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4"),
  addr("0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6"),
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  addr("0xf7deb867e65306be0cb33918ac1b8f89a72109db"),
  CROSS_CHAIN_ARBITRUM,
  CROSS_CHAIN_FANTOM,
  CROSS_CHAIN_POLYGON,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  addr("0x012BBf0481b97170577745D2167ee14f63E2aD4C"),
];

const ARBITRUM = (() => {
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
  const LP_BALANCER_POOL_WETH_VESTA =
    "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d";
  const LP_BALANCER_POOL_WETH_OHM =
    "0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423";
  const LP_BALANCER_POOL_OHM_USDC =
    "0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424";
  const LP_UNISWAP_V2_GOHM_WETH = addr("0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d");
  const LP_UNISWAP_V2_JONES_WETH = addr("0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c");
  const LP_UNISWAP_V2_LQTY_WETH = addr("0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf");
  const LP_UNISWAP_V2_MAGIC_WETH = addr("0xb7e50106a5bd3cf21af210a755f9c8740890a8c9");
  const LP_CAMELOT_OHM_WETH = addr("0x8aCd42e4B5A5750B44A28C5fb50906eBfF145359");
  const LP_UNISWAP_V3_ARB_WETH = addr("0xc6f780497a95e246eb9449f5e4770916dcd6396a");
  const LP_UNISWAP_V3_WETH_USDC = addr("0xc31e54c7a869b9fcbecc14363cf510d1c41fa443");

  const names: Record<string, string> = {
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

  return {
    chainId: 42161,
    blockchain: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
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
  } satisfies ChainConfig;
})();

const BERACHAIN = (() => {
  const ERC20_OHM = addr("0x18878Df23e2a36f81e820e4b47b4A40576D3159C");
  const ERC20_IBERA = addr("0x9b6761bf2397Bb5a6624a856cC84A3A14Dcd3fe5");
  const ERC20_IBGT = addr("0xac03CABA51e17c86c921E1f6CBFBdC91F8BB2E6b");
  const ERC20_LBGT = addr("0xBaadCC2962417C01Af99fb2B7C75706B9bd6Babe");
  const ERC20_STARGATE_USDC = addr("0x549943e04f40284185054145c6E4e9568C1D3241");
  const ERC20_HONEY = addr("0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce");
  const ERC20_WBERA = addr("0x6969696969696969696969696969696969696969");
  const NATIVE_BERA = zeroAddress.toLowerCase();
  const BEX_VAULT = addr("0x4Be03f781C497A489E3cB0287833452cA9B9E80B");
  const LP_KODIAK_OHM_HONEY = addr("0x98bDEEde9A45C28d229285d9d6e9139e9F505391");
  const LP_BERADROME_KODIAK_OHM_HONEY = addr("0x555BAd9EC18dB19dED0057D2517242399d1c5D87");
  const LP_UNISWAP_V3_WBERA_HONEY = addr("0x1127f801cb3ab7bdf8923272949aa7dba94b5805");
  const LP_KODIAK_IBERA_WBERA_3000 = addr("0x8dD1C3e5fB96ca0E45Fe3c3CC521Ad44e12F3e47");
  const LP_KODIAK_IBERA_WBERA_500 = addr("0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f");
  const LP_KODIAK_IBGT_WBERA = addr("0x12bf773F18cEC56F14e7cb91d82984eF5A3148EE");
  const LP_BEX_LBGT_WBERA_ID = "0x705fc16ba5a1eb67051934f2fb17eacae660f6c70002000000000000000000d5";
  const BERADROME_V1 = addr("0x017B4DD27782E2FE3421e71F33ce54801aF696F8");
  const BERADROME_V2 = addr("0x8e5b2DF607B43C8D0F28035210D4e1aD1E72b8ed");
  const INFRARED_VAULT = addr("0xa57Cb177Beebc35A1A26A286951a306d9B752524");
  const BERAHUB_VAULT = addr("0x815596fa7c4d983d1ca5304e5b48978424c1b448");

  const protocolAddresses = [
    addr("0x91494D1BC2286343D51c55E46AE80C9356D099b5"),
    addr("0xb1fA0Ac44d399b778B14af0AAF4bCF8af3437ad1"),
    addr("0xe22b2d431838528BcaD52d11C4744EfCdc907a1c"),
    addr("0x082689241b09c600b3eaf3812b1d09791e7ded5a"),
    addr("0xb65e74f6b2c0633e30ba1be75db818bb9522a81a"),
  ];
  const names: Record<string, string> = {
    [ERC20_HONEY]: "Honey",
    [ERC20_IBERA]: "Infrared BERA",
    [ERC20_IBGT]: "Infrared BGT",
    [ERC20_LBGT]: "Liquid BGT",
    [ERC20_OHM]: "OHM",
    [ERC20_STARGATE_USDC]: "Bridged USDC (Stargate)",
    [ERC20_WBERA]: "Wrapped BERA",
    [NATIVE_BERA]: "BERA",
    [LP_KODIAK_OHM_HONEY]: "Kodiak OHM-HONEY LP",
    [LP_BERADROME_KODIAK_OHM_HONEY]: "Beradrome Kodiak OHM-HONEY LP",
    [INFRARED_VAULT]: "Infrared Kodiak OHM-HONEY Reward Vault",
    [BERAHUB_VAULT]: "BeraHub Kodiak OHM-HONEY Reward Vault",
  };
  const kodiak: LiquidityHandler = {
    kind: "kodiak",
    id: LP_KODIAK_OHM_HONEY,
    pool: LP_KODIAK_OHM_HONEY,
    tokens: [ERC20_HONEY, ERC20_OHM],
  };
  const ownedLiquidityHandlers: LiquidityHandler[] = [
    kodiak,
    {
      kind: "kodiak",
      id: LP_BERADROME_KODIAK_OHM_HONEY,
      pool: LP_KODIAK_OHM_HONEY,
      rewardVault: BERADROME_V1,
      tokens: [ERC20_HONEY, ERC20_OHM],
    },
    {
      kind: "kodiak",
      id: LP_BERADROME_KODIAK_OHM_HONEY,
      pool: LP_KODIAK_OHM_HONEY,
      rewardVault: BERADROME_V2,
      tokens: [ERC20_HONEY, ERC20_OHM],
    },
    {
      kind: "kodiak",
      id: INFRARED_VAULT,
      pool: LP_KODIAK_OHM_HONEY,
      rewardVault: INFRARED_VAULT,
      tokens: [ERC20_HONEY, ERC20_OHM],
    },
    {
      kind: "kodiak",
      id: BERAHUB_VAULT,
      pool: LP_KODIAK_OHM_HONEY,
      rewardVault: BERAHUB_VAULT,
      tokens: [ERC20_HONEY, ERC20_OHM],
    },
  ];
  return {
    chainId: 80094,
    blockchain: "Berachain",
    rpcUrl: "https://rpc.berachain.com",
    ohmToken: ERC20_OHM,
    nativeToken: NATIVE_BERA,
    tokens: [
      token(ERC20_IBERA, "Volatile", false, false),
      token(ERC20_IBGT, "Volatile", false, false),
      token(ERC20_LBGT, "Volatile", false, false),
      token(ERC20_STARGATE_USDC, "Stable", true, false),
      token(ERC20_HONEY, "Stable", true, false),
      token(ERC20_WBERA, "Volatile", true, true),
      token(NATIVE_BERA, "Volatile", true, true),
      token(LP_KODIAK_OHM_HONEY, "Protocol-Owned Liquidity", true, false),
      token(LP_BERADROME_KODIAK_OHM_HONEY, "Protocol-Owned Liquidity", true, false),
      token(INFRARED_VAULT, "Protocol-Owned Liquidity", true, false),
      token(BERAHUB_VAULT, "Protocol-Owned Liquidity", true, false),
    ],
    names,
    abbreviations: {
      [ERC20_IBERA]: "iBERA",
      [ERC20_IBGT]: "iBGT",
      [ERC20_LBGT]: "lBGT",
      [ERC20_STARGATE_USDC]: "USDC.e",
      [ERC20_WBERA]: "wBERA",
      [NATIVE_BERA]: "BERA",
    },
    protocolAddresses,
    circulatingSupplyWallets: protocolAddresses,
    treasuryBlacklist: { [ERC20_OHM]: protocolAddresses.slice(0, 3) },
    basePriceFeeds: {
      [ERC20_HONEY]: addr("0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57"),
      [ERC20_STARGATE_USDC]: addr("0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57"),
    },
    liquidityHandlers: [
      { kind: "univ3", tokens: [ERC20_HONEY, ERC20_WBERA], id: LP_UNISWAP_V3_WBERA_HONEY },
      { kind: "univ3", tokens: [ERC20_IBERA, ERC20_WBERA], id: LP_KODIAK_IBERA_WBERA_3000 },
      { kind: "univ3", tokens: [ERC20_IBERA, ERC20_WBERA], id: LP_KODIAK_IBERA_WBERA_500 },
      ...ownedLiquidityHandlers,
      { kind: "univ3", tokens: [ERC20_IBGT, ERC20_WBERA], id: LP_KODIAK_IBGT_WBERA },
      { kind: "stable", tokens: [NATIVE_BERA, ERC20_WBERA], id: "bera-wbera" },
      {
        kind: "balancer",
        tokens: [ERC20_LBGT, ERC20_WBERA],
        vault: BEX_VAULT,
        id: LP_BEX_LBGT_WBERA_ID,
      },
    ],
    ownedLiquidityHandlers,
  } satisfies ChainConfig;
})();

const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  42161: ARBITRUM,
  80094: BERACHAIN,
};

const clients = new Map<number, PublicClient>();

export const getSnapshot = createEffect(
  {
    name: "getSnapshot",
    input: { chainId: S.number, blockNumber: S.number },
    output: S.unknown,
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    return generateSnapshot(config, BigInt(input.blockNumber));
  },
);

async function generateSnapshot(config: ChainConfig, blockNumber: bigint): Promise<Snapshot> {
  const client = getClient(config);
  const block = await client.getBlock({ blockNumber });
  const timestamp = block.timestamp;
  const snapshot: Snapshot = { tokenRecords: [], tokenSupplies: [] };

  for (const category of ["Stable", "Volatile"]) {
    for (const definition of config.tokens.filter((value) => value.category === category)) {
      await pushTokenBalanceRecords(snapshot, config, client, definition, timestamp, blockNumber);
    }
  }

  for (const handler of config.ownedLiquidityHandlers) {
    await pushOwnedLiquidityRecords(snapshot, config, client, handler, timestamp, blockNumber);
  }

  await pushTotalSupply(snapshot, config, client, timestamp, blockNumber);
  await pushTreasuryOhm(snapshot, config, client, timestamp, blockNumber);
  await pushOwnedLiquiditySupply(snapshot, config, client, timestamp, blockNumber);

  if (config.chainId === 42161) {
    await pushArbitrumLendingSupply(snapshot, config, client, timestamp, blockNumber);
  }

  return snapshot;
}

async function pushTokenBalanceRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  definition: TokenDefinition,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const wallets = getWalletAddressesForContract(config, definition.address);
  const rate = await getPrice(config, client, definition.address, blockNumber, null);
  if (rate.eq(ZERO)) return;

  for (const wallet of wallets) {
    const balance =
      definition.address === config.nativeToken
        ? toDecimal(await client.getBalance({ address: wallet as Address, blockNumber }), 18)
        : await getErc20DecimalBalance(client, definition.address, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenRecords.push(
      createTokenRecord(
        config,
        timestamp,
        getContractName(config, definition.address),
        definition.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }
}

async function pushOwnedLiquidityRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const totalValue = await getTotalValue(config, client, handler, [], blockNumber);
  if (!totalValue || totalValue.eq(ZERO)) return;
  const includedValue = await getTotalValue(
    config,
    client,
    handler,
    [config.ohmToken],
    blockNumber,
  );
  if (!includedValue) return;
  const multiplier = includedValue.div(totalValue);
  const unitRate = await getUnitPrice(config, client, handler, blockNumber);
  if (!unitRate) return;

  for (const wallet of config.protocolAddresses) {
    const balance = await getLiquidityBalance(client, handler, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenRecords.push(
      createTokenRecord(
        config,
        timestamp,
        getContractName(config, handler.id),
        handler.id,
        getContractName(config, wallet),
        wallet,
        unitRate,
        balance,
        blockNumber,
        multiplier,
        "Protocol-Owned Liquidity",
      ),
    );
  }
}

async function pushTotalSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const balance = await getErc20TotalSupply(client, config.ohmToken, blockNumber);
  snapshot.tokenSupplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      undefined,
      undefined,
      "Total Supply",
      balance,
      blockNumber,
    ),
  );
}

async function pushTreasuryOhm(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  for (const wallet of config.circulatingSupplyWallets) {
    const balance = await getErc20DecimalBalance(client, config.ohmToken, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenSupplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        getContractName(config, wallet),
        wallet,
        "Treasury",
        balance,
        blockNumber,
        -1,
      ),
    );
  }
}

async function pushOwnedLiquiditySupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  for (const handler of config.ownedLiquidityHandlers) {
    if (!matches(handler, config.ohmToken)) continue;
    for (const wallet of config.circulatingSupplyWallets) {
      const balance = await getUnderlyingTokenBalance(
        config,
        client,
        handler,
        wallet,
        config.ohmToken,
        blockNumber,
      );
      if (balance.eq(ZERO)) continue;
      snapshot.tokenSupplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          getContractName(config, handler.id),
          handler.id,
          getContractName(config, wallet),
          wallet,
          "Liquidity",
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}

async function pushArbitrumLendingSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const OLYMPUS_LENDER = addr("0x868C3ae18Fdea85bBb7a303e379c5B7e23b30F03");
  const SILO_COLLATERAL = addr("0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae");
  const SENTIMENT_LTOKEN = addr("0x37E6a0EcB9e8E5D90104590049a0A197E1363b67");
  await safeRead(
    client,
    OLYMPUS_LENDER,
    OLYMPUS_LENDER_ABI,
    "activeAMOCount",
    [],
    blockNumber,
  ).then(async (count) => {
    if (count === null) return;
    for (let i = 0n; i < count; i++) {
      const amo = await safeRead(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "activeAMOs",
        [i],
        blockNumber,
      );
      if (!amo) continue;
      const deployed = await safeRead(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "getDeployedOhm",
        [amo],
        blockNumber,
      );
      if (!deployed || deployed === 0n) continue;
      snapshot.tokenSupplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          undefined,
          undefined,
          `${getContractName(config, OLYMPUS_LENDER)} - ${addr(amo)}`,
          addr(amo),
          "Lending",
          toDecimal(deployed, 9),
          blockNumber,
          -1,
        ),
      );
    }
  });

  for (const market of [
    { name: "Silo", address: SILO_COLLATERAL },
    { name: "Sentiment lOHM", address: SENTIMENT_LTOKEN },
  ]) {
    for (const wallet of getWalletAddressesForContract(config, market.address)) {
      const balance = await getErc20DecimalBalance(client, market.address, wallet, blockNumber);
      if (balance.eq(ZERO)) continue;
      snapshot.tokenSupplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          market.name,
          market.address,
          getContractName(config, wallet),
          wallet,
          "Lending",
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}

function createTokenRecord(
  config: ChainConfig,
  timestamp: bigint,
  tokenName: string,
  tokenAddress: string,
  sourceName: string,
  sourceAddress: string,
  rate: BigNumber,
  balance: BigNumber,
  blockNumber: bigint,
  nonOhmMultiplier?: BigNumber,
  category?: string,
): SerializedTokenRecord {
  const date = isoDate(timestamp);
  const definition = getTokenDefinition(config, tokenAddress);
  const multiplier = nonOhmMultiplier ?? new BigNumber(definition?.multiplier ?? "1");
  const baseValue = balance.times(rate);
  const isLiability = definition?.isLiability ?? false;
  const value = isLiability ? baseValue.times(-1) : baseValue;
  const valueExcludingOhm = isLiability
    ? baseValue.times(multiplier).times(-1)
    : baseValue.times(multiplier);
  return {
    id: `${config.chainId}-${date}/${blockNumber}/${sourceName}/${tokenName}`,
    block: blockNumber.toString(),
    timestamp: timestamp.toString(),
    date,
    token: tokenName,
    tokenAddress,
    source: sourceName,
    sourceAddress,
    rate: rate.toString(10),
    balance: balance.toString(10),
    multiplier: multiplier.toString(10),
    value: value.toString(10),
    valueExcludingOhm: valueExcludingOhm.toString(10),
    category: category ?? definition?.category ?? "Unknown",
    isLiquid: definition?.isLiquid ?? true,
    isBluechip: definition?.isBluechip ?? false,
    blockchain: config.blockchain,
  };
}

function createTokenSupply(
  config: ChainConfig,
  timestamp: bigint,
  tokenName: string,
  tokenAddress: string,
  poolName: string | undefined,
  poolAddress: string | undefined,
  sourceName: string | undefined,
  sourceAddress: string | undefined,
  recordType: string,
  balance: BigNumber,
  blockNumber: bigint,
  multiplier = 1,
): SerializedTokenSupply {
  const date = isoDate(timestamp);
  return {
    id: `${config.chainId}-${date}/${blockNumber}/${tokenName}/${recordType}/${poolName ?? "Unknown Pool"}/${sourceName ?? ""}`,
    block: blockNumber.toString(),
    timestamp: timestamp.toString(),
    date,
    token: tokenName,
    tokenAddress,
    pool: poolName,
    poolAddress,
    source: sourceName,
    sourceAddress,
    recordType,
    balance: balance.toString(10),
    supplyBalance: balance.times(multiplier).toString(10),
  };
}

async function getPrice(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<BigNumber> {
  const base = await getBaseTokenRate(config, client, tokenAddress, blockNumber);
  if (base) return base;
  for (const handler of config.liquidityHandlers) {
    if (!matches(handler, tokenAddress) || handler.id === currentPool) continue;
    const price = await getHandlerPrice(config, client, handler, tokenAddress, blockNumber);
    if (price) return price;
  }
  return ZERO;
}

async function getHandlerPrice(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  tokenAddress: string,
  blockNumber: bigint,
): Promise<BigNumber | null> {
  if (handler.kind === "stable") return ONE;
  if (handler.kind === "univ2") {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(client, handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(client, handler.id, UNIV2_ABI, "token1", [], blockNumber),
      safeRead(client, handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? addr(token1) : addr(token0);
    const secondaryPrice = await getPrice(config, client, secondaryToken, blockNumber, handler.id);
    if (secondaryPrice.eq(ZERO)) return null;
    const token0Reserve = toDecimal(
      reserves[0],
      await getDecimals(client, addr(token0), blockNumber),
    );
    const token1Reserve = toDecimal(
      reserves[1],
      await getDecimals(client, addr(token1), blockNumber),
    );
    return (
      lookupIsToken0 ? token1Reserve.div(token0Reserve) : token0Reserve.div(token1Reserve)
    ).times(secondaryPrice);
  }
  if (handler.kind === "univ3") {
    const [token0, token1, slot0] = await Promise.all([
      safeRead(client, handler.id, UNIV3_ABI, "token0", [], blockNumber),
      safeRead(client, handler.id, UNIV3_ABI, "token1", [], blockNumber),
      safeRead(client, handler.id, UNIV3_ABI, "slot0", [], blockNumber),
    ]);
    if (!token0 || !token1 || !slot0) return null;
    const lookupIsToken1 = same(tokenAddress, token1);
    const otherToken = lookupIsToken1 ? addr(token0) : addr(token1);
    const otherPrice = await getPrice(config, client, otherToken, blockNumber, handler.id);
    if (otherPrice.eq(ZERO)) return null;
    const priceRaw = new BigNumber(slot0[0].toString()).pow(2).div(new BigNumber(2).pow(192));
    const decimals0 = await getDecimals(client, addr(token0), blockNumber);
    const decimals1 = await getDecimals(client, addr(token1), blockNumber);
    const decimalDifference = lookupIsToken1 ? decimals1 - decimals0 : decimals0 - decimals1;
    const decimalFactor = new BigNumber(10).pow(Math.abs(decimalDifference));
    const adjusted = (decimalDifference < 0 ? ONE.div(decimalFactor) : decimalFactor).times(
      lookupIsToken1 ? ONE.div(priceRaw) : priceRaw,
    );
    return adjusted.times(otherPrice);
  }
  if (handler.kind === "balancer") {
    const pool = await getBalancerPool(config, client, handler, blockNumber);
    if (!pool) return null;
    const poolToken = await getBalancerPoolToken(client, handler, blockNumber);
    if (!poolToken) return null;
    const weights = await safeRead(
      client,
      poolToken,
      BALANCER_POOL_TOKEN_ABI,
      "getNormalizedWeights",
      [],
      blockNumber,
    );
    const decimals = await getDecimals(client, poolToken, blockNumber);
    if (!weights) return null;
    const lookupIndex = pool.tokens.findIndex((value: string) => same(value, tokenAddress));
    if (lookupIndex < 0) return null;
    for (let i = 0; i < pool.tokens.length; i++) {
      if (i === lookupIndex) continue;
      const secondaryPrice = await getPrice(
        config,
        client,
        pool.tokens[i],
        blockNumber,
        handler.id,
      );
      if (secondaryPrice.eq(ZERO)) continue;
      const lookupReserve = toDecimal(
        pool.balances[lookupIndex],
        await getDecimals(client, pool.tokens[lookupIndex], blockNumber),
      );
      const secondaryReserve = toDecimal(
        pool.balances[i],
        await getDecimals(client, pool.tokens[i], blockNumber),
      );
      const lookupWeight = toDecimal(weights[lookupIndex], decimals);
      const secondaryWeight = toDecimal(weights[i], decimals);
      return secondaryReserve
        .div(secondaryWeight)
        .div(lookupReserve.div(lookupWeight))
        .times(secondaryPrice);
    }
  }
  if (handler.kind === "kodiak") {
    const total = await getTotalValue(config, client, handler, [], blockNumber);
    const supply = await getErc20TotalSupply(client, handler.pool, blockNumber);
    if (!total || supply.eq(ZERO)) return null;
    return total.div(supply);
  }
  return null;
}

async function getTotalValue(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  excludedTokens: string[],
  blockNumber: bigint,
): Promise<BigNumber | null> {
  if (handler.kind === "stable") return ONE;
  let tokens: string[] = [];
  let balances: BigNumber[] = [];
  if (handler.kind === "univ2") {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(client, handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(client, handler.id, UNIV2_ABI, "token1", [], blockNumber),
      safeRead(client, handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    tokens = [addr(token0), addr(token1)];
    balances = [
      toDecimal(reserves[0], await getDecimals(client, addr(token0), blockNumber)),
      toDecimal(reserves[1], await getDecimals(client, addr(token1), blockNumber)),
    ];
  } else if (handler.kind === "univ3") {
    const [token0, token1] = await Promise.all([
      safeRead(client, handler.id, UNIV3_ABI, "token0", [], blockNumber),
      safeRead(client, handler.id, UNIV3_ABI, "token1", [], blockNumber),
    ]);
    if (!token0 || !token1) return null;
    tokens = [addr(token0), addr(token1)];
    balances = [
      await getErc20DecimalBalance(client, addr(token0), handler.id, blockNumber),
      await getErc20DecimalBalance(client, addr(token1), handler.id, blockNumber),
    ];
  } else if (handler.kind === "balancer") {
    const pool = await getBalancerPool(config, client, handler, blockNumber);
    if (!pool) return null;
    tokens = pool.tokens;
    balances = await Promise.all(
      pool.tokens.map(async (tokenAddress: string, index: number) =>
        toDecimal(pool.balances[index], await getDecimals(client, tokenAddress, blockNumber)),
      ),
    );
  } else if (handler.kind === "kodiak") {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(client, handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      safeRead(client, handler.pool, KODIAK_ABI, "token1", [], blockNumber),
      safeRead(client, handler.pool, KODIAK_ABI, "getUnderlyingBalances", [], blockNumber),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    tokens = [addr(token0), addr(token1)];
    balances = [
      toDecimal(reserves[0], await getDecimals(client, addr(token0), blockNumber)),
      toDecimal(reserves[1], await getDecimals(client, addr(token1), blockNumber)),
    ];
  }
  let total = ZERO;
  for (let i = 0; i < tokens.length; i++) {
    if (excludedTokens.some((excluded) => same(excluded, tokens[i]))) continue;
    const price = await getPrice(config, client, tokens[i], blockNumber, null);
    total = total.plus(balances[i].times(price));
  }
  return total;
}

async function getUnitPrice(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  blockNumber: bigint,
) {
  if (handler.kind === "univ3") return getTotalValue(config, client, handler, [], blockNumber);
  const totalValue = await getTotalValue(config, client, handler, [], blockNumber);
  if (!totalValue) return null;
  const supply =
    handler.kind === "balancer"
      ? await getErc20TotalSupply(
          client,
          (await getBalancerPoolToken(client, handler, blockNumber)) ?? handler.id,
          blockNumber,
        )
      : await getErc20TotalSupply(
          client,
          handler.kind === "kodiak" ? handler.pool : handler.id,
          blockNumber,
        );
  if (supply.eq(ZERO)) return null;
  return totalValue.div(supply);
}

async function getLiquidityBalance(
  client: PublicClient,
  handler: LiquidityHandler,
  wallet: string,
  blockNumber: bigint,
) {
  if (handler.kind === "univ3") return ZERO;
  if (handler.kind === "balancer") {
    const poolToken = await getBalancerPoolToken(client, handler, blockNumber);
    return poolToken ? getErc20DecimalBalance(client, poolToken, wallet, blockNumber) : ZERO;
  }
  if (handler.kind === "kodiak") {
    return getErc20DecimalBalance(client, handler.rewardVault ?? handler.pool, wallet, blockNumber);
  }
  return getErc20DecimalBalance(client, handler.id, wallet, blockNumber);
}

async function getUnderlyingTokenBalance(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  wallet: string,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const totalSupply =
    handler.kind === "balancer"
      ? await getErc20TotalSupply(
          client,
          (await getBalancerPoolToken(client, handler, blockNumber)) ?? handler.id,
          blockNumber,
        )
      : await getErc20TotalSupply(
          client,
          handler.kind === "kodiak" ? handler.pool : handler.id,
          blockNumber,
        );
  if (totalSupply.eq(ZERO)) return ZERO;
  const walletBalance = await getLiquidityBalance(client, handler, wallet, blockNumber);
  if (walletBalance.eq(ZERO)) return ZERO;
  let reserve = ZERO;
  if (handler.kind === "balancer") {
    const pool = await getBalancerPool(config, client, handler, blockNumber);
    if (!pool) return ZERO;
    const index = pool.tokens.findIndex((token: string) => same(token, tokenAddress));
    if (index < 0) return ZERO;
    reserve = toDecimal(pool.balances[index], await getDecimals(client, tokenAddress, blockNumber));
  } else if (handler.kind === "kodiak") {
    const [token0, reserves] = await Promise.all([
      safeRead(client, handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      safeRead(client, handler.pool, KODIAK_ABI, "getUnderlyingBalances", [], blockNumber),
    ]);
    if (!token0 || !reserves) return ZERO;
    reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], await getDecimals(client, tokenAddress, blockNumber))
      : toDecimal(reserves[1], await getDecimals(client, tokenAddress, blockNumber));
  } else if (handler.kind === "univ2") {
    const [token0, reserves] = await Promise.all([
      safeRead(client, handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(client, handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !reserves) return ZERO;
    reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], await getDecimals(client, tokenAddress, blockNumber))
      : toDecimal(reserves[1], await getDecimals(client, tokenAddress, blockNumber));
  }
  return reserve.times(walletBalance).div(totalSupply);
}

async function getBalancerPool(
  _config: ChainConfig,
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  const result = await safeRead(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPoolTokens",
    [handler.id as `0x${string}`],
    blockNumber,
  );
  if (!result) return null;
  return { tokens: result[0].map((value: string) => addr(value)), balances: result[1] as bigint[] };
}

async function getBalancerPoolToken(
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  const result = await safeRead(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPool",
    [handler.id as `0x${string}`],
    blockNumber,
  );
  return result ? addr(result[0]) : null;
}

async function getBaseTokenRate(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const feed = config.basePriceFeeds[addr(tokenAddress)];
  if (!feed) return null;
  const [decimals, answer] = await Promise.all([
    safeRead(client, feed, CHAINLINK_ABI, "decimals", [], blockNumber),
    safeRead(client, feed, CHAINLINK_ABI, "latestAnswer", [], blockNumber),
  ]);
  if (decimals === null || answer === null || answer <= 0n) return null;
  return toDecimal(answer, Number(decimals));
}

async function getErc20DecimalBalance(
  client: PublicClient,
  tokenAddress: string,
  wallet: string,
  blockNumber: bigint,
) {
  const [decimals, balance] = await Promise.all([
    getDecimals(client, tokenAddress, blockNumber),
    safeRead(client, tokenAddress, ERC20_ABI, "balanceOf", [wallet as Address], blockNumber),
  ]);
  return balance ? toDecimal(balance, decimals) : ZERO;
}

async function getErc20TotalSupply(
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const [decimals, totalSupply] = await Promise.all([
    getDecimals(client, tokenAddress, blockNumber),
    safeRead(client, tokenAddress, ERC20_ABI, "totalSupply", [], blockNumber),
  ]);
  return totalSupply ? toDecimal(totalSupply, decimals) : ZERO;
}

async function getDecimals(client: PublicClient, tokenAddress: string, blockNumber: bigint) {
  const value = await safeRead(client, tokenAddress, ERC20_ABI, "decimals", [], blockNumber);
  return value === null ? 18 : Number(value);
}

async function safeRead<
  const TAbi extends Abi,
  const TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
  const TArgs extends ContractFunctionArgs<TAbi, "pure" | "view", TFunctionName>,
>(
  client: PublicClient,
  address: string,
  abi: TAbi,
  functionName: TFunctionName,
  args: TArgs,
  blockNumber: bigint,
): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs> | null> {
  try {
    return await client.readContract({
      address: getAddress(address),
      abi,
      functionName,
      args,
      blockNumber,
    });
  } catch {
    return null;
  }
}

function getWalletAddressesForContract(config: ChainConfig, contractAddress: string) {
  const blacklist = config.treasuryBlacklist[addr(contractAddress)] ?? [];
  return config.protocolAddresses.filter(
    (address) => !blacklist.some((blocked) => same(blocked, address)),
  );
}

function getTokenDefinition(config: ChainConfig, tokenAddress: string) {
  return config.tokens.find((value) => same(value.address, tokenAddress));
}

function getContractName(config: ChainConfig, contractAddress: string) {
  const lower = addr(contractAddress);
  const name = config.names[lower] ?? lower;
  const abbreviation = config.abbreviations[lower] ? ` (${config.abbreviations[lower]})` : "";
  return `${name}${abbreviation}`;
}

function getClient(config: ChainConfig) {
  const existing = clients.get(config.chainId);
  if (existing) return existing;
  const client = createPublicClient({
    chain:
      config.chainId === 42161
        ? arbitrum
        : {
            id: 80094,
            name: "Berachain",
            nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
            rpcUrls: { default: { http: [config.rpcUrl] } },
          },
    transport: http(config.rpcUrl),
  });
  clients.set(config.chainId, client);
  return client;
}

function token(
  address: string,
  category: string,
  isLiquid: boolean,
  isBluechip: boolean,
  multiplier?: string,
): TokenDefinition {
  return { address: addr(address), category, isLiquid, isBluechip, multiplier };
}

function toDecimal(value: bigint, decimals: number) {
  return new BigNumber(value.toString()).div(new BigNumber(10).pow(decimals));
}

function isoDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
}

function addr(value: string) {
  return value.toLowerCase();
}

function same(left: string, right: string) {
  return addr(left) === addr(right);
}

function matches(handler: LiquidityHandler, tokenAddress: string) {
  return handler.tokens.some((value) => same(value, tokenAddress));
}
