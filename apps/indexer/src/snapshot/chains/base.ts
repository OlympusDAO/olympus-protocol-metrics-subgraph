import { addr, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { rpcUrls } from "./rpc";

// Token addresses (per docs/envio-migration/inventory-base.md).
const ERC20_OHM = addr("0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0");
const ERC20_USDC = addr("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
const ERC20_WETH = addr("0x4200000000000000000000000000000000000006");
const LP_UNISWAP_V2_OHM_WETH = addr("0x5ab4b9e96aeed4820e4be267f42411d722985482");
const LP_UNISWAP_V3_OHM_USDC = addr("0x183ea22691c54806fe96555436dd312b6befac2f");

// Chainlink feeds (8-decimal USD-denominated answers).
const CHAINLINK_FEED_ETH_USD = addr("0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70");
const CHAINLINK_FEED_USDC_USD = addr("0x7e860098f58bbfc8648a4311b374b1d669a2bc6b");

// Native ETH (no token contract; balance read via getBalance).
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Protocol wallets.
const DAO_MULTISIG = addr("0x18a390bd45bcc92652b9a91ad51aed7f1c1358f5");

// 2024-04-15, OHM deployment on Base. Per Phase 1 decision #3 (re-index from
// genesis on all chains), we use the legacy non-graft start, NOT the legacy
// graft point at block 25311259.
const BASE_START_BLOCK = 13_204_827;

const PROTOCOL_ADDRESSES = [DAO_MULTISIG];

const names: Record<string, string> = {
  [DAO_MULTISIG]: "DAO MS (Base)",
  [ERC20_OHM]: "OHM",
  [ERC20_USDC]: "USDC",
  [NATIVE_ETH]: "ETH",
  [ERC20_WETH]: "Wrapped ETH",
  [LP_UNISWAP_V2_OHM_WETH]: "UniswapV2 OHM-WETH Liquidity Pool",
  [LP_UNISWAP_V3_OHM_USDC]: "UniswapV3 OHM-USDC Liquidity Pool",
};

const univ2OhmWeth: LiquidityHandler = {
  kind: "univ2",
  tokens: [ERC20_OHM, ERC20_WETH],
  id: LP_UNISWAP_V2_OHM_WETH,
  startBlock: BASE_START_BLOCK,
};

const univ3OhmUsdc: LiquidityHandler = {
  kind: "univ3",
  tokens: [ERC20_OHM, ERC20_USDC],
  id: LP_UNISWAP_V3_OHM_USDC,
  startBlock: BASE_START_BLOCK,
};

const ownedLiquidityHandlers: LiquidityHandler[] = [univ2OhmWeth, univ3OhmUsdc];

const liquidityHandlers: LiquidityHandler[] = [
  // Chainlink wins over pool quotes via CHAINLINK_PRIORITY (10^30) liquidity.
  {
    kind: "chainlink",
    tokens: [ERC20_WETH],
    id: CHAINLINK_FEED_ETH_USD,
    decimals: 8,
    startBlock: BASE_START_BLOCK,
  },
  {
    kind: "chainlink",
    tokens: [ERC20_USDC],
    id: CHAINLINK_FEED_USDC_USD,
    decimals: 8,
    startBlock: BASE_START_BLOCK,
  },
  // Fallback peg for USDC if Chainlink hasn't been seeded yet.
  { kind: "stable", tokens: [ERC20_USDC], id: "stable-usd" },
  univ2OhmWeth,
  univ3OhmUsdc,
  // Native ETH prices via WETH (1:1).
  { kind: "remap", tokens: [NATIVE_ETH], id: NATIVE_ETH, target: ERC20_WETH },
];

export const BASE: ChainConfig = {
  chainId: 8453,
  blockchain: "Base",
  startBlock: BASE_START_BLOCK,
  rpcUrls: rpcUrls("BASE", "https://base.llamarpc.com"),
  ohmToken: ERC20_OHM,
  ohmStartBlock: BASE_START_BLOCK,
  nativeToken: NATIVE_ETH,
  tokens: [
    token({
      address: NATIVE_ETH,
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
      startBlock: BASE_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_USDC,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: BASE_START_BLOCK,
      decimals: 6,
    }),
    // Base predeploy WETH9 — wrap/unwrap via Deposit/Withdrawal events.
    // Tracked by the Wrapped9 handlers in Erc20Transfers.ts.
    token({
      address: ERC20_WETH,
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
      startBlock: BASE_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_OHM,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      // multiplier=0 zeroes out valueExcludingOhm for OHM-token records.
      // createTokenRecord uses this when emitting OHM-side rows for direct
      // holdings and UniV3 NFT POL positions. Missing it inflated Base
      // liquidBacking by ~$763K (the OHM-USDC POL OHM-side row attributed
      // its full value to non-OHM accounting). Mirrors Ethereum's
      // ERC20_OHM_V2 / ERC20_GOHM defs.
      multiplier: "0",
      startBlock: BASE_START_BLOCK,
      decimals: 9,
    }),
    token({
      address: LP_UNISWAP_V2_OHM_WETH,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: BASE_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V3_OHM_USDC,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: BASE_START_BLOCK,
      decimals: 18,
    }),
  ],
  names,
  abbreviations: {},
  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: PROTOCOL_ADDRESSES,
  // Per inventory-base.md section 3: OHM held in DAO MS is excluded from
  // treasury balance; it's accounted for via getTreasuryOHMRecords (supply
  // side) instead so it doesn't double-count as both treasury asset AND
  // off-circulating supply.
  treasuryBlacklist: { [ERC20_OHM]: [DAO_MULTISIG] },
  basePriceFeeds: {},
  // Base UniswapV3 NonfungiblePositionManager (per inventory-base.md §3 +
  // legacy subgraphs/base/src/contracts/Constants.ts:24). pushUniv3NftPol
  // requires this to enumerate NFT positions held by protocol wallets;
  // without it, the OHM-USDC POL was silently missing from the rollup.
  univ3PositionManager: {
    address: addr("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"),
    startBlock: 1_371_714,
  },
  liquidityHandlers,
  ownedLiquidityHandlers,
};
