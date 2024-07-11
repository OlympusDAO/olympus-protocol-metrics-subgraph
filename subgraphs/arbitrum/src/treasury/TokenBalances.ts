import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { getERC20 } from "../../../shared/src/contracts/ERC20";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { getTokensInCategory } from "../../../shared/src/utils/TokenRecordHelper";
import { ERC20_LUSD, ERC20_TOKENS_ARBITRUM, LUSD_START_BLOCK } from "../contracts/Constants";
import { getContractName, getERC20TokenRecordsFromWallets } from "../contracts/Contracts";
import { getStakedBalances as getJonesStakedBalances } from "../contracts/JonesStaking";
import { getStakedBalances as getTreasureStakedBalances } from "../contracts/TreasureMining";
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

  // If the token is LUSD and the block number is less that the start block of the Chainlink feed, skip it
  if (contractAddress.toLowerCase() == ERC20_LUSD.toLowerCase()
    &&
    blockNumber.lt(BigInt.fromString(LUSD_START_BLOCK))) {
    log.info("getTokenBalance: Skipping {} token record at block {}", [getContractName(ERC20_LUSD), blockNumber.toString()]);
    return records;
  }

  const rate = getPrice(contractAddress, blockNumber);

  // Standard ERC20
  pushTokenRecordArray(
    records,
    getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
  );

  // Jones Staking
  pushTokenRecordArray(records, getJonesStakedBalances(timestamp, contractAddress, blockNumber));

  // TreasureDAO Staking
  pushTokenRecordArray(records, getTreasureStakedBalances(timestamp, contractAddress, blockNumber));

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

  const categoryTokens = getTokensInCategory(category, ERC20_TOKENS_ARBITRUM);
  for (let i = 0; i < categoryTokens.length; i++) {
    pushTokenRecordArray(records, getTokenBalance(timestamp, categoryTokens[i].getAddress(), blockNumber));
  }

  return records;
}
