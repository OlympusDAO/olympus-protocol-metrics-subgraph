/**
 * Protocol addresses on Ethereum mainnet
 */

import { BigInt, log } from "@graphprotocol/graph-ts";

import { BUYBACK_MS } from "../../../shared/src/Wallets";
import { getClearinghouseAddresses, getTreasuryAddress } from "./Bophades";
import { ERC20_GOHM, ERC20_OHM_V1, ERC20_OHM_V2, ERC20_SOHM_V1, ERC20_SOHM_V2, ERC20_SOHM_V3, OHM_IN_MARKET_VALUE_BLOCK } from "./Constants";

export const TREASURY_ADDRESS_V1 = "0x886CE997aa9ee4F8c2282E182aB72A705762399D".toLowerCase();
export const TREASURY_ADDRESS_V2 = "0x31f8cc382c9898b273eff4e0b7626a6987c846e8".toLowerCase();
export const TREASURY_ADDRESS_V3 = "0x9A315BdF513367C0377FB36545857d12e85813Ef".toLowerCase();

export const BONDS_DEPOSIT = "0x9025046c6fb25Fb39e720d97a8FD881ED69a1Ef6".toLowerCase();

/**
 * OHM in this contract is considered burned
 * Excluded from treasury market value (double-counting otherwise)
 * Included in calculations of protocol-owned OHM
 */
export const BONDS_INVERSE_DEPOSIT = "0xBA42BE149e5260EbA4B82418A6306f55D532eA47".toLowerCase();

export const DAO_WALLET = "0x245cc372c84b3645bf0ffe6538620b04a217988b".toLowerCase();
export const DAO_WORKING_CAPITAL = "0xF65A665D650B5De224F46D729e2bD0885EeA9dA5".toLowerCase();

/**
 * Not considered protocol- or DAO-owned
 */
export const OLYMPUS_ASSOCIATION_WALLET = "0x4c71db02aeeb336cbd8f3d2cc866911f6e2fbd94".toLowerCase();

export const COOLER_LOANS_CLEARINGHOUSE = "0xD6A6E8d9e82534bD65821142fcCd91ec9cF31880".toLowerCase();
export const TRSRY = "0xa8687A15D4BE32CC8F0a8a7B9704a4C3993D9613".toLowerCase();
export const TRSRY_V1_1 = "0xea1560F36F71a2F54deFA75ed9EaA15E8655bE22".toLowerCase();

export const OTC_ESCROW = "0xe3312c3f1ab30878d9686452f7205ebe11e965eb".toLowerCase();
export const MYSO_LENDING = "0xb339953fc028b9998775c00594a74dd1488ee2c6".toLowerCase();
export const VENDOR_LENDING = "0x83234a159dbd60a32457df158fafcbdf3d1ccc08".toLowerCase();


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

export const CONVEX_ALLOCATORS = [
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  CONVEX_CVX_ALLOCATOR,
  CONVEX_CVX_VL_ALLOCATOR,
  CONVEX_STAKING_PROXY_FRAXBP,
  CONVEX_STAKING_PROXY_OHM_FRAXBP,
  DAO_WALLET,
];

export const getConvexAllocators = (blockNumber: BigInt): string[] => {
  // If before the exclusion block, return all allocators
  if (blockNumber.lt(BigInt.fromString(CONVEX_ALLOCATOR_DEATH))) {
    return CONVEX_ALLOCATORS;
  }

  // Otherwise remove the bricked allocator
  const allocators = CONVEX_ALLOCATORS.slice(0);
  for (let i = 0; i < allocators.length; i++) {
    if (allocators[i].toLowerCase() == CONVEX_CVX_ALLOCATOR.toLowerCase()) {
      log.debug("getConvexAllocators: removing bricked allocator: {}", [CONVEX_CVX_ALLOCATOR]);
      allocators.splice(i, 1);
      break;
    }
  }

  // Return the allocators
  return allocators;
}

/**
 * This set of wallet addresses is common across many tokens,
 * and can be used for balance lookups.
 *
 * Myso and Vendor Finance contracts are NOT included in here, as the deployed amounts are hard-coded.
 */
