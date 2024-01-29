import { CROSS_CHAIN_FANTOM, DAO_WALLET } from "../../../shared/src/Wallets";

/**
 * The addresses relevant on Fantom.
 */
export const FANTOM_PROTOCOL_ADDRESSES: string[] = [
  CROSS_CHAIN_FANTOM, // Everything is contained in one wallet - no need to iterate over other addresses.
  DAO_WALLET, // Just in case there is a snapshot during a bridging action
];
