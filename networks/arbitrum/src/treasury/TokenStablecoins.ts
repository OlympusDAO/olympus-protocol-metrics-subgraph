import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { getERC20 } from "../../../shared/src/contracts/ERC20";
import { TokenCategoryStable } from "../../../shared/src/contracts/TokenDefinition";
import { pushArray } from "../../../shared/src/utils/ArrayHelper";
import { getTokensInCategory } from "../../../shared/src/utils/TokenRecordHelper";
import { ERC20_TOKENS_ARBITRUM } from "../contracts/Constants";
import { getContractName, getERC20TokenRecordsFromWallets } from "../contracts/Contracts";
import { getPrice } from "../price/PriceLookup";

/**
 * Returns the token records for a given stablecoin. This includes:
 * - Wallets
 * - Allocators
 * - Liquidity pools
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getStablecoinBalance(
  timestamp: BigInt,
  contractAddress: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const contractName = getContractName(contractAddress);
  log.info("getStablecoinBalance: Calculating stablecoin balance for {} ({}) at block number {}", [
    contractName,
    contractAddress,
    blockNumber.toString(),
  ]);
  const records: TokenRecord[] = [];
  const contract = getERC20(contractAddress, blockNumber);
  if (!contract) {
    log.info("getStablecoinBalance: Skipping ERC20 contract {} that returned empty at block {}", [
      getContractName(contractAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  const rate = getPrice(contractAddress, blockNumber);

  // Wallets
  pushArray(
    records,
    getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
  );

  return records;
}

/**
 * Gets the balances for all stablecoins, using {getStablecoinBalance}.
 *
 * @param timestamp
 * @param includeLiquidity
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getStablecoinBalances(
  timestamp: BigInt,
  includeLiquidity: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info("getStablecoinBalances: Calculating stablecoin value. Liquidity? {}", [
    includeLiquidity ? "true" : "false",
  ]);
  const records: TokenRecord[] = [];

  const stableTokens = getTokensInCategory(TokenCategoryStable, ERC20_TOKENS_ARBITRUM);
  for (let i = 0; i < stableTokens.length; i++) {
    pushArray(records, getStablecoinBalance(timestamp, stableTokens[i].getAddress(), blockNumber));
  }

  return records;
}
