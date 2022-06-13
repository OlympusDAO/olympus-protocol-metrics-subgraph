import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import {
  ERC20_CVX,
  ERC20_CVX_VL_V1,
  ERC20_FXS,
  ERC20_FXS_VE,
  ERC20_VOLATILE_BLUE_CHIP_TOKENS,
  ERC20_VOLATILE_ILLIQUID_TOKENS,
  ERC20_VOLATILE_TOKENS,
  ERC20_WBTC,
  ERC20_WETH,
  ERC20_XSUSHI,
  getContractName,
} from "./Constants";
import {
  getConvexStakedRecords,
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
import {
  combineTokenRecords,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";

/**
 * Returns the value of vesting assets in the treasury
 *
 * @returns TokenRecords
 */
export function getVestingAssets(blockNumber: BigInt): TokenRecords {
  // Cross chain assets that can not be tracked right now
  // pklima
  // butterfly
  // Vsta
  // PhantomDAO
  // Lobis
  // TODO remove hard-coded number
  const record = newTokenRecord(
    "Vesting Assets",
    "No source",
    "0x0",
    BigDecimal.fromString("1"),
    BigDecimal.fromString("32500000"),
    blockNumber,
  );
  const records = newTokenRecords("Vesting assets", blockNumber);
  pushTokenRecord(records, record);
  return records;
}

/**
 * Returns the token records for a given volatile token. This includes:
 * - Wallets
 * - Allocators
 * - Liquidity pools
 *
 * @param contractAddress the address of the ERC20 contract
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getVolatileTokenBalance(
  contractAddress: string,
  includeLiquidity: boolean,
  riskFree: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const contractName = getContractName(contractAddress);
  log.info("Calculating volatile token balance for {}", [contractName]);
  const records = newTokenRecords("Volatile token balance", blockNumber);
  const contract = getERC20(contractName, contractAddress, blockNumber);
  const rate = getUSDRate(contractAddress, blockNumber);

  // Wallets
  combineTokenRecords(
    records,
    getERC20TokenRecordsFromWallets(contractName, contract, rate, blockNumber),
  );

  // Rari Allocator
  combineTokenRecords(records, getRariAllocatorRecords(contractAddress, rate, blockNumber));

  // FRAX Convex Allocator
  combineTokenRecords(records, getFraxConvexAllocatorRecords(contractAddress, blockNumber));

  // Staked Convex tokens
  combineTokenRecords(records, getConvexStakedRecords(contractAddress, blockNumber));

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

  log.info("Volatile token value: {}", [records.value.toString()]);
  return records;
}

/**
 * Gets the balances for all volatile tokens, using {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getVolatileTokenBalances(
  liquidOnly: boolean,
  includeLiquidity: boolean,
  includeBlueChip: boolean,
  riskFree: boolean,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating volatile token value", []);
  const records = newTokenRecords("Volatile token balances", blockNumber);

  for (let i = 0; i < ERC20_VOLATILE_TOKENS.length; i++) {
    const currentTokenAddress = ERC20_VOLATILE_TOKENS[i];
    if (liquidOnly && ERC20_VOLATILE_ILLIQUID_TOKENS.includes(currentTokenAddress)) {
      log.debug("liquidOnly is true, so skipping illiquid asset: {}", [currentTokenAddress]);
      continue;
    }

    if (!includeBlueChip && ERC20_VOLATILE_BLUE_CHIP_TOKENS.includes(currentTokenAddress)) {
      log.debug("includeBlueChip is false, so skipping blue chip asset: {}", [currentTokenAddress]);
      continue;
    }

    combineTokenRecords(
      records,
      getVolatileTokenBalance(currentTokenAddress, includeLiquidity, riskFree, blockNumber),
    );
  }

  // We add vesting assets manually for now
  if (!liquidOnly) {
    combineTokenRecords(records, getVestingAssets(blockNumber));
  }

  log.info("Volatile token value: {}", [records.value.toString()]);
  return records;
}

/**
 * Returns the balance of xSUSHI tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getXSushiBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_XSUSHI, false, false, blockNumber);
}

/**
 * Returns the balance of CVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_CVX, false, false, blockNumber);
}

/**
 * Returns the balance of vlCVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVlCVXBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_CVX_VL_V1, false, false, blockNumber);
}

/**
 * Returns the balance of CVX tokens:
 * - CVX
 * - vlCVX
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXTotalBalance(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("CVX total balance", blockNumber);

  combineTokenRecords(records, getCVXBalance(blockNumber));
  combineTokenRecords(records, getVlCVXBalance(blockNumber));

  return records;
}

/**
 * Returns the balance of FXS tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
function getFXSBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_FXS, false, false, blockNumber);
}

/**
 * Returns the balance of veFXS tokens in the following:
 * - FXS allocator
 *
 * @param veFXS VeFXS contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVeFXSBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_FXS_VE, false, false, blockNumber);
}

/**
 * Returns the balance of FXS tokens:
 * - FXS
 * - veFXS
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFXSTotalBalance(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("FXS total balance", blockNumber);

  combineTokenRecords(records, getFXSBalance(blockNumber));
  combineTokenRecords(records, getVeFXSBalance(blockNumber));

  return records;
}

/**
 * Calculates the balance of wETH from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWETHBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_WETH, false, false, blockNumber);
}

/**
 * Calculates the balance of wBTC from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWBTCBalance(blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(ERC20_WBTC, false, false, blockNumber);
}

/**
 * Returns the value of all volatile assets and liquidity, except those in {ERC20_VOLATILE_BLUE_CHIP_TOKENS}.
 *
 * If `liquidOnly` is specified, then the following are excluded as they are locked:
 * - Vesting assets
 * - Any token in {ERC20_VOLATILE_ILLIQUID_TOKENS}
 *
 * @param liquidOnly if true, skips illiquid assets
 * @param includeBlueChip if true, includes blue chip assets ({ERC20_VOLATILE_BLUE_CHIP_TOKENS})
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVolatileValue(
  blockNumber: BigInt,
  liquidOnly: boolean,
  includeBlueChip: boolean,
): TokenRecords {
  return getVolatileTokenBalances(liquidOnly, true, includeBlueChip, false, blockNumber);
}

/**
 * Returns the ETH market value, which is defined as:
 * - Balance of ETH
 * - Value of OHM-ETH pair
 * - Value of OHM-ETH pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getEthMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  return getVolatileTokenBalance(ERC20_WETH, true, riskFree, blockNumber);
}

// TODO add CRV
// TODO add FPIS
// TODO add ALCX
// TODO add BCT
// TODO add KLIMA/sKLIMA
