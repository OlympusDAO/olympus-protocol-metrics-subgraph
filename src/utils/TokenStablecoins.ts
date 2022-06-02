import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import {
  AAVE_ALLOCATOR,
  AAVE_ALLOCATOR_V2,
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
  getERC20Balance,
  getERC20TokenRecordsFromWallets,
  getLiquityStabilityPoolRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import { TokenRecord, TokenRecords } from "./TokenRecord";

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
 * Calculates the balance of DAI across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getDaiBalance(blockNumber: BigInt): TokenRecords {
  const daiERC20 = getERC20("DAI", ERC20_DAI, blockNumber);
  const aDaiERC20 = getERC20("aDAI", ERC20_ADAI, blockNumber);
  const records = getERC20TokenRecordsFromWallets(
    "DAI",
    daiERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  if (aDaiERC20) {
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(AAVE_ALLOCATOR),
        AAVE_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(aDaiERC20, AAVE_ALLOCATOR, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(AAVE_ALLOCATOR_V2),
        AAVE_ALLOCATOR_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(aDaiERC20, AAVE_ALLOCATOR_V2, blockNumber), 18),
      ),
    );
  }

  records.combine(getRariAllocatorRecords(ERC20_DAI, BigDecimal.fromString("1"), blockNumber));

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
  const feiERC20 = getERC20("FEI", ERC20_FEI, blockNumber);

  return getERC20TokenRecordsFromWallets("FEI", feiERC20, BigDecimal.fromString("1"), blockNumber);
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
  const fraxERC20 = getERC20("FRAX", ERC20_FRAX, blockNumber);

  const records = getERC20TokenRecordsFromWallets(
    "FRAX",
    fraxERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  records.combine(getConvexAllocatorRecords(ERC20_FRAX, blockNumber));

  return records;
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
  const lusdERC20 = getERC20("LUSD", ERC20_LUSD, blockNumber);
  const records = getERC20TokenRecordsFromWallets(
    "LUSD",
    lusdERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  records.combine(getLiquityStabilityPoolRecords(ERC20_LUSD, blockNumber));

  return records;
}

/**
 * Returns the balance of UST tokens in the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getUSTBalance(blockNumber: BigInt): TokenRecords {
  const ustERC20 = getERC20("UST", ERC20_UST, blockNumber);

  return getERC20TokenRecordsFromWallets("UST", ustERC20, BigDecimal.fromString("1"), blockNumber);
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
