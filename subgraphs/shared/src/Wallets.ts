export const CROSS_CHAIN_ARBITRUM = "0x012bbf0481b97170577745d2167ee14f63e2ad4c".toLowerCase();
export const CROSS_CHAIN_FANTOM = "0x2bc001ffeb862d843e0a02a7163c7d4828e5fb10".toLowerCase();
export const CROSS_CHAIN_POLYGON = "0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7".toLowerCase();
export const TREASURY_ADDRESS_V1 = "0x886CE997aa9ee4F8c2282E182aB72A705762399D".toLowerCase();
export const TREASURY_ADDRESS_V2 = "0x31f8cc382c9898b273eff4e0b7626a6987c846e8".toLowerCase();
export const TREASURY_ADDRESS_V3 = "0x9A315BdF513367C0377FB36545857d12e85813Ef".toLowerCase();

export const BONDS_DEPOSIT = "0x9025046c6fb25Fb39e720d97a8FD881ED69a1Ef6".toLowerCase();
export const BUYBACK_MS = "0xf7deb867e65306be0cb33918ac1b8f89a72109db".toLowerCase();

/**
 * OHM in this contract is considered burned
 * Excluded from treasury market value (double-counting otherwise)
 * Included in calculations of protocol-owned OHM
 */
export const BONDS_INVERSE_DEPOSIT = "0xBA42BE149e5260EbA4B82418A6306f55D532eA47".toLowerCase();

// TODO consider if allocators should be in shared/ or ethereum/
export const AAVE_ALLOCATOR = "0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4".toLowerCase();
export const AAVE_ALLOCATOR_V2 = "0x0d33c811d0fcc711bcb388dfb3a152de445be66f".toLowerCase();
export const AURA_ALLOCATOR = "0x872ebDd8129Aa328C89f6BF032bBD77a4c4BaC7e".toLowerCase();
export const AURA_ALLOCATOR_V2 = "0x8CaF91A6bb38D55fB530dEc0faB535FA78d98FaD".toLowerCase();
export const BALANCER_ALLOCATOR = "0xa9b52a2d0ffdbabdb2cb23ebb7cd879cac6618a6".toLowerCase(); // Incorrect?
export const CONVEX_ALLOCATOR1 = "0x3dF5A355457dB3A4B5C744B8623A7721BF56dF78".toLowerCase();
export const CONVEX_ALLOCATOR2 = "0x408a9A09d97103022F53300A3A14Ca6c3FF867E8".toLowerCase();
export const CONVEX_ALLOCATOR3 = "0xDbf0683fC4FC8Ac11e64a6817d3285ec4f2Fc42d".toLowerCase();
export const CONVEX_CVX_ALLOCATOR = "0xdfc95aaf0a107daae2b350458ded4b7906e7f728".toLowerCase();
export const CONVEX_CVX_VL_ALLOCATOR = "0x2d643df5de4e9ba063760d475beaa62821c71681".toLowerCase();
export const CONVEX_STAKING_PROXY_FRAXBP = "0x943C1dfA7dA96e54242bD2c78DD3eF5C7b24b18C".toLowerCase();
export const CONVEX_STAKING_PROXY_OHM_FRAXBP = "0x75E7f7D871F4B5db0fA9B0f01B7422352Ec9618f".toLowerCase();
export const LUSD_ALLOCATOR = "0x97b3ef4c558ec456d59cb95c65bfb79046e31fca".toLowerCase();
export const LUSD_ALLOCATOR_V2 = "0x97b3ef4c558ec456d59cb95c65bfb79046e31fca".toLowerCase();
export const MAKER_DSR_ALLOCATOR = "0x0EA26319836fF05B8C5C5afD83b8aB17dd46d063".toLowerCase();
export const MAKER_DSR_ALLOCATOR_PROXY = "0x5db0761487e26B555F5Bfd5E40F4CBC3E1a7d11E".toLowerCase();
export const RARI_ALLOCATOR = "0x061C8610A784b8A1599De5B1157631e35180d818".toLowerCase();
export const VEFXS_ALLOCATOR = "0xde7b85f52577b113181921a7aa8fc0c22e309475".toLowerCase();

export const DAO_WALLET = "0x245cc372c84b3645bf0ffe6538620b04a217988b".toLowerCase();
export const DAO_WORKING_CAPITAL = "0xF65A665D650B5De224F46D729e2bD0885EeA9dA5".toLowerCase();

/**
 * Not considered protocol- or DAO-owned
 */
export const OLYMPUS_ASSOCIATION_WALLET = "0x4c71db02aeeb336cbd8f3d2cc866911f6e2fbd94".toLowerCase();

// Don't iterate through these addresses: use getClearinghouseAddresses() instead
export const COOLER_LOANS_CLEARINGHOUSE_V1 = "0xD6A6E8d9e82534bD65821142fcCd91ec9cF31880".toLowerCase();
export const COOLER_LOANS_CLEARINGHOUSE_V1_1 = "0xE6343ad0675C9b8D3f32679ae6aDbA0766A2ab4c".toLowerCase();
export const COOLER_LOANS_CLEARINGHOUSE_V2 = "0x1e094fE00E13Fd06D64EeA4FB3cD912893606fE0".toLowerCase();

export const TRSRY = "0xa8687A15D4BE32CC8F0a8a7B9704a4C3993D9613".toLowerCase();
export const TRSRY_V1_1 = "0xea1560F36F71a2F54deFA75ed9EaA15E8655bE22".toLowerCase();

export const OTC_ESCROW = "0xe3312c3f1ab30878d9686452f7205ebe11e965eb".toLowerCase();
export const MYSO_LENDING = "0xb339953fc028b9998775c00594a74dd1488ee2c6".toLowerCase();
export const VENDOR_LENDING = "0x83234a159dbd60a32457df158fafcbdf3d1ccc08".toLowerCase();

export const COOLER_LOANS_V2_MONOCOOLER = "0xdb591Ea2e5Db886dA872654D58f6cc584b68e7cC".toLowerCase();

/**
 * This set of wallet addresses is common across many tokens,
 * and can be used for balance lookups.
 *
 * Myso and Vendor Finance contracts are NOT included in here, as the deployed amounts are hard-coded.
 */
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
];
