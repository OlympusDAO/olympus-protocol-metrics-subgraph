import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import { getOwnedLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getFloatingSupply, getTotalSupply } from "./OhmCalculations";
import { combineTokenRecords, newTokenRecords } from "./TokenRecordHelper";
import { getStablecoinBalances, getStableValue } from "./TokenStablecoins";
import { getVolatileTokenBalances } from "./TokenVolatile";

/**
 * Returns the value of all volatile tokens, excluding protocol-owned liquidity.
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
  return getVolatileTokenBalances(
    metricName,
    liquidOnly,
    false,
    true,
    false,
    true,
    true,
    blockNumber,
  );
}

/**
 * Returns the value of the stable backing, excluding protocol-owned liquidity.
 *
 * As this is a backing metric, the value of OHM is excluded.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryStableBacking(metricName: string, blockNumber: BigInt): TokenRecords {
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
): TokenRecords {
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
 * @returns TokenRecords object
 */
export function getTreasuryBacking(
  metricName: string,
  liquidOnly: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(metricName, blockNumber);
  const includeLiquidity = true;
  const riskFree = false;
  const excludeOhmValue = true;
  const restrictToTokenValue = true;

  combineTokenRecords(
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
  combineTokenRecords(
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
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, riskFree, true, blockNumber));

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
  return getTreasuryBacking(metricName, true, blockNumber).value.div(
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
  return getTreasuryBacking(metricName, true, blockNumber).value.div(
    getFloatingSupply(metricName, getTotalSupply(blockNumber), blockNumber).value,
  );
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
export function getMarketValue(metricName: string, blockNumber: BigInt): TokenRecords {
  log.info("Calculating market value", []);
  const records = newTokenRecords(metricName, blockNumber);

  // Stable and volatile without protocol-owned liquidity
  combineTokenRecords(records, getStableValue(metricName, blockNumber));
  combineTokenRecords(
    records,
    getVolatileTokenBalances(metricName, false, false, true, false, false, false, blockNumber),
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
  const records = newTokenRecords(metricName, blockNumber);

  combineTokenRecords(records, getStableValue(metricName, blockNumber));
  combineTokenRecords(records, getOwnedLiquidityPoolValue(metricName, true, true, blockNumber));

  log.info("Risk-free value: {}", [records.value.toString()]);
  return records;
}
