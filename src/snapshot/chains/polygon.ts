import { addr, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";
import { CROSS_CHAIN_POLYGON, DAO_WALLET } from "../wallets";
import { rpcUrls } from "./rpc";

// Token addresses (per docs/envio-migration/inventory-polygon.md).
const ERC20_DAI = addr("0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063");
const ERC20_FRAX = addr("0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89");
const ERC20_GOHM = addr("0xd8cA34fd379d9ca3C6Ee3b3905678320F5b45195");
const ERC20_KLIMA = addr("0x4e78011ce80ee02d2c3e649fb657e45898257815");
const ERC20_KLIMA_STAKED = addr("0xb0C22d8D350C67420f06F48936654f567C73E8C8");
const ERC20_SYN = addr("0x50B728D8D964fd00C2d0AAD81718b71311feF68a");
const ERC20_USDC = addr("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
const ERC20_WETH = addr("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619");

// Pool addresses used for pricing on Polygon. Only the wETH-gOHM pair is POL.
const LP_UNISWAP_V2_KLIMA_USDC = addr("0x5786b267d35f9d011c4750e0b0ba584e1fdbead1");
const LP_UNISWAP_V2_SYN_WETH = addr("0x4a86c01d67965f8cb3d0aaa2c655705e64097c31");
const LP_UNISWAP_V2_USDC_WETH = addr("0x853ee4b2a13f8a742d64c8f088be7ba2131f670d");
const LP_UNISWAP_V2_WETH_GOHM = addr("0x1549e0e8127d380080aab448b82d280433ce4030");

// Polygon mainnet launched 2020-05-30 at block 0; OHM-related activity began
// later. Per Phase 1 decision #3 (re-index from genesis, no graft), pick a
// start block close to when Olympus first bridged assets to Polygon.
const POLYGON_START_BLOCK = 23_000_000; // ~2021-09-22

// Per @0xJem on PR #311: per-chain protocolAddresses should be trimmed to
// just the wallets that actually hold assets on this chain. Rigorous on-chain
// audit (37 candidate wallets × 8 Polygon tokens × 5 historical blocks)
// confirms only Cross-Chain Polygon has ever held any tracked Polygon token.
// Trimming from the full WALLET_ADDRESSES (37 wallets) avoids ~37x of the
// iteration cost in snapshot reads, BackfillTokenBalances, and the
// pushOwnedLiquidityRecords / pushTreasuryOhm paths. Output is unchanged
// (legacy also dropped zero-balance wallets at TokenRecord write time).
const PROTOCOL_ADDRESSES = [CROSS_CHAIN_POLYGON];

const names: Record<string, string> = {
  // Treasury / protocol wallets — match legacy CONTRACT_NAME_MAP labels.
  [CROSS_CHAIN_POLYGON]: "Cross-Chain Polygon",
  [DAO_WALLET]: "Treasury MS (Formerly DAO Wallet)",
  [ERC20_DAI]: "DAI",
  [ERC20_FRAX]: "FRAX",
  [ERC20_GOHM]: "Governance OHM",
  [ERC20_KLIMA]: "KLIMA",
  [ERC20_KLIMA_STAKED]: "Staked KLIMA",
  [ERC20_SYN]: "Synapse",
  [ERC20_USDC]: "USDC",
  [ERC20_WETH]: "Wrapped ETH",
  [LP_UNISWAP_V2_WETH_GOHM]: "UniswapV2 wETH-gOHM Liquidity Pool",
  [LP_UNISWAP_V2_KLIMA_USDC]: "UniswapV2 KLIMA-USDC Liquidity Pool",
  [LP_UNISWAP_V2_SYN_WETH]: "UniswapV2 SYN-wETH Liquidity Pool",
  [LP_UNISWAP_V2_USDC_WETH]: "UniswapV2 USDC-wETH Liquidity Pool",
};

// Owned liquidity = the wETH-gOHM POL pool. The KLIMA-USDC, SYN-wETH and
// USDC-wETH UniV2 pairs exist for *pricing* (KLIMA via USDC peg, SYN via
// wETH, etc.) but treasury never holds those LP tokens.
const univ2WethGohm: LiquidityHandler = {
  kind: "univ2",
  tokens: [ERC20_GOHM, ERC20_WETH],
  id: LP_UNISWAP_V2_WETH_GOHM,
  startBlock: POLYGON_START_BLOCK,
};

const ownedLiquidityHandlers: LiquidityHandler[] = [univ2WethGohm];

const liquidityHandlers: LiquidityHandler[] = [
  // Polygon legacy has no Chainlink — pricing is pure UniV2 + stable.
  { kind: "stable", tokens: [ERC20_DAI, ERC20_FRAX, ERC20_USDC], id: "stable-usd" },
  // Pricing pools.
  univ2WethGohm,
  {
    kind: "univ2",
    tokens: [ERC20_KLIMA, ERC20_USDC],
    id: LP_UNISWAP_V2_KLIMA_USDC,
    startBlock: POLYGON_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_SYN, ERC20_WETH],
    id: LP_UNISWAP_V2_SYN_WETH,
    startBlock: POLYGON_START_BLOCK,
  },
  {
    kind: "univ2",
    tokens: [ERC20_USDC, ERC20_WETH],
    id: LP_UNISWAP_V2_USDC_WETH,
    startBlock: POLYGON_START_BLOCK,
  },
  // Staked KLIMA prices 1:1 with KLIMA.
  {
    kind: "remap",
    tokens: [ERC20_KLIMA_STAKED],
    id: ERC20_KLIMA_STAKED,
    target: ERC20_KLIMA,
  },
];

export const POLYGON: ChainConfig = {
  chainId: 137,
  blockchain: "Polygon",
  startBlock: POLYGON_START_BLOCK,
  rpcUrls: rpcUrls("POLYGON", "https://polygon-rpc.com"),
  ohmToken: ERC20_GOHM, // Polygon's "OHM-family" token is gOHM (no native OHM bridged).
  ohmStartBlock: POLYGON_START_BLOCK,
  // Native MATIC tracking deferred to the NativeBalanceState wiring commit
  // (matches legacy Polygon, which also doesn't track native).
  tokens: [
    token({
      address: ERC20_DAI,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_FRAX,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
    // KLIMA carries a 0.85 multiplier — treasury liquid backing for KLIMA
    // is haircut to 85% of market value (per legacy Polygon Constants.ts:29).
    token({
      address: ERC20_KLIMA,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      multiplier: "0.85",
      startBlock: POLYGON_START_BLOCK,
      decimals: 9,
    }),
    // Staked KLIMA — sOHM-style rebase token. balanceOf grows silently via
    // LogRebase events without emitting Transfer. A proper event-driven fix
    // would mirror our OhmIndexState pattern: index sKLIMA.LogRebase into a
    // KlimaIndex entity and compute balance = scaledBalance × index. Not built
    // because Cross-Chain Polygon's sKLIMA position is ~52 tokens (~$52
    // nominal) — the 1 RPC per snapshot to balanceOf is cheaper than the
    // indexing infrastructure. If KLIMA holdings ever grow, build the index
    // entity (see SOhmV3.ts for the equivalent pattern on Ethereum).
    token({
      address: ERC20_KLIMA_STAKED,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      multiplier: "0.85",
      startBlock: POLYGON_START_BLOCK,
      decimals: 9,
      nonStandardBalance: true,
    }),
    token({
      address: ERC20_SYN,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: ERC20_USDC,
      category: "Stable",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 6,
    }),
    // Polygon PoS-bridged WETH. Cross-Chain Polygon currently holds 0
    // on-chain and ledger is 0 — no drift observed. Earlier "bridge may
    // not emit Transfer" comment was defensive; flag dropped pending any
    // future drift. If a wallet does start receiving WETH via the PoS
    // bridge and the ledger drifts, revisit and either re-add the flag or
    // index the bridge's `LockedERC20` / `ExitedERC20` events.
    token({
      address: ERC20_WETH,
      category: "Volatile",
      isLiquid: true,
      isBluechip: true,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
    // Bridged gOHM on Polygon — same audit conclusion as WETH above.
    token({
      address: ERC20_GOHM,
      category: "Volatile",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
    token({
      address: LP_UNISWAP_V2_WETH_GOHM,
      category: "Protocol-Owned Liquidity",
      isLiquid: true,
      isBluechip: false,
      startBlock: POLYGON_START_BLOCK,
      decimals: 18,
    }),
  ],
  names,
  abbreviations: {},
  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: PROTOCOL_ADDRESSES,
  treasuryBlacklist: {},
  basePriceFeeds: {},
  liquidityHandlers,
  ownedLiquidityHandlers,
};
