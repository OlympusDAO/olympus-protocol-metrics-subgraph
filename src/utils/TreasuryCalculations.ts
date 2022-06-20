import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import { getOwnedLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getFloatingSupply, getTotalSupply } from "./OhmCalculations";
import { combineTokenRecords, newTokenRecords } from "./TokenRecordHelper";
import { getStablecoinBalances, getStableValue } from "./TokenStablecoins";
import { getVolatileTokenBalances, getVolatileValue } from "./TokenVolatile";

/**
 * Returns the value of all volatile tokens, including LPs and blue
 * chip tokens.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryVolatileBacking(
  metricName: string,
  blockNumber: BigInt,
  liquidOnly: boolean,
): TokenRecords {
  return getVolatileValue(metricName, blockNumber, liquidOnly, true);
}

/**
 * Returns the value of the stable backing, including liquidity.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryStableBacking(metricName: string, blockNumber: BigInt): TokenRecords {
  const records = getStablecoinBalances(metricName, true, false, true, blockNumber);

  return records;
}

/**
 * Returns the value of the total backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking
 * - add: getLiquidityPoolValue (excluding OHM)
 *
 * NOTE: previously, this value subtracted the quantity of OHM circulating supply
 * (assuming 1 OHM = $1), which has since been changed (June 2022).
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryTotalBacking(metricName: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("Treasury total backing", blockNumber);

  combineTokenRecords(records, getStablecoinBalances(metricName, true, false, true, blockNumber));
  combineTokenRecords(records, getVolatileValue(metricName, blockNumber, false, true));
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, false, true, blockNumber));

  return records;
}

export function getTreasuryLiquidBacking(metricName: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("Treasury total backing", blockNumber);

  combineTokenRecords(records, getStablecoinBalances(metricName, true, false, true, blockNumber));
  combineTokenRecords(records, getVolatileValue(metricName, blockNumber, true, true));
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, false, true, blockNumber));

  return records;
}

/**
 * Returns the liquid backing per circulating OHM, equal to:
 *
 * liquid backing / OHM circulating supply
 * {getTreasuryTotalBacking} / {getCirculatingSupply}
 *
 * @param blockNumber
 * @returns
 */
export function getTreasuryLiquidBackingPerOhmCirculating(
  metricName: string,
  blockNumber: BigInt,
): BigDecimal {
  return getTreasuryLiquidBacking(metricName, blockNumber).value.div(
    getCirculatingSupply(metricName, blockNumber, getTotalSupply(blockNumber)).value,
  );
}

/**
 * Returns the liquid backing per floating OHM, equal to:
 *
 * liquid backing / OHM floating supply
 * {getTreasuryTotalBacking} / {getFloatingSupply}
 *
 * @param blockNumber
 * @returns
 */
export function getTreasuryLiquidBackingPerOhmFloating(
  metricName: string,
  blockNumber: BigInt,
): BigDecimal {
  return getTreasuryLiquidBacking(metricName, blockNumber).value.div(
    getFloatingSupply(metricName, getTotalSupply(blockNumber), blockNumber).value,
  );
}

/**
 * Returns the market value, which is composed of:
 * - stable value (getStableValue)
 * - volatile value (getVolatileValue)
 * - protocol-owned liquidity value (getOwnedLiquidityPoolValue)
 *
 * @param blockNumber
 * @returns
 */
export function getMarketValue(metricName: string, blockNumber: BigInt): TokenRecords {
  log.info("Calculating market value", []);
  const records = newTokenRecords("Market value", blockNumber);

  // Stable and volatile without protocol-owned liquidity
  combineTokenRecords(records, getStableValue(metricName, blockNumber));
  combineTokenRecords(
    records,
    getVolatileTokenBalances(metricName, false, false, true, false, false, blockNumber),
  );
  // Protocol-owned liquidity
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, false, false, blockNumber));

  log.info("Market value: {}", [records.value.toString()]);
  return records;
}

/**
 * Returns the risk-free value, which is composed of:
 * - stable value (getStableValue)
 * - risk-free value of liquidity pools (getLiquidityPoolValue)
 *
 * @param blockNumber
 * @returns
 */
export function getRiskFreeValue(metricName: string, blockNumber: BigInt): TokenRecords {
  log.info("Calculating risk-free value", []);
  const records = newTokenRecords("Risk-free value", blockNumber);

  combineTokenRecords(records, getStableValue(metricName, blockNumber));
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, true, true, blockNumber));

  log.info("Risk-free value: {}", [records.value.toString()]);
  return records;
}
