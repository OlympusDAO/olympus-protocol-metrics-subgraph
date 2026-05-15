// Shared wallet addresses, mirroring subgraphs/shared/src/Wallets.ts. Imported
// by per-chain configs that historically iterated `WALLET_ADDRESSES` (Polygon,
// Fantom, Ethereum). Most are Ethereum-deployed contracts; including them in
// non-Ethereum chain configs is a no-op for HyperSync's Transfer-event `where`
// filter (no matches) but matches legacy behavior so per-chain parity holds.

import { addr } from "./math";

// Cross-chain bridge wallets — the receiving address on each non-Ethereum chain.
export const CROSS_CHAIN_ARBITRUM = addr("0x012bbf0481b97170577745d2167ee14f63e2ad4c");
export const CROSS_CHAIN_FANTOM = addr("0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10");
export const CROSS_CHAIN_POLYGON = addr("0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7");

// Mainnet treasury / DAO wallets.
export const TREASURY_ADDRESS_V1 = addr("0x886CE997aa9ee4F8c2282E182aB72A705762399D");
export const TREASURY_ADDRESS_V2 = addr("0x31f8cc382c9898b273eff4e0b7626a6987c846e8");
export const TREASURY_ADDRESS_V3 = addr("0x9A315BdF513367C0377FB36545857d12e85813Ef");
export const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
export const DAO_WORKING_CAPITAL = addr("0xF65A665D650B5De224F46D729e2bD0885EeA9dA5");
export const TRSRY = addr("0xa8687A15D4BE32CC8F0a8a7B9704a4C3993D9613");

export const BUYBACK_MS = addr("0xf7deb867e65306be0cb33918ac1b8f89a72109db");
export const YIELD_FARMING_MS = addr("0x2075e3b46470cfcE124Daaf52b46Dcf965727Dd1");
export const OTC_ESCROW = addr("0xe3312c3f1ab30878d9686452f7205ebe11e965eb");

// Bonds.
export const BONDS_DEPOSIT = addr("0x9025046c6fb25Fb39e720d97a8FD881ED69a1Ef6");
export const BONDS_INVERSE_DEPOSIT = addr("0xBA42BE149e5260EbA4B82418A6306f55D532eA47");

// Allocators (mainnet).
export const AAVE_ALLOCATOR = addr("0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4");
export const AAVE_ALLOCATOR_V2 = addr("0x0d33c811d0fcc711bcb388dfb3a152de445be66f");
export const AURA_ALLOCATOR = addr("0x872ebDd8129Aa328C89f6BF032bBD77a4c4BaC7e");
export const AURA_ALLOCATOR_V2 = addr("0x8CaF91A6bb38D55fB530dEc0faB535FA78d98FaD");
export const BALANCER_ALLOCATOR = addr("0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6");
export const CONVEX_ALLOCATOR1 = addr("0x3dF5A355457dB3A4B5C744B8623A7721BF56dF78");
export const CONVEX_ALLOCATOR2 = addr("0x408a9A09d97103022F53300A3A14Ca6c3FF867E8");
export const CONVEX_ALLOCATOR3 = addr("0xDbf0683fC4FC8Ac11e64a6817d3285ec4f2Fc42d");
export const CONVEX_CVX_ALLOCATOR = addr("0xdfc95aaf0a107daae2b350458ded4b7906e7f728");
export const CONVEX_CVX_VL_ALLOCATOR = addr("0x2d643df5de4e9ba063760d475beaa62821c71681");
export const CONVEX_STAKING_PROXY_FRAXBP = addr("0x943C1dfA7dA96e54242bD2c78DD3eF5C7b24b18C");
export const CONVEX_STAKING_PROXY_OHM_FRAXBP = addr("0x75E7f7D871F4B5db0fA9B0f01B7422352Ec9618f");
export const LUSD_ALLOCATOR = addr("0x97b3ef4c558ec456d59cb95c65bfb79046e31fca");
export const LUSD_ALLOCATOR_V2 = LUSD_ALLOCATOR; // Legacy: same address as V1.
export const MAKER_DSR_ALLOCATOR = addr("0x0EA26319836fF05B8C5C5afD83b8aB17dd46d063");
export const MAKER_DSR_ALLOCATOR_PROXY = addr("0x5db0761487e26B555F5Bfd5E40F4CBC3E1a7d11E");
export const RARI_ALLOCATOR = addr("0x061C8610A784b8A1599De5B1157631e35180d818");
export const VEFXS_ALLOCATOR = addr("0xde7b85f52577b113181921a7aa8fc0c22e309475");

// Cooler clearinghouses.
export const COOLER_LOANS_CLEARINGHOUSE_V1 = addr("0xD6A6E8d9e82534bD65821142fcCd91ec9cF31880");
export const COOLER_LOANS_CLEARINGHOUSE_V1_1 = addr("0xE6343ad0675C9b8D3f32679ae6aDbA0766A2ab4c");
export const COOLER_LOANS_CLEARINGHOUSE_V2 = addr("0x1e094fE00E13Fd06D64EeA4FB3cD912893606fE0");
export const COOLER_LOANS_V2_MONOCOOLER = addr("0xdb591Ea2e5Db886dA872654D58f6cc584b68e7cC");

// Full WALLET_ADDRESSES list mirroring subgraphs/shared/src/Wallets.ts.
// Used by Polygon (and historically Fantom) to iterate the entire shared
// wallet set. Most are Ethereum-only — non-matches are harmless.
export const WALLET_ADDRESSES = [
  AAVE_ALLOCATOR_V2,
  AAVE_ALLOCATOR,
  AURA_ALLOCATOR_V2,
  AURA_ALLOCATOR,
  BALANCER_ALLOCATOR,
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  BUYBACK_MS,
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  CONVEX_CVX_ALLOCATOR,
  CONVEX_CVX_VL_ALLOCATOR,
  CONVEX_STAKING_PROXY_FRAXBP,
  CONVEX_STAKING_PROXY_OHM_FRAXBP,
  CROSS_CHAIN_ARBITRUM,
  CROSS_CHAIN_FANTOM,
  CROSS_CHAIN_POLYGON,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  LUSD_ALLOCATOR,
  LUSD_ALLOCATOR_V2,
  MAKER_DSR_ALLOCATOR_PROXY,
  MAKER_DSR_ALLOCATOR,
  OTC_ESCROW,
  RARI_ALLOCATOR,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  TRSRY,
  VEFXS_ALLOCATOR,
  COOLER_LOANS_CLEARINGHOUSE_V1,
  COOLER_LOANS_CLEARINGHOUSE_V1_1,
  COOLER_LOANS_CLEARINGHOUSE_V2,
  COOLER_LOANS_V2_MONOCOOLER,
  YIELD_FARMING_MS,
];
