import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../../common/generated/schema";
import { TokenCategoryVolatile } from "../../../../common/src/contracts/TokenDefinition";
import { pushArray } from "../../../../common/src/utils/ArrayHelper";
import { getTokensInCategory } from "../../../../common/src/utils/TokenRecordHelper";
import { getLiquidityBalances } from "../liquidity/LiquidityCalculations";
import { ERC20_FXS_VE, ERC20_TOKENS, getContractName } from "./Constants";
import {
  getConvexStakedRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getLiquityStabilityPoolRecords,
  getLiquityStakedBalancesFromWallets,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
  getTokeAllocatorRecords,
  getTokeStakedBalancesFromWallets,
  getVeFXSAllocatorRecords,
  getVlCvxUnlockedRecords,
} from "./ContractHelper";
import { getUSDRate } from "./Price";
import { getTreasuryRecords } from "./Treasury";

/**
 * Returns the token records for a given volatile token. This includes:
 * - Wallets
 * - Allocators
 * - Liquidity pools
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getVolatileTokenBalance(
  timestamp: BigInt,
  contractAddress: string,
  includeLiquidity: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  const contractName = getContractName(contractAddress);
  log.info("Calculating volatile token balance for {} ({}) at block number {}: liquidity? {}", [
    contractName,
    contractAddress,
    blockNumber.toString(),
    includeLiquidity ? "true" : "false",
  ]);

  const records: TokenRecord[] = [];

  const contract = getERC20(contractAddress, blockNumber);
  if (!contract) {
    log.info(
      "getVolatileTokenBalance: Skipping ERC20 contract {} that returned empty at block {}",
      [getContractName(contractAddress), blockNumber.toString()],
    );
    return records;
  }

  const rate = getUSDRate(contractAddress, blockNumber);

  // Wallets
  // veFXS returns a value through {getVeFXSAllocatorRecords} using locked(), and the balanceOf() function returns the boosted voting power, so we manually skip that
  if ([ERC20_FXS_VE].includes(contractAddress.toLowerCase())) {
    log.warning(
      "getVolatileTokenBalance: skipping ERC20 balance for token contract {} ({}) that is on ignore list",
      [getContractName(contractAddress), contractAddress],
    );
  } else {
    pushArray(
      records,
      getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
    );
  }

  // Rari Allocator
  pushArray(records, getRariAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // Toke Allocator
  pushArray(records, getTokeAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // Staked TOKE
  pushArray(
    records,
    getTokeStakedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber),
  );

  // Staked LQTY
  pushArray(
    records,
    getLiquityStakedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber),
  );

  // Staked Convex tokens
  pushArray(records, getConvexStakedRecords(timestamp, contractAddress, blockNumber));

  // Liquity Stability Pool
  pushArray(records, getLiquityStabilityPoolRecords(timestamp, contractAddress, rate, blockNumber));

  // Onsen Allocator
  pushArray(records, getOnsenAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // VeFXS Allocator
  pushArray(records, getVeFXSAllocatorRecords(timestamp, contractAddress, blockNumber));

  // Unlocked (but not withdrawn) vlCVX
  pushArray(records, getVlCvxUnlockedRecords(timestamp, contractAddress, rate, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    pushArray(records, getLiquidityBalances(timestamp, contractAddress, blockNumber));
  }

  // TRSRY
  pushArray(records, getTreasuryRecords(timestamp, contractAddress, rate, blockNumber));

  return records;
}

/**
 * Gets the balances for all volatile tokens, using {getVolatileTokenBalance}.
 *
 * @param timestamp
 * @param liquidOnly If true, exclude illiquid assets.
 * @param includeLiquidity If true, includes volatile assets in protocol-owned liquidity
 * @param includeBlueChip If true, includes blue-chip assets (wETH and wBTC)
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getVolatileTokenBalances(
  timestamp: BigInt,
  liquidOnly: boolean,
  includeLiquidity: boolean,
  includeBlueChip: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info("Calculating volatile token value", []);
  const records: TokenRecord[] = [];

  const volatileTokens = getTokensInCategory(TokenCategoryVolatile, ERC20_TOKENS);

  for (let i = 0; i < volatileTokens.length; i++) {
    const currentToken = volatileTokens[i];
    const currentTokenAddress = currentToken.getAddress();
    if (liquidOnly && !currentToken.getIsLiquid()) {
      log.debug("liquidOnly is true, so skipping illiquid asset: {}", [currentTokenAddress]);
      continue;
    }

    if (!includeBlueChip && currentToken.getIsVolatileBluechip()) {
      log.debug("includeBlueChip is false, so skipping blue chip asset: {}", [currentTokenAddress]);
      continue;
    }

    pushArray(
      records,
      getVolatileTokenBalance(timestamp, currentTokenAddress, includeLiquidity, blockNumber),
    );
  }

  return records;
}
