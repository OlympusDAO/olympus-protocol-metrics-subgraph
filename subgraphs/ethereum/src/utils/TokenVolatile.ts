import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { TokenCategoryVolatile } from "../../../shared/src/contracts/TokenDefinition";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { getTokensInCategory } from "../../../shared/src/utils/TokenRecordHelper";
import { getLiquidityBalances } from "../liquidity/LiquidityCalculations";
import { ERC20_AURA, ERC20_FXS_VE, ERC20_LQTY, ERC20_TOKE, ERC20_TOKENS, getContractName } from "./Constants";
import {
  getAuraLockedBalancesFromWallets,
  getAuraPoolEarnedRecords,
  getAuraStakedBalancesFromWallets,
  getBtrflyUnlockedBalancesFromWallets,
  getConvexStakedRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getLiquityStabilityPoolRecords,
  getLiquityStakedBalancesFromWallets,
  getMysoFinanceRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
  getTokeAllocatorRecords,
  getTokeStakedBalancesFromWallets,
  getVeFXSAllocatorRecords,
  getVendorFinanceRecords,
  getVlCvxUnlockedRecords,
} from "./ContractHelper";
import { getUSDRate } from "./Price";

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
    pushTokenRecordArray(
      records,
      getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
    );
  }

  // Rari Allocator
  pushTokenRecordArray(records, getRariAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // Toke Allocator
  pushTokenRecordArray(records, getTokeAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // Staked TOKE
  if (contractAddress.toLowerCase() == ERC20_TOKE.toLowerCase()) {
    pushTokenRecordArray(
      records,
      getTokeStakedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber),
    );
  }

  // Staked LQTY
  if (contractAddress.toLowerCase() == ERC20_LQTY.toLowerCase()) {
    pushTokenRecordArray(
      records,
      getLiquityStakedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber),
    );
  }

  // Locked AURA
  if (contractAddress.toLowerCase() == ERC20_AURA.toLowerCase()) {
    pushTokenRecordArray(
      records,
      getAuraLockedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber),
    );
  }

  // Tokens staked in Aura
  pushTokenRecordArray(records, getAuraStakedBalancesFromWallets(timestamp, contractAddress, rate, BigDecimal.fromString("1"), blockNumber));

  // Unlocked rlBTRFLY
  pushTokenRecordArray(records, getBtrflyUnlockedBalancesFromWallets(timestamp, contractAddress, rate, blockNumber));

  // Aura earned rewards
  pushTokenRecordArray(records, getAuraPoolEarnedRecords(timestamp, contractAddress, rate, blockNumber));

  // Staked Convex tokens
  pushTokenRecordArray(records, getConvexStakedRecords(timestamp, contractAddress, blockNumber));

  // Liquity Stability Pool
  pushTokenRecordArray(records, getLiquityStabilityPoolRecords(timestamp, contractAddress, rate, blockNumber));

  // Onsen Allocator
  pushTokenRecordArray(records, getOnsenAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // VeFXS Allocator
  pushTokenRecordArray(records, getVeFXSAllocatorRecords(timestamp, contractAddress, blockNumber));

  // Unlocked (but not withdrawn) vlCVX
  pushTokenRecordArray(records, getVlCvxUnlockedRecords(timestamp, contractAddress, rate, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    pushTokenRecordArray(records, getLiquidityBalances(timestamp, contractAddress, blockNumber));
  }

  // Myso Finance
  pushTokenRecordArray(records, getMysoFinanceRecords(timestamp, contractAddress, rate, blockNumber));

  // Vendor Finance
  pushTokenRecordArray(records, getVendorFinanceRecords(timestamp, contractAddress, rate, blockNumber));

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

    pushTokenRecordArray(
      records,
      getVolatileTokenBalance(timestamp, currentTokenAddress, includeLiquidity, blockNumber),
    );
  }

  return records;
}
