import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import {
  ERC20_ADAI,
  ERC20_DAI,
  ERC20_FEI,
  ERC20_FRAX,
  ERC20_LUSD,
  ERC20_STABLE_TOKENS,
  ERC20_UST,
  getContractName,
} from "./Constants";
import {
  getERC20,
  getERC20TokenRecordsFromWallets,
  getFraxConvexAllocatorRecords,
  getLiquityStabilityPoolRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
  getVeFXSAllocatorRecords,
} from "./ContractHelper";
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import { combineTokenRecords, newTokenRecords } from "./TokenRecordHelper";

/**
 * Returns the token records for a given stablecoin. This includes:
 * - Wallets
 * - Allocators
 * - Liquidity pools
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getStablecoinBalance(
  contractAddress: string,
  includeLiquidity: boolean,
  riskFree: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const contractName = getContractName(contractAddress);
  log.info("Calculating stablecoin balance for {}", [contractName]);
  const records = newTokenRecords("Stablecoins");
  const contract = getERC20(contractName, contractAddress, blockNumber);
  const rate = getUSDRate(contractAddress, blockNumber);

  // Wallets
  combineTokenRecords(
    records,
    getERC20TokenRecordsFromWallets(contractName, contract, rate, blockNumber),
  );

  // Rari Allocator
  combineTokenRecords(records, getRariAllocatorRecords(contractAddress, rate, blockNumber));

  // Convex Allocator
  combineTokenRecords(records, getFraxConvexAllocatorRecords(contractAddress, blockNumber));

  // Liquity Stability Pool
  combineTokenRecords(records, getLiquityStabilityPoolRecords(contractAddress, blockNumber));

  // Onsen Allocator
  combineTokenRecords(records, getOnsenAllocatorRecords(contractAddress, rate, blockNumber));

  // VeFXS Allocator
  combineTokenRecords(records, getVeFXSAllocatorRecords(contractAddress, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    // Single-sided, otherwise we're counting non-token value
    combineTokenRecords(
      records,
      getLiquidityBalances(contractAddress, riskFree, true, blockNumber),
    );
  }

  log.info("Stablecoin token value: {}", [records.value.toString()]);
  return records;
}

/**
 * Gets the balances for all stablecoins, using {getStablecoinBalance}.
 *
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getStablecoinBalances(
  includeLiquidity: boolean,
  riskFree: boolean,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating stablecoin value", []);
  const records = newTokenRecords("Stablecoin balances");

  for (let i = 0; i < ERC20_STABLE_TOKENS.length; i++) {
    combineTokenRecords(
      records,
      getStablecoinBalance(ERC20_STABLE_TOKENS[i], includeLiquidity, riskFree, blockNumber),
    );
  }

  log.info("Stablecoin value: {}", [records.value.toString()]);
  return records;
}

/**
 * Calculates the balance of DAI/aDAI across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getDaiBalance(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("DAI balance");

  combineTokenRecords(records, getStablecoinBalance(ERC20_DAI, false, false, blockNumber));
  combineTokenRecords(records, getStablecoinBalance(ERC20_ADAI, false, false, blockNumber));

  return records;
}

/**
 * Calculates the balance of FEI across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFeiBalance(blockNumber: BigInt): TokenRecords {
  return getStablecoinBalance(ERC20_FEI, false, false, blockNumber);
}

/**
 * Calculates the balance of FRAX across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Convex allocators
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFraxBalance(blockNumber: BigInt): TokenRecords {
  return getStablecoinBalance(ERC20_FRAX, false, false, blockNumber);
}

/**
 * Returns the balance of LUSD tokens in the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - LUSD allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getLUSDBalance(blockNumber: BigInt): TokenRecords {
  return getStablecoinBalance(ERC20_LUSD, false, false, blockNumber);
}

/**
 * Returns the balance of UST tokens in the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getUSTBalance(blockNumber: BigInt): TokenRecords {
  return getStablecoinBalance(ERC20_UST, false, false, blockNumber);
}

/**
 * Returns the value of USD-pegged stablecoins, excluding any liquidity pools.
 *
 * This currently (incorrectly) assumes that the value of each stablecoin is $1.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the stablecoin value
 */
export function getStableValue(blockNumber: BigInt): TokenRecords {
  return getStablecoinBalances(false, false, blockNumber);
}

/**
 * Returns the DAI/aDAI market value, which is defined as:
 * - Token balances
 * - Liquidity pairs
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getDaiMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  log.info("Calculating DAI market value", []);
  const records = newTokenRecords("DAI market value");

  combineTokenRecords(records, getStablecoinBalance(ERC20_DAI, true, riskFree, blockNumber));
  combineTokenRecords(records, getStablecoinBalance(ERC20_ADAI, true, riskFree, blockNumber));

  log.info("DAI market value: {}", [records.value.toString()]);
  return records;
}

/**
 * Returns the FRAX market value, which is defined as:
 * - Balance of FRAX
 * - Value of OHM-FRAX pair
 * - Value of OHM-FRAX pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFraxMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  return getStablecoinBalance(ERC20_FRAX, true, riskFree, blockNumber);
}

/**
 * Returns the LUSD market value, which is defined as:
 * - Balance of LUSD
 * - Value of OHM-LUSD pair
 * - Value of OHM-LUSD pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getLusdMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  return getStablecoinBalance(ERC20_LUSD, true, riskFree, blockNumber);
}

/**
 * Returns the FEI market value, which is defined as:
 * - Balance of FEI
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFeiMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  return getStablecoinBalance(ERC20_FEI, true, riskFree, blockNumber);
}
