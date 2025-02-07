import { log } from "@graphprotocol/graph-ts";

import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";

export const BLOCKCHAIN = "Berachain";

// TODO add iBERA
// TODO add fatBERA

// Tokens
export const ERC20_OHM = "0x18878Df23e2a36f81e820e4b47b4A40576D3159C".toLowerCase();
export const ERC20_IBERA = "0x9b6761bf2397Bb5a6624a856cC84A3A14Dcd3fe5".toLowerCase();
export const ERC20_STARGATE_USDC = "0x549943e04f40284185054145c6E4e9568C1D3241".toLowerCase();
export const ERC20_HONEY = "0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce".toLowerCase();
export const ERC20_WBERA = "0x6969696969696969696969696969696969696969".toLowerCase();

// LP tokens
export const LP_UNISWAP_V3_WBERA_HONEY = "0x1127f801cb3ab7bdf8923272949aa7dba94b5805".toLowerCase();
// TODO add LP tokens

// Token definitions
export const ERC20_TOKENS_BERACHAIN = new Map<string, TokenDefinition>();
// ERC20_TOKENS_BERACHAIN.set(ERC20_IBERA, new TokenDefinition(ERC20_IBERA, TokenCategoryVolatile, true, false));
ERC20_TOKENS_BERACHAIN.set(ERC20_STARGATE_USDC, new TokenDefinition(ERC20_STARGATE_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_BERACHAIN.set(ERC20_HONEY, new TokenDefinition(ERC20_HONEY, TokenCategoryStable, true, false));
ERC20_TOKENS_BERACHAIN.set(LP_UNISWAP_V3_WBERA_HONEY, new TokenDefinition(LP_UNISWAP_V3_WBERA_HONEY, TokenCategoryPOL, true, false));
// TODO add LP token definitions

export const OHM_TOKENS = [ERC20_OHM];

export const DAO_MULTISIG = "0x91494D1BC2286343D51c55E46AE80C9356D099b5".toLowerCase();

// Kodiak
export const UNISWAP_V3_POSITION_MANAGER = "0xFE5E8C83FFE4d9627A75EaA7Fee864768dB989bD".toLowerCase();

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
CONTRACT_NAME_MAP.set(DAO_MULTISIG, "DAO MS (Berachain)");
CONTRACT_NAME_MAP.set(ERC20_OHM, "OHM");
CONTRACT_NAME_MAP.set(ERC20_IBERA, "Infrared BERA");
CONTRACT_NAME_MAP.set(ERC20_STARGATE_USDC, "Bridged USDC (Stargate)");
CONTRACT_NAME_MAP.set(ERC20_HONEY, "Honey");
CONTRACT_NAME_MAP.set(ERC20_WBERA, "Wrapped BERA");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_OHM, "OHM");
CONTRACT_ABBREVIATION_MAP.set(ERC20_IBERA, "iBERA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_STARGATE_USDC, "USDC.e");
CONTRACT_ABBREVIATION_MAP.set(ERC20_WBERA, "wBERA");