const PROTOCOL_ADDRESSES = [
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
  VEFXS_ALLOCATOR,
];

const TREASURY_BLACKLIST = new Map<string, string[]>();

/**
 * OHM and gOHM in the following wallets are blacklisted (not indexed) as we do not want the value
 * being considered as part of the protocol or DAO treasuries.
 */
TREASURY_BLACKLIST.set(ERC20_OHM_V1, PROTOCOL_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_OHM_V2, PROTOCOL_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_GOHM, PROTOCOL_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V1, PROTOCOL_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V2, PROTOCOL_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V3, PROTOCOL_ADDRESSES);

const CONVEX_ALLOCATOR_DEATH = "22278800";

/**
 * Some wallets (e.g. {DAO_WALLET}) have specific treasury assets mixed into them.
 * For this reason, the wallets to be used differ on a per-contract basis.
 *
 * This function returns the wallets that should be iterated over for the given
 * contract, {contractAddress}.
 *
 * @param contractAddress
 * @returns
 */
export const getWalletAddressesForContract = (contractAddress: string, blockNumber: BigInt): string[] => {
  const walletAddresses = PROTOCOL_ADDRESSES.slice(0);
  const trsryAddress = getTreasuryAddress(blockNumber);

  // Add in the Bophades Treasury address, since that is dynamic
  if (trsryAddress !== null) {
    log.info("getWalletAddressesForContract: adding treasury address: {}", [trsryAddress.toHexString()]);
    walletAddresses.push(trsryAddress.toHexString().toLowerCase());
  }

  // Add in the Clearinghouse addresses, since that is dynamic
  const clearinghouseAddresses = getClearinghouseAddresses(blockNumber);
  for (let i = 0; i < clearinghouseAddresses.length; i++) {
    // If the address is already in the array, skip
    if (walletAddresses.includes(clearinghouseAddresses[i].toHexString().toLowerCase())) {
      continue;
    }

    walletAddresses.push(clearinghouseAddresses[i].toHexString().toLowerCase());
  }

  // If after the exclusion block, remove the convex allocator
  // Reason: funds in it are bricked
  if (blockNumber.ge(BigInt.fromString(CONVEX_ALLOCATOR_DEATH))) {
    for (let i = 0; i < walletAddresses.length; i++) {
      // Check address
      if (walletAddresses[i].toLowerCase() != CONVEX_CVX_ALLOCATOR.toLowerCase()) continue;

      // Check exclusion block
      if (blockNumber.lt(BigInt.fromString(CONVEX_ALLOCATOR_DEATH))) continue;

      // Remove the address in-place
      walletAddresses.splice(i, 1);
      log.debug("getWalletAddressesForContract: removed convex allocator: {}", [CONVEX_CVX_ALLOCATOR]);
      break;
    }
  }

  // If the contract isn't on the blacklist, return as normal
  if (!TREASURY_BLACKLIST.has(contractAddress.toLowerCase())) {
    log.debug("getWalletAddressesForContract: token {} is not on treasury blacklist", [contractAddress]);
    return walletAddresses;
  }

  // Otherwise remove the values in the blacklist
  // AssemblyScript doesn't yet have closures, so filter() cannot be used
  const walletBlacklist = TREASURY_BLACKLIST.get(contractAddress.toLowerCase());
  for (let i = 0; i < walletBlacklist.length; i++) {
    // If the blacklisted address is not in the array, skip
    const arrayIndex = walletAddresses.indexOf(walletBlacklist[i]);
    if (arrayIndex < 0) {
      continue;
    }

    // If it is the buyback MS and the block is >= the inclusion block
    if (walletBlacklist[i].toLowerCase() == BUYBACK_MS.toLowerCase() && blockNumber.ge(OHM_IN_MARKET_VALUE_BLOCK)) {
      continue;
    }

    // Otherwise the blacklist address is removed from the array in-place
    const splicedValues = walletAddresses.splice(arrayIndex, 1);
    log.debug("getWalletAddressesForContract: removed values: {}", [splicedValues.toString()]);
  }

  return walletAddresses;
};
