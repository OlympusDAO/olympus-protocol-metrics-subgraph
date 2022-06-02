import { BigInt } from "@graphprotocol/graph-ts";

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
  getConvexAllocatorRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getLiquityStabilityPoolRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
} from "./ContractHelper";
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import { TokenRecords } from "./TokenRecord";

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
  const records = new TokenRecords();
  const contractName = getContractName(contractAddress);
  const contract = getERC20(contractName, contractAddress, blockNumber);
  const rate = getUSDRate(contractAddress);

  // Wallets
  records.combine(getERC20TokenRecordsFromWallets(contractName, contract, rate, blockNumber));

  // Rari Allocator
  records.combine(getRariAllocatorRecords(contractAddress, rate, blockNumber));

  // Convex Allocator
  records.combine(getConvexAllocatorRecords(contractAddress, blockNumber));

  // Liquity Stability Pool
  records.combine(getLiquityStabilityPoolRecords(contractAddress, blockNumber));

  // Onsen Allocator
  records.combine(getOnsenAllocatorRecords(contractAddress, rate, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    records.combine(getLiquidityBalances(contractAddress, riskFree, blockNumber));
  }

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
  const records = new TokenRecords();

  for (let i = 0; i < ERC20_STABLE_TOKENS.length; i++) {
    records.combine(
      getStablecoinBalance(ERC20_STABLE_TOKENS[i], includeLiquidity, riskFree, blockNumber),
    );
  }

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
  const records = new TokenRecords();

  records.combine(getStablecoinBalance(ERC20_DAI, false, false, blockNumber));
  records.combine(getStablecoinBalance(ERC20_ADAI, false, false, blockNumber));

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
  const records = new TokenRecords();

  records.combine(getStablecoinBalance(ERC20_DAI, true, riskFree, blockNumber));
  records.combine(getStablecoinBalance(ERC20_ADAI, true, riskFree, blockNumber));

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

// TODO add USDC
