import { BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { pushArray } from "../../../shared/src/utils/ArrayHelper";
import { WALLET_ADDRESSES } from "../../../shared/src/Wallets";
import { TokenRecord } from "../../generated/schema";
import { getContractName } from "../contracts/Contracts";
import { HANDLERS } from "../price/PriceLookup";

/**
 * Returns the token records for a given token. This includes:
 * - Wallets
 * - Allocators
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
function getOwnedLiquidityBalance(
  timestamp: BigInt,
  liquidityHandler: PriceHandler,
  blockNumber: BigInt,
): TokenRecord[] {
  const contractName = getContractName(liquidityHandler.getId());
  log.info("getOwnedLiquidityBalance: Calculating balance for {} ({}) at block number {}", [
    contractName,
    liquidityHandler.getId(),
    blockNumber.toString(),
  ]);
  const records: TokenRecord[] = [];

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const currentWalletAddress = WALLET_ADDRESSES[i];

    // Get the balance

    // Get the unit rate

    // Create record
  }

  return records;
}

/**
 * Gets the balances for all tokens in the category, using {getTokenBalance}.
 *
 * @param timestamp
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getOwnedLiquidityBalances(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (let i = 0; i < HANDLERS.length; i++) {
    pushArray(records, getOwnedLiquidityBalance(timestamp, HANDLERS[i], blockNumber));
  }

  return records;
}
