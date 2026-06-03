import { addr, bytes32, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { rpcUrls } from "./rpc";

const CROSS_CHAIN_ARBITRUM = addr("0x012BBf0481b97170577745D2167ee14f63E2aD4C");
export const OLYMPUS_LENDER = addr("0x868C3ae18Fdea85bBb7a303e379c5B7e23b30F03");
export const SILO_COLLATERAL = addr("0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae");
export const SENTIMENT_LTOKEN = addr("0x37E6a0EcB9e8E5D90104590049a0A197E1363b67");
export const JONES_STAKING = addr("0xb94d1959084081c5a11C460012Ab522F5a0FD756");
export const TREASURE_ATLAS_MINE = addr("0xa0a89db1c899c49f98e6326b764bafcf167fc2ce");

const ERC20_ARB = addr("0x912ce59144191c1204e64559fe8253a0e49e6548");
const ERC20_FRAX = addr("0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F");
const ERC20_OHM = addr("0xf0cb2dc0db5e6c66B9a70Ac27B06b878da017028");
const ERC20_GOHM_SYNAPSE = addr("0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1");
export const ERC20_JONES = addr("0x10393c20975cf177a3513071bc110f7962cd67da");
const ERC20_LQTY = addr("0xfb9E5D956D889D91a82737B9bFCDaC1DCE3e1449");
const ERC20_LUSD = addr("0x93b346b6bc2548da6a1e7d98e9a421b42541425b");
export const ERC20_MAGIC = addr("0x539bde0d7dbd336b79148aa742883198bbf60342");
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
const CHAINLINK_FEED_ETH_USD = addr("0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612");
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
export const ARBITRUM_START_BLOCK = 10_950_000;
const ARB_CREATION_BLOCK = 70_398_215;
const FRAX_CREATION_BLOCK = 1_693_791;
const OHM_CREATION_BLOCK = 85_886_493;
const JONES_CREATION_BLOCK = 4_936_079;
const LQTY_CREATION_BLOCK = 68_940_603;
const LUSD_CREATION_BLOCK = 20_063_879;
const MAGIC_CREATION_BLOCK = 2_028_077;
const USDC_CREATION_BLOCK = 2_609;
const VSTA_CREATION_BLOCK = 5_160_918;
const WETH_CREATION_BLOCK = 55;
const LP_BALANCER_WETH_VSTA_CREATION_BLOCK = 5_671_673;
const LP_BALANCER_WETH_OHM_CREATION_BLOCK = 87_570_545;
const LP_BALANCER_OHM_USDC_CREATION_BLOCK = 87_572_753;
const LP_UNISWAP_V2_JONES_WETH_CREATION_BLOCK = 5_236_927;
const LP_UNISWAP_V2_LQTY_WETH_CREATION_BLOCK = 70_190_173;
const LP_UNISWAP_V2_MAGIC_WETH_CREATION_BLOCK = 2_260_276;
const LP_CAMELOT_OHM_WETH_CREATION_BLOCK = 209_392_712;
const LP_UNISWAP_V3_ARB_WETH_CREATION_BLOCK = 73_240_629;
export const JONES_STAKING_CREATION_BLOCK = 11_264_445;

export const ARBITRUM_PROTOCOL_ADDRESSES = [CROSS_CHAIN_ARBITRUM];

const names: Record<string, string> = {
  [CROSS_CHAIN_ARBITRUM]: "Cross-Chain Arbitrum",
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
  [SENTIMENT_LTOKEN]: "Sentiment Finance",
  [SILO_COLLATERAL]: "Silo OHM Collateral",
  [TREASURE_ATLAS_MINE]: "TreasureDAO Atlas Mine",
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
    startBlock: LP_BALANCER_WETH_VSTA_CREATION_BLOCK,
  },
  {
    kind: "balancer",
    tokens: [ERC20_WETH, ERC20_OHM],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_WETH_OHM,
    startBlock: LP_BALANCER_WETH_OHM_CREATION_BLOCK,
  },
  {
    kind: "balancer",
    tokens: [ERC20_OHM, ERC20_USDC],
    vault: BALANCER_VAULT,
    id: LP_BALANCER_POOL_OHM_USDC,
    startBlock: LP_BALANCER_OHM_USDC_CREATION_BLOCK,
  },
  { kind: "stable", tokens: [ERC20_FRAX, ERC20_USDC, ERC20_LUSD], id: "stable-usd" },
  // Chainlink ETH/USD — authoritative WETH price. Wins over the WETH-USDC
  // UniV3 pool via CHAINLINK_PRIORITY when the feed has a ChainlinkPriceState
  // row (populated by AnswerUpdated events).
  {
    kind: "chainlink",
    tokens: [ERC20_WETH],
    id: CHAINLINK_FEED_ETH_USD,
    decimals: 8,
    startBlock: ARBITRUM_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_GOHM_SYNAPSE, ERC20_WETH],
    id: LP_UNISWAP_V2_GOHM_WETH,
    startBlock: ARBITRUM_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_JONES, ERC20_WETH],
    id: LP_UNISWAP_V2_JONES_WETH,
    startBlock: LP_UNISWAP_V2_JONES_WETH_CREATION_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_LQTY, ERC20_WETH],
    id: LP_UNISWAP_V2_LQTY_WETH,
    startBlock: LP_UNISWAP_V2_LQTY_WETH_CREATION_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_MAGIC, ERC20_WETH],
    id: LP_UNISWAP_V2_MAGIC_WETH,
    startBlock: LP_UNISWAP_V2_MAGIC_WETH_CREATION_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_OHM, ERC20_WETH],
    id: LP_CAMELOT_OHM_WETH,
    startBlock: LP_CAMELOT_OHM_WETH_CREATION_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_USDC, ERC20_WETH],
    id: LP_UNISWAP_V3_WETH_USDC,
    startBlock: ARBITRUM_START_BLOCK,
  },
  {
    kind: "univ3",
    tokens: [ERC20_ARB, ERC20_WETH],
    id: LP_UNISWAP_V3_ARB_WETH,
    startBlock: LP_UNISWAP_V3_ARB_WETH_CREATION_BLOCK,
  },
  // Native ETH prices via WETH (1:1). NativeBalanceState is populated at
  // snapshot time via getBalance.
  { kind: "remap", tokens: [NATIVE_ETH], id: NATIVE_ETH, target: ERC20_WETH },
];

