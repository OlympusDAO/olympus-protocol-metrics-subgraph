import { addr, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { CROSS_CHAIN_FANTOM, DAO_WALLET } from "../wallets";
import { rpcUrls } from "./rpc";

// Token addresses (per docs/envio-migration/inventory-fantom.md and
// subgraphs/fantom/src/contracts/Constants.ts).
const ERC20_BEETS = addr("0xf24bcf4d1e507740041c9cfd2dddb29585adce1e");
const ERC20_BOO = addr("0x841fad6eae12c286d1fd18d1d525dffa75c7effe");
const ERC20_DAI = addr("0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E");
const ERC20_DEI = addr("0xDE1E704dae0B4051e80DAbB26ab6ad6c12262DA0");
const ERC20_FRAX = addr("0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355");
const ERC20_GOHM = addr("0x91fa20244Fb509e8289CA630E5db3E9166233FDc");
const ERC20_LQDR = addr("0x10b620b2dbAC4Faa7D7FFD71Da486f5D44cd86f9");
const ERC20_OXD = addr("0xc5A9848b9d145965d821AaeC8fA32aaEE026492d");
const ERC20_USDC = addr("0x04068da6c83afcfa0e13ba15a6696662335d5b75");
const ERC20_WETH = addr("0x74b23882a30290451a17c44f4f05243b6b58c76d"); // Multichain-bridged WETH on Fantom
const ERC20_WFTM = addr("0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83");

// Pool addresses used for pricing on Fantom.
const LP_UNISWAP_V2_BOO_WFTM = addr("0xec7178f4c41f346b2721907f5cf7628e388a7a58");
const LP_UNISWAP_V2_LQDR_WFTM = addr("0x4fe6f19031239f105f753d1df8a0d24857d0caa2");
const LP_UNISWAP_V2_WFTM_BEETS = addr("0x648a7452da25b4fb4bdb79badf374a8f8a5ea2b5");
const LP_UNISWAP_V2_WFTM_ETH = addr("0xf0702249f4d3a25cd3ded7859a165693685ab577");
const LP_UNISWAP_V2_WFTM_GOHM = addr("0xae9bba22e87866e48ccacff0689afaa41eb94995");
const LP_UNISWAP_V2_WFTM_OXD = addr("0xcb6eab779780c7fd6d014ab90d8b10e97a1227e2");
const LP_UNISWAP_V2_WFTM_USDC = addr("0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c");

// 2022-05-01, matches legacy Fantom start block.
const FANTOM_START_BLOCK = 37_320_000;

const PROTOCOL_ADDRESSES = [CROSS_CHAIN_FANTOM, DAO_WALLET];

// Per Phase 1 decision #5: latent legacy bugs are fixed during the port.
// Fantom legacy had two name-map bugs: (a) abbreviations land in
// CONTRACT_NAME_MAP overwriting names, (b) wFTM gets two name entries that
// fight over what wins. Fixed here by setting names explicitly + using a
// separate abbreviations map.
const names: Record<string, string> = {
  [CROSS_CHAIN_FANTOM]: "Cross-Chain Fantom",
  [DAO_WALLET]: "Treasury MS (Formerly DAO Wallet)",
  [ERC20_BEETS]: "Beethoven",
  [ERC20_BOO]: "SpookySwap",
  [ERC20_DAI]: "DAI",
  [ERC20_DEI]: "Deus Finance",
  [ERC20_FRAX]: "FRAX",
  [ERC20_GOHM]: "Governance OHM",
  [ERC20_LQDR]: "Liquid Driver",
  [ERC20_OXD]: "0xDAO",
  [ERC20_USDC]: "USDC",
  [ERC20_WETH]: "Wrapped ETH",
  [ERC20_WFTM]: "Wrapped Fantom",
  [LP_UNISWAP_V2_BOO_WFTM]: "UniswapV2 BOO-wFTM Liquidity Pool",
  [LP_UNISWAP_V2_LQDR_WFTM]: "UniswapV2 LQDR-wFTM Liquidity Pool",
  [LP_UNISWAP_V2_WFTM_BEETS]: "UniswapV2 wFTM-BEETS Liquidity Pool",
  [LP_UNISWAP_V2_WFTM_ETH]: "UniswapV2 wFTM-ETH Liquidity Pool",
  [LP_UNISWAP_V2_WFTM_GOHM]: "UniswapV2 wFTM-gOHM Liquidity Pool",
  [LP_UNISWAP_V2_WFTM_OXD]: "UniswapV2 wFTM-OXD Liquidity Pool",
  [LP_UNISWAP_V2_WFTM_USDC]: "UniswapV2 wFTM-USDC Liquidity Pool",
};

const abbreviations: Record<string, string> = {
  [ERC20_BEETS]: "BEETS",
  [ERC20_BOO]: "BOO",
  [ERC20_DAI]: "DAI",
  [ERC20_DEI]: "DEI",
  [ERC20_FRAX]: "FRAX",
  [ERC20_GOHM]: "gOHM",
  [ERC20_LQDR]: "LQDR",
  [ERC20_OXD]: "OXD",
  [ERC20_WETH]: "wETH",
  [ERC20_WFTM]: "wFTM",
};

const univ2WftmGohm: LiquidityHandler = {
  kind: "univ2",
  tokens: [ERC20_GOHM, ERC20_WFTM],
  id: LP_UNISWAP_V2_WFTM_GOHM,
  startBlock: FANTOM_START_BLOCK,
};

const ownedLiquidityHandlers: LiquidityHandler[] = [univ2WftmGohm];

const liquidityHandlers: LiquidityHandler[] = [
  // No Chainlink on Fantom — pricing is pure UniV2 + stable.
  { kind: "stable", tokens: [ERC20_DAI, ERC20_DEI, ERC20_FRAX, ERC20_USDC], id: "stable-usd" },
  // Anchor wFTM via wFTM-USDC pool.
  {
    kind: "univ2",
    tokens: [ERC20_USDC, ERC20_WFTM],
    id: LP_UNISWAP_V2_WFTM_USDC,
    startBlock: FANTOM_START_BLOCK,
  },
  // Anchor wETH via wFTM-ETH pool (recurses to wFTM via above).
  {
    kind: "univ2",
    tokens: [ERC20_WETH, ERC20_WFTM],
    id: LP_UNISWAP_V2_WFTM_ETH,
    startBlock: FANTOM_START_BLOCK,
  },
  univ2WftmGohm,
  {
    kind: "univ2",
    tokens: [ERC20_BOO, ERC20_WFTM],
    id: LP_UNISWAP_V2_BOO_WFTM,
    startBlock: FANTOM_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_LQDR, ERC20_WFTM],
    id: LP_UNISWAP_V2_LQDR_WFTM,
    startBlock: FANTOM_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_BEETS, ERC20_WFTM],
    id: LP_UNISWAP_V2_WFTM_BEETS,
    startBlock: FANTOM_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_OXD, ERC20_WFTM],
    id: LP_UNISWAP_V2_WFTM_OXD,
    startBlock: FANTOM_START_BLOCK,
  },
];

