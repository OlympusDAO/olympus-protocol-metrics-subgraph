import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { pushArray } from "./ArrayHelper";
import {
  ERC20_ADAI,
  ERC20_DAI,
  ERC20_FEI,
  ERC20_FRAX,
  ERC20_LUSD,
  ERC20_UST,
  getContractName,
  getTokensInCategory,
} from "./Constants";
import {
  getConvexStakedRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getLiquityStabilityPoolRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
  getVeFXSAllocatorRecords,
} from "./ContractHelper";
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import { TokenCategoryStable } from "./TokenDefinition";

/**
 * Returns the token records for a given stablecoin. This includes:
 * - Wallets
 * - Allocators
 * - Liquidity pools
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecordsWrapper object
 */
export function getStablecoinBalance(
  timestamp: BigInt,
  contractAddress: string,
  includeLiquidity: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokeValue: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  const contractName = getContractName(contractAddress);
  log.info(
    "getStablecoinBalance: Calculating stablecoin balance for {} ({}) at block number {}: liquidity? {}, risk-free? {}, exclude OHM value? {}, restrictToTokenValue? {}",
    [
      contractName,
      contractAddress,
      blockNumber.toString(),
      includeLiquidity ? "true" : "false",
      riskFree ? "true" : "false",
      excludeOhmValue ? "true" : "false",
      restrictToTokeValue ? "true" : "false",
    ],
  );
  const records: TokenRecord[] = [];
  const contract = getERC20(contractAddress, blockNumber);
  if (!contract) {
    log.info("getStablecoinBalance: Skipping ERC20 contract {} that returned empty at block {}", [
      getContractName(contractAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  const rate = getUSDRate(contractAddress, blockNumber);

  // Wallets
  pushArray(
    records,
    getERC20TokenRecordsFromWallets(timestamp, contractAddress, contract, rate, blockNumber),
  );

  // Rari Allocator
  pushArray(records, getRariAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // Staked Convex tokens
  pushArray(records, getConvexStakedRecords(timestamp, contractAddress, blockNumber));

  // Liquity Stability Pool
  pushArray(records, getLiquityStabilityPoolRecords(timestamp, contractAddress, rate, blockNumber));

  // Onsen Allocator
  pushArray(records, getOnsenAllocatorRecords(timestamp, contractAddress, rate, blockNumber));

  // VeFXS Allocator
  pushArray(records, getVeFXSAllocatorRecords(timestamp, contractAddress, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    pushArray(
      records,
      getLiquidityBalances(
        timestamp,
        contractAddress,
        riskFree,
        excludeOhmValue,
        restrictToTokeValue,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Gets the balances for all stablecoins, using {getStablecoinBalance}.
 *
 * @param blockNumber the current block
 * @returns TokenRecordsWrapper object
 */
export function getStablecoinBalances(
  timestamp: BigInt,
  includeLiquidity: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info(
    "getStablecoinBalances: Calculating stablecoin value. Liquidity? {}. Risk-Free Value? {}.",
    [includeLiquidity ? "true" : "false", riskFree ? "true" : "false"],
  );
  const records: TokenRecord[] = [];

  const stableTokens = getTokensInCategory(TokenCategoryStable);
  for (let i = 0; i < stableTokens.length; i++) {
    pushArray(
      records,
      getStablecoinBalance(
        timestamp,
        stableTokens[i].getAddress(),
        includeLiquidity,
        riskFree,
        excludeOhmValue,
        restrictToTokenValue,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of DAI/aDAI across the following:
 * - all wallets, using {getERC20TokenRecordsWrapperFromWallets}.
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getDaiBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  pushArray(
    records,
    getStablecoinBalance(metricName, ERC20_DAI, false, false, false, false, blockNumber),
  );
  pushArray(
    records,
    getStablecoinBalance(metricName, ERC20_ADAI, false, false, false, false, blockNumber),
  );

  return records;
}

/**
 * Calculates the balance of FEI across the following:
 * - all wallets, using {getERC20TokenRecordsWrapperFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getFeiBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_FEI, false, false, false, false, blockNumber);
}

/**
 * Calculates the balance of FRAX across the following:
 * - all wallets, using {getERC20TokenRecordsWrapperFromWallets}.
 * - Convex allocators
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getFraxBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_FRAX, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of LUSD tokens in the following:
 * - all wallets, using {getERC20TokenRecordsWrapperFromWallets}.
 * - LUSD allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getLUSDBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_LUSD, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of UST tokens in the following:
 * - all wallets, using {getERC20TokenRecordsWrapperFromWallets}.
 *
 * NOTE: this is currently set to 0, due to issues with the price of UST.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getUSTBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_UST, false, false, false, false, blockNumber);
}

/**
 * Returns the value of USD-pegged stablecoins, excluding any liquidity pools.
 *
 * This currently (incorrectly) assumes that the value of each stablecoin is $1.
 *
 * @param date
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper representing the components of the stablecoin value
 */
export function getStableValue(date: string, blockNumber: BigInt): TokenRecord[] {
  return getStablecoinBalances(date, false, false, false, false, blockNumber);
}

/**
 * Returns the DAI/aDAI market value, which is defined as:
 * - DAI balance
 * - DAI in liquidity pairs
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecordsWrapper representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getDaiMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecord[] {
  log.info("getDaiMarketValue: Calculating DAI market value", []);
  const records: TokenRecord[] = [];

  pushArray(
    records,
    getStablecoinBalance(metricName, ERC20_DAI, true, riskFree, false, true, blockNumber),
  );
  pushArray(
    records,
    getStablecoinBalance(metricName, ERC20_ADAI, true, riskFree, false, true, blockNumber),
  );

  return records;
}

/**
 * Returns the FRAX market value, which is defined as:
 * - Balance of FRAX
 * - FRAX in liquidity pairs
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecordsWrapper representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFraxMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_FRAX, true, riskFree, false, true, blockNumber);
}

/**
 * Returns the LUSD market value, which is defined as:
 * - Balance of LUSD
 * - LUSD in liquidity pairs
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecordsWrapper representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getLusdMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_LUSD, true, riskFree, false, true, blockNumber);
}

/**
 * Returns the FEI market value, which is defined as:
 * - Balance of FEI
 * - FEI in liquidity pairs
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecordsWrapper representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFeiMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecord[] {
  return getStablecoinBalance(metricName, ERC20_FEI, true, riskFree, false, true, blockNumber);
}
