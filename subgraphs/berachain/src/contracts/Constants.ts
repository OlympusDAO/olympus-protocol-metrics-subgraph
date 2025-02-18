import { Address,log } from "@graphprotocol/graph-ts";

import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { PriceHandlerKodiakIsland } from "../price/PriceHandlerKodiakIsland";

export const BLOCKCHAIN = "Berachain";

// Tokens
export const ERC20_OHM = "0x18878Df23e2a36f81e820e4b47b4A40576D3159C".toLowerCase();
export const ERC20_IBERA = "0x9b6761bf2397Bb5a6624a856cC84A3A14Dcd3fe5".toLowerCase();
export const ERC20_STARGATE_USDC = "0x549943e04f40284185054145c6E4e9568C1D3241".toLowerCase();
export const ERC20_HONEY = "0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce".toLowerCase();
export const ERC20_WBERA = "0x6969696969696969696969696969696969696969".toLowerCase();
export const NATIVE_BERA =  Address.zero().toHexString().toLowerCase();

// LP tokens
export const LP_UNISWAP_V3_WBERA_HONEY = "0x1127f801cb3ab7bdf8923272949aa7dba94b5805".toLowerCase();
export const LP_KODIAK_OHM_HONEY = "0x98bDEEde9A45C28d229285d9d6e9139e9F505391".toLowerCase();
export const LP_BERADROME_KODIAK_OHM_HONEY = "0x555BAd9EC18dB19dED0057D2517242399d1c5D87".toLowerCase();
export const LP_KODIAK_IBERA_WBERA = "0x8dD1C3e5fB96ca0E45Fe3c3CC521Ad44e12F3e47".toLowerCase();

// Token definitions
export const ERC20_TOKENS_BERACHAIN = new Map<string, TokenDefinition>();
ERC20_TOKENS_BERACHAIN.set(ERC20_IBERA, new TokenDefinition(ERC20_IBERA, TokenCategoryVolatile, false, false)); // Illiquid
ERC20_TOKENS_BERACHAIN.set(ERC20_STARGATE_USDC, new TokenDefinition(ERC20_STARGATE_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_BERACHAIN.set(ERC20_HONEY, new TokenDefinition(ERC20_HONEY, TokenCategoryStable, true, false));
ERC20_TOKENS_BERACHAIN.set(ERC20_WBERA, new TokenDefinition(ERC20_WBERA, TokenCategoryVolatile, true, true));
ERC20_TOKENS_BERACHAIN.set(NATIVE_BERA, new TokenDefinition(NATIVE_BERA, TokenCategoryVolatile, true, true));
ERC20_TOKENS_BERACHAIN.set(LP_KODIAK_OHM_HONEY, new TokenDefinition(LP_KODIAK_OHM_HONEY, TokenCategoryPOL, true, false));
ERC20_TOKENS_BERACHAIN.set(LP_BERADROME_KODIAK_OHM_HONEY, new TokenDefinition(LP_BERADROME_KODIAK_OHM_HONEY, TokenCategoryPOL, true, false));

export const OHM_TOKENS = [ERC20_OHM];

export const TRSRY = "0xb1fA0Ac44d399b778B14af0AAF4bCF8af3437ad1".toLowerCase();
export const DAO_MULTISIG = "0x91494D1BC2286343D51c55E46AE80C9356D099b5".toLowerCase();
export const DAO_OPS_MULTISIG = "0xe22b2d431838528BcaD52d11C4744EfCdc907a1c".toLowerCase();
export const THJ_CUSTODIAN = "0x082689241b09c600b3eaf3812b1d09791e7ded5a".toLowerCase();
export const INFRARED_CUSTODIAN = "0xb65e74f6b2c0633e30ba1be75db818bb9522a81a".toLowerCase();

// Kodiak
export const UNISWAP_V3_POSITION_MANAGER = "0xFE5E8C83FFE4d9627A75EaA7Fee864768dB989bD".toLowerCase();
export const BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT = "0x017B4DD27782E2FE3421e71F33ce54801aF696F8".toLowerCase();

export const PROTOCOL_ADDRESSES = [
    DAO_MULTISIG,
    TRSRY,
    DAO_OPS_MULTISIG,
    THJ_CUSTODIAN,
    INFRARED_CUSTODIAN
];

const TREASURY_BLACKLIST = new Map<string, string[]>();
TREASURY_BLACKLIST.set(ERC20_OHM, [DAO_MULTISIG, DAO_OPS_MULTISIG, TRSRY]);

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
CONTRACT_NAME_MAP.set(DAO_MULTISIG, "DAO MS (Berachain)");
CONTRACT_NAME_MAP.set(DAO_OPS_MULTISIG, "DAO Operations MS (Berachain)");
CONTRACT_NAME_MAP.set(ERC20_OHM, "OHM");
CONTRACT_NAME_MAP.set(ERC20_IBERA, "Infrared BERA");
CONTRACT_NAME_MAP.set(ERC20_STARGATE_USDC, "Bridged USDC (Stargate)");
CONTRACT_NAME_MAP.set(ERC20_HONEY, "Honey");
CONTRACT_NAME_MAP.set(ERC20_WBERA, "Wrapped BERA");
CONTRACT_NAME_MAP.set(NATIVE_BERA, "BERA");
CONTRACT_NAME_MAP.set(LP_KODIAK_OHM_HONEY, "Kodiak OHM-HONEY LP");
CONTRACT_NAME_MAP.set(LP_BERADROME_KODIAK_OHM_HONEY, "Beradrome Kodiak OHM-HONEY LP");
CONTRACT_NAME_MAP.set(TRSRY, "TRSRY Module");
CONTRACT_NAME_MAP.set(THJ_CUSTODIAN, "THJ Custodian");
CONTRACT_NAME_MAP.set(INFRARED_CUSTODIAN, "Infrared Custodian");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_IBERA, "iBERA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_STARGATE_USDC, "USDC.e");
CONTRACT_ABBREVIATION_MAP.set(ERC20_WBERA, "wBERA");
CONTRACT_ABBREVIATION_MAP.set(NATIVE_BERA, "BERA");
