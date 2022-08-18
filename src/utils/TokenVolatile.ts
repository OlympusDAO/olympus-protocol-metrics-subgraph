import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { pushArray } from "./ArrayHelper";
import {
  ERC20_CVX,
  ERC20_CVX_VL_V1,
  ERC20_FXS,
  ERC20_FXS_VE,
  ERC20_WBTC,
  ERC20_WETH,
  ERC20_XSUSHI,
  getContractName,
  getTokensInCategory,
} from "./Constants";
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
import { getLiquidityBalances } from "./LiquidityCalculations";
import { getUSDRate } from "./Price";
import { TokenCategoryVolatile } from "./TokenDefinition";
import { createOrUpdateTokenRecord } from "./TokenRecordHelper";

/**
 * Returns the value of vesting assets in the treasury
 *
 * @returns TokenRecordsWrapper
 */
export function getVestingAssets(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  // Cross chain assets that can not be tracked right now
  // pklima
  // butterfly
  // Vsta
  // PhantomDAO
  // Lobis
  // TODO remove hard-coded number
  const records: TokenRecord[] = [];

  const record = createOrUpdateTokenRecord(
    timestamp,
    "Vesting Assets",
    "N/A",
    "No source",
    "0x0",
    BigDecimal.fromString("1"),
    BigDecimal.fromString("32500000"),
    blockNumber,
    BigDecimal.fromString("1"),
    TokenCategoryVolatile,
    false,
  );
  records.push(record);

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
 * @returns TokenRecordsWrapper object
 */
export function getVolatileTokenBalance(
  timestamp: BigInt,
  contractAddress: string,
  includeLiquidity: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
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
    pushArray(
      records,
      getLiquidityBalances(
        timestamp,
        contractAddress,
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
 * Gets the balances for all volatile tokens, using {getVolatileTokenBalance}.
 *
 * @param date
 * @param liquidOnly If true, exclude illiquid assets. This is currently limited to vesting assets.
 * @param includeLiquidity If true, includes volatile assets in protocol-owned liquidity
 * @param includeBlueChip If true, includes blue-chip assets (wETH and wBTC)
 * @param riskFree If true, returns the risk-free value of liquidity pools
 * @param excludeOhmValue If true, the value of liquidity pools is returned without the value of OHM. This is used to calculate backing.
 * @param restrictToTokenValue If true, the value of liquidity pools is restricted to a specific token. This is used to calculate the value of specific assets.
 * @param blockNumber the current block
 * @returns TokenRecordsWrapper object
 */
export function getVolatileTokenBalances(
  timestamp: BigInt,
  liquidOnly: boolean,
  includeLiquidity: boolean,
  includeBlueChip: boolean,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info("Calculating volatile token value", []);
  const records: TokenRecord[] = [];

  const volatileTokens = getTokensInCategory(TokenCategoryVolatile);

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
      getVolatileTokenBalance(
        timestamp,
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
    pushArray(records, getVestingAssets(timestamp, blockNumber));
  }

  return records;
}

/**
 * Returns the balance of xSUSHI tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getXSushiBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_XSUSHI, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of CVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getCVXBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_CVX, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of vlCVX tokens from all wallets, using
 * {getVolatileTokenBalance}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getVlCVXBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
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
 * @returns TokenRecordsWrapper object
 */
export function getCVXTotalBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  pushArray(records, getCVXBalance(metricName, blockNumber));
  pushArray(records, getVlCVXBalance(metricName, blockNumber));

  return records;
}

/**
 * Returns the balance of FXS tokens from all wallets, using
 * {getERC20TokenRecordsWrapperFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
function getFXSBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_FXS, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of veFXS tokens in the following:
 * - FXS allocator
 *
 * @param veFXS VeFXS contract
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getVeFXSBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_FXS_VE, false, false, false, false, blockNumber);
}

/**
 * Returns the balance of FXS tokens:
 * - FXS
 * - veFXS
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getFXSTotalBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  pushArray(records, getFXSBalance(metricName, blockNumber));
  pushArray(records, getVeFXSBalance(metricName, blockNumber));

  return records;
}

/**
 * Calculates the balance of wETH from all wallets, using
 * {getERC20TokenRecordsWrapperFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecordsWrapper object
 */
export function getWETHBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_WETH, false, false, false, false, blockNumber);
}

/**
 * Calculates the balance of wBTC from all wallets, using
 * {getERC20TokenRecordsWrapperFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecordsWrapper object
 */
export function getWBTCBalance(metricName: string, blockNumber: BigInt): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_WBTC, false, false, false, false, blockNumber);
}

/**
 * Returns the value of all volatile assets, except those in {ERC20_VOLATILE_BLUE_CHIP_TOKENS}.
 *
 * If `liquidOnly` is specified, then the following are excluded as they are locked:
 * - Vesting assets
 * - Any token where the category is Volatile
 *
 * @param liquidOnly if true, skips illiquid assets
 * @param includeBlueChip if true, includes blue chip assets ({ERC20_VOLATILE_BLUE_CHIP_TOKENS})
 * @param includeLiquidity if true, liquidity is included
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getVolatileValue(
  date: string,
  blockNumber: BigInt,
  liquidOnly: boolean,
  includeBlueChip: boolean,
  includeLiquidity: boolean,
): TokenRecord[] {
  return getVolatileTokenBalances(
    date,
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
 * @returns TokenRecordsWrapper representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getEthMarketValue(
  metricName: string,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  riskFree: boolean = false,
): TokenRecord[] {
  return getVolatileTokenBalance(metricName, ERC20_WETH, true, riskFree, true, true, blockNumber);
}