export const FANTOM: ChainConfig = {
  chainId: 250,
  blockchain: "Fantom",
  startBlock: FANTOM_START_BLOCK,
  rpcUrls: rpcUrls("FANTOM", "https://rpc.ftm.tools"),
  ohmToken: ERC20_GOHM, // Fantom's OHM-family token is gOHM (no native OHM bridged).
  ohmStartBlock: FANTOM_START_BLOCK,
  // Phase 1 decision #1: match legacy and emit no TokenSupply rows.
  emitsTokenSupply: false,
  // Native FTM tracking deferred to the NativeBalanceState wiring commit.
  tokens: [
    token(ERC20_BEETS, "Volatile", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_BOO, "Volatile", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_DAI, "Stable", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_DEI, "Stable", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_FRAX, "Stable", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_LQDR, "Volatile", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_OXD, "Volatile", true, true, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_USDC, "Stable", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 6,
    }),
    token(ERC20_WETH, "Volatile", true, true, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_WFTM, "Volatile", true, true, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(ERC20_GOHM, "Volatile", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
    token(LP_UNISWAP_V2_WFTM_GOHM, "Protocol-Owned Liquidity", true, false, undefined, {
      startBlock: FANTOM_START_BLOCK,
      decimals: 18,
    }),
  ],
  names,
  abbreviations,
  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: PROTOCOL_ADDRESSES,
  treasuryBlacklist: {},
  basePriceFeeds: {},
  liquidityHandlers,
  ownedLiquidityHandlers,
};
