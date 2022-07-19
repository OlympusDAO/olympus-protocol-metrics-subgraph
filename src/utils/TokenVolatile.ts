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
  getLiquityStabilityPoolRecords,
  getOnsenAllocatorRecords,
  getRariAllocatorRecords,
  getTokeAllocatorRecords,
  getTokeStakedBalancesFromWallets,
  getVeFXSAllocatorRecords,
} from "./ContractHelper";
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import {
  addToMetricName,
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
export function getVestingAssets(metricName: string, blockNumber: BigInt): TokenRecords {
  // Cross chain assets that can not be tracked right now
  // pklima
  // butterfly
  // Vsta
  // PhantomDAO
  // Lobis
  // TODO remove hard-coded number
  const record = newTokenRecord(
    metricName,
    "Vesting Assets",
    "N/A",
    "No source",
    "0x0",
    BigDecimal.fromString("1"),
    BigDecimal.fromString("32500000"),
    blockNumber,
  );
  const records = newTokenRecords(addToMetricName(metricName, "VestingAssets"), blockNumber);
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
  metricName: string,
  contractAddress: string,
  includeLiquidity: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  // TODO consider changing function signature, as excludeOhmValue and restrictToTokenValue are relevant only if includeLiquidity = true
  const contractName = getContractName(contractAddress);
  log.info(
    "Calculating volatile token balance for {} ({}) at block number {}: liquidity? {}, risk-free? {}, exclude OHM value? {}, restrictToTokenValue? {}",
    [
      contractName,
      contractAddress,
      blockNumber.toString(),
      includeLiquidity ? "true" : "false",
      riskFree ? "true" : "false",
      excludeOhmValue ? "true" : "false",
      restrictToTokenValue ? "true" : "false",
    ],
  );
  const records = newTokenRecords(
    addToMetricName(metricName, "VolatileTokenBalance-" + contractName),
    blockNumber,
  );
  const contract = getERC20(contractName, contractAddress, blockNumber);
  if (!contract) {
    log.info("Skipping ERC20 contract {} that returned empty at block {}", [
      getContractName(contractAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  const rate = getUSDRate(contractAddress, blockNumber);

  // Wallets
  combineTokenRecords(
    records,
    getERC20TokenRecordsFromWallets(metricName, contractAddress, contract, rate, blockNumber),
  );

  // Rari Allocator
  combineTokenRecords(
    records,
    getRariAllocatorRecords(metricName, contractAddress, rate, blockNumber),
  );

  // Toke Allocator
  combineTokenRecords(
    records,
    getTokeAllocatorRecords(metricName, contractAddress, rate, blockNumber),
  );

  // Staked TOKE
  combineTokenRecords(
    records,
    getTokeStakedBalancesFromWallets(metricName, contractAddress, rate, blockNumber),
  );

  // Staked Convex tokens
  combineTokenRecords(records, getConvexStakedRecords(metricName, contractAddress, blockNumber));

  // Liquity Stability Pool
  combineTokenRecords(
    records,
    getLiquityStabilityPoolRecords(metricName, contractAddress, rate, blockNumber),
  );

  // Onsen Allocator
  combineTokenRecords(
    records,
    getOnsenAllocatorRecords(metricName, contractAddress, rate, blockNumber),
  );

  // VeFXS Allocator
  combineTokenRecords(records, getVeFXSAllocatorRecords(metricName, contractAddress, blockNumber));

  // Liquidity pools
  if (includeLiquidity) {
    combineTokenRecords(
      records,
      getLiquidityBalances(
        metricName,
        contractAddress,
        riskFree,
        excludeOhmValue,
        restrictToTokenValue,
        blockNumber,
      ),
    );
  }

  log.info("Volatile token value: {}", [records.value.toString()]);
  return records;
}

/**
 * Gets the balances for all volatile tokens, using {getVolatileTokenBalance}.
 *
 * @param metricName
 * @param liquidOnly If true, exclude illiquid assets. This is currently limited to vesting assets.
 * @param includeLiquidity If true, includes volatile assets in protocol-owned liquidity
 * @param includeBlueChip If true, includes blue-chip assets (wETH and wBTC)
 * @param riskFree If true, returns the risk-free value of liquidity pools
 * @param excludeOhmValue If true, the value of liquidity pools is returned without the value of OHM. This is used to calculate backing.
 * @param restrictToTokenValue If true, the value of liquidity pools is restricted to a specific token. This is used to calculate the value of specific assets.
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getVolatileTokenBalances(
  metricName: string,
  liquidOnly: boolean,
  includeLiquidity: boolean,
  includeBlueChip: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating volatile token value", []);
  const records = newTokenRecords(
    addToMetricName(metricName, "VolatileTokenBalances"),
    blockNumber,
  );

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
      getVolatileTokenBalance(
        metricName,
        currentTokenAddress,
        includeLiquidity,
        riskFree,
        excludeOhmValue,
        restrictToTokenValue,
        blockNumber,
      ),
    );
  }

  // We add vesting assets manually for now
  if (!liquidOnly) {
    combineTokenRecords(records, getVestingAssets(metricName, blockNumber));
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
export function getXSushiBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_XSUSHI, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of CVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_CVX, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of vlCVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVlCVXBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(
    metricName,
    ERC20_CVX_VL_V1,
    false,
    false,
    false,
    false,
    blockNumber,
  );
}

/**
 * Returns the balance of CVX tokens:
 * - CVX
 * - vlCVX
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXTotalBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "CVXTotalBalance"), blockNumber);

  combineTokenRecords(records, getCVXBalance(metricName, blockNumber));
  combineTokenRecords(records, getVlCVXBalance(metricName, blockNumber));

  return records;
}

/**
 * Returns the balance of FXS tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
function getFXSBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_FXS, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of veFXS tokens in the following:
 * - FXS allocator
 *
 * @param veFXS VeFXS contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVeFXSBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_FXS_VE, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of FXS tokens:
 * - FXS
 * - veFXS
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFXSTotalBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "FXSTotalBalance"), blockNumber);

  combineTokenRecords(records, getFXSBalance(metricName, blockNumber));
  combineTokenRecords(records, getVeFXSBalance(metricName, blockNumber));

  return records;
}

/**
 * Calculates the balance of wETH from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWETHBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_WETH, false, false, false, false, blockNumber);
}

/**
 * Calculates the balance of wBTC from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWBTCBalance(metricName: string, blockNumber: BigInt): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_WBTC, false, false, false, false, blockNumber);
}

/**
 * Returns the value of all volatile assets, except those in {ERC20_VOLATILE_BLUE_CHIP_TOKENS}.
 *
 * If `liquidOnly` is specified, then the following are excluded as they are locked:
 * - Vesting assets
 * - Any token in {ERC20_VOLATILE_ILLIQUID_TOKENS}
 *
 * @param liquidOnly if true, skips illiquid assets
 * @param includeBlueChip if true, includes blue chip assets ({ERC20_VOLATILE_BLUE_CHIP_TOKENS})
 * @param includeLiquidity if true, liquidity is included
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVolatileValue(
  metricName: string,
  blockNumber: BigInt,
  liquidOnly: boolean,
  includeBlueChip: boolean,
  includeLiquidity: boolean,
): TokenRecords {
  return getVolatileTokenBalances(
    metricName,
    liquidOnly,
    includeLiquidity,
    includeBlueChip,
    false,
    true,
    true,
    blockNumber,
  );
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
export function getEthMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecords {
  return getVolatileTokenBalance(metricName, ERC20_WETH, true, riskFree, true, true, blockNumber);
}
