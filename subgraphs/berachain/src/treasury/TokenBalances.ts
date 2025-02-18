import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { getERC20 } from "../../../shared/src/contracts/ERC20";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { getNativeTokenBalances } from "../../../shared/src/utils/TokenNative";
import { getTokensInCategory } from "../../../shared/src/utils/TokenRecordHelper";
import { BLOCKCHAIN, ERC20_TOKENS_BERACHAIN, NATIVE_BERA } from "../contracts/Constants";
import { getContractName, getERC20TokenRecordsFromWallets } from "../contracts/Contracts";
import { getPrice } from "../price/PriceLookup";

/**
 * Returns the token records for a given token. This includes:
 * - Wallets
 * - Allocators
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
function getTokenBalance(
  timestamp: BigInt,
  contractAddress: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const contractName = getContractName(contractAddress);
  log.info("getTokenBalance: Calculating balance for {} ({}) at block number {}", [
    contractName,
    contractAddress,
    blockNumber.toString(),
  ]);
  const records: TokenRecord[] = [];
  const contract = getERC20(contractAddress, blockNumber);
  if (!contract) {
    log.info("getTokenBalance: Skipping ERC20 contract {} that returned empty at block {}", [
      getContractName(contractAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  const rate = getPrice(contractAddress, blockNumber);

  // Standard ERC20
  pushTokenRecordArray(
    records,
    getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
  );

  return records;
}

/**
 * Gets the balances for all tokens in the category, using {getTokenBalance}.
 *
 * @param timestamp
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getTokenBalances(
  timestamp: BigInt,
  category: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const categoryTokens = getTokensInCategory(category, ERC20_TOKENS_BERACHAIN);
  for (let i = 0; i < categoryTokens.length; i++) {
    const tokenAddress = categoryTokens[i].getAddress();

    if (tokenAddress.toLowerCase() == NATIVE_BERA.toLowerCase()) {
      pushTokenRecordArray(records, getNativeTokenBalances(timestamp, blockNumber, BLOCKCHAIN));
    } else {
      pushTokenRecordArray(records, getTokenBalance(timestamp, tokenAddress, blockNumber));
    }
  }

  return records;
}
