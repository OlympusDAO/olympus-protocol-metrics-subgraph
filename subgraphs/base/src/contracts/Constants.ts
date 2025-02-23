import { log } from "@graphprotocol/graph-ts";

import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";

export const BLOCKCHAIN = "Base";

export const ERC20_OHM = "0x060cb087a9730E13aa191f31A6d86bFF8DfcdCC0".toLowerCase();
export const ERC20_WETH = "0x4200000000000000000000000000000000000006".toLowerCase();
export const ERC20_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();

export const LP_UNISWAP_V2_OHM_WETH = "0x5ab4b9e96aeed4820e4be267f42411d722985482".toLowerCase();
export const LP_UNISWAP_V3_OHM_USDC = "0x183ea22691c54806FE96555436dd312b6BeFAc2F".toLowerCase();

export const ERC20_TOKENS_BASE = new Map<string, TokenDefinition>();
ERC20_TOKENS_BASE.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_BASE.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));
ERC20_TOKENS_BASE.set(LP_UNISWAP_V2_OHM_WETH, new TokenDefinition(LP_UNISWAP_V2_OHM_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_BASE.set(LP_UNISWAP_V3_OHM_USDC, new TokenDefinition(LP_UNISWAP_V3_OHM_USDC, TokenCategoryPOL, true, false));

export const OHM_TOKENS = [ERC20_OHM];

export const DAO_MULTISIG = "0x18a390bD45bCc92652b9A91AD51Aed7f1c1358f5".toLowerCase();

export const UNISWAP_V3_POSITION_MANAGER = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1".toLowerCase();

export const PROTOCOL_ADDRESSES = [
    DAO_MULTISIG
];

const TREASURY_BLACKLIST = new Map<string, string[]>();
TREASURY_BLACKLIST.set(ERC20_OHM, [DAO_MULTISIG]);

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
export const getWalletAddressesForContract = (contractAddress: string): string[] => {
    const walletAddresses = PROTOCOL_ADDRESSES.slice(0);

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

      // Otherwise the blacklist address is removed from the array in-place
      const splicedValues = walletAddresses.splice(arrayIndex, 1);
      log.debug("getWalletAddressesForContract: removed values: {}", [splicedValues.toString()]);
    }

    return walletAddresses;
  };

export const CONTRACT_NAME_MAP = new Map<string, string>();
CONTRACT_NAME_MAP.set(DAO_MULTISIG, "DAO MS (Base)");
CONTRACT_NAME_MAP.set(ERC20_OHM, "OHM");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_WETH, "Wrapped Ether");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_OHM_WETH, "Uniswap V2 OHM-wETH LP");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V3_OHM_USDC, "Uniswap V3 OHM-USDC LP");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_OHM, "OHM");
CONTRACT_ABBREVIATION_MAP.set(ERC20_USDC, "USDC");
CONTRACT_ABBREVIATION_MAP.set(ERC20_WETH, "wETH");