export const ARBITRUM: ChainConfig = {
  chainId: 42161,
  blockchain: "Arbitrum",
  startBlock: ARBITRUM_START_BLOCK,
  rpcUrls: rpcUrls("ARBITRUM", "https://arbitrum.rpc.subquery.network/public", [
    "https://arbitrum-one.public.blastapi.io",
  ]),
  ohmToken: ERC20_OHM,
  ohmStartBlock: OHM_CREATION_BLOCK,
  nativeToken: NATIVE_ETH,
  tokens: [
    token({
      address: NATIVE_ETH,
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
      startBlock: ARBITRUM_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_ARB,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      startBlock: ARB_CREATION_BLOCK,
      decimals: 18,
    }),
    // Multichain-bridged FRAX. Wallet held 18,072 FRAX before chain start
    // (block 10,950,000) which the original event-driven ledger never saw,
    // causing phantom-negative drift. BackfillTokenBalances seeds that
    // pre-existing balance from balanceOf, so plain Transfer-driven
    // accounting now matches on-chain (validated: residual = 0).
    token({
      address: ERC20_FRAX,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: FRAX_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_JONES,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      multiplier: "0.83",
      startBlock: JONES_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_LQTY,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      startBlock: LQTY_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_LUSD,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: LUSD_CREATION_BLOCK,
      decimals: 18,
    }),
    // MAGIC on Arbitrum: Cross-Chain Arbitrum held 22,090 MAGIC at chain
    // start (verified on-chain) — pure Class A. Earlier comment cited
    // "non-standard bridge mint" but the actual mechanism is standard
    // Transfer (verified by validating backfill + envio == on-chain).
    // BackfillTokenBalances seeds the pre-existing balance.
    token({
      address: ERC20_MAGIC,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      startBlock: MAGIC_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_USDC,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: USDC_CREATION_BLOCK,
      decimals: 6,
    }),
    token({
      address: ERC20_VSTA,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      multiplier: "0.77",
      startBlock: VSTA_CREATION_BLOCK,
      decimals: 18,
    }),
    // Arbitrum WETH9 fork — wrap/unwrap via Deposit/Withdrawal events.
    // Tracked by the Wrapped9 handlers in Erc20Transfers.ts.
    token({
      address: ERC20_WETH,
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
      startBlock: WETH_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_OHM,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      // multiplier=0: OHM/gOHM are protocol liabilities, not treasury assets.
      // Their own value is excluded here while their pool backing is still
      // valued through the liquidity handlers.
      multiplier: "0",
      startBlock: OHM_CREATION_BLOCK,
      decimals: 9,
    }),
    token({
      address: ERC20_GOHM_SYNAPSE,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      multiplier: "0",
      decimals: 18,
    }),
    token({
      address: LP_BALANCER_POOL_WETH_VESTA,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_BALANCER_WETH_VSTA_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_BALANCER_POOL_WETH_OHM,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_BALANCER_WETH_OHM_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_BALANCER_POOL_OHM_USDC,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_BALANCER_OHM_USDC_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V2_GOHM_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: ARBITRUM_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V2_JONES_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_UNISWAP_V2_JONES_WETH_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V2_MAGIC_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_UNISWAP_V2_MAGIC_WETH_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_CAMELOT_OHM_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_CAMELOT_OHM_WETH_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V3_ARB_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: LP_UNISWAP_V3_ARB_WETH_CREATION_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V3_WETH_USDC,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: ARBITRUM_START_BLOCK,
      decimals: 18,
    }),
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
  circulatingSupplyWallets: [CROSS_CHAIN_ARBITRUM],
  treasuryBlacklist: {
    [ERC20_OHM]: ARBITRUM_PROTOCOL_ADDRESSES,
    [ERC20_GOHM_SYNAPSE]: ARBITRUM_PROTOCOL_ADDRESSES,
  },
  // USDC and LUSD are priced via the "stable-usd" handler ($1). WETH is priced
  // via the WETH/USDC UniV3 pool, which is in liquidityHandlers below. The
  // previous Chainlink lookups are removed so pricing is fully RPC-free.
  basePriceFeeds: {},
  liquidityHandlers,
  ownedLiquidityHandlers: liquidityHandlers,
};
