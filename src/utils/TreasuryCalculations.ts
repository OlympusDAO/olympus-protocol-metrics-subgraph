import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { pushArray } from "./ArrayHelper";
import { getOwnedLiquidityPoolValue } from "./LiquidityCalculations";
import { getStablecoinBalances, getStableValue } from "./TokenStablecoins";
import { getVolatileTokenBalances } from "./TokenVolatile";

/**
 * Returns the value of all volatile tokens, excluding protocol-owned liquidity.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getTreasuryVolatileBacking(
  date: string,
  blockNumber: BigInt,
  liquidOnly: boolean,
): TokenRecord[] {
  return getVolatileTokenBalances(date, liquidOnly, false, true, false, true, true, blockNumber);
}

/**
 * Returns the value of the stable backing, excluding protocol-owned liquidity.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getTreasuryStableBacking(metricName: string, blockNumber: BigInt): TokenRecord[] {
  const records = getStablecoinBalances(metricName, false, false, true, true, blockNumber);

  return records;
}

/**
 * Returns the value of the backing of protocol owned liquidity.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param metricName
 * @param blockNumber
 * @returns
 */
export function getTreasuryProtocolOwnedLiquidityBacking(
  metricName: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const records = getOwnedLiquidityPoolValue(metricName, false, true, blockNumber);

  return records;
}

/**
 * Returns the value of the treasury backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking
 * - add: getOwnedLiquidityPoolValue (excluding OHM)
 *
 * If {liquidOnly} is true, only liquid assets will be returned.
 *
 * NOTE: previously, this value subtracted the quantity of OHM circulating supply
 * (assuming 1 OHM = $1), which has since been changed (June 2022).
 *
 * @param blockNumber the current block number
 * @returns TokenRecordsWrapper object
 */
export function getTreasuryBacking(
  metricName: string,
  liquidOnly: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const includeLiquidity = true;
  const riskFree = false;
  const excludeOhmValue = true;
  const restrictToTokenValue = true;

  pushArray(
    records,
    getStablecoinBalances(
      metricName,
      includeLiquidity,
      riskFree,
      excludeOhmValue,
      restrictToTokenValue,
      blockNumber,
    ),
  );
  pushArray(
    records,
    getVolatileTokenBalances(
      metricName,
      liquidOnly,
      includeLiquidity,
      true,
      riskFree,
      excludeOhmValue,
      restrictToTokenValue,
      blockNumber,
    ),
  );
  pushArray(records, getOwnedLiquidityPoolValue(metricName, riskFree, true, blockNumber));

  return records;
}

/**
 * Returns the market value, which is composed of:
 * - stable value (getStableValue)
 * - volatile value (getVolatileValue)
 * - protocol-owned liquidity value (getOwnedLiquidityPoolValue)
 *
 * Market value does not exclude the value of OHM in the treasury.
 *
 * @param blockNumber
 * @returns
 */
export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  // Stable without protocol-owned liquidity
  getStablecoinBalances(timestamp, false, false, false, false, blockNumber);

  // Volatile without protocol-owned liquidity, but blue-cip assets
  getVolatileTokenBalances(timestamp, false, false, true, false, false, false, blockNumber);

  // Protocol-owned liquidity
  getOwnedLiquidityPoolValue(timestamp, false, false, blockNumber);
}
