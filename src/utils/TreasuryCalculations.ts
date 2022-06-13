import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import { getLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getTotalSupply } from "./OhmCalculations";
import { combineTokenRecords, newTokenRecords } from "./TokenRecordHelper";
import { getStablecoinBalances, getStableValue } from "./TokenStablecoins";
import { getVolatileValue } from "./TokenVolatile";

/**
 * Returns the value of all volatile tokens, including LPs and blue
 * chip tokens.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryVolatileBacking(blockNumber: BigInt, liquidOnly: boolean): TokenRecords {
  return getVolatileValue(blockNumber, liquidOnly, true);
}

/**
 * Returns the value of the stable backing, including liquidity.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryStableBacking(blockNumber: BigInt): TokenRecords {
  const records = getStablecoinBalances(true, false, blockNumber);

  return records;
}

/**
 * Returns the value of the total (liquid) backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking (liquid only)
 * - add: getLiquidityPoolValue (excluding OHM)
 *
 * NOTE: previously, this value subtracted the quantity of OHM circulating supply
 * (assuming 1 OHM = $1), which has since been changed (June 2022).
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryTotalBacking(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("Treasury total backing", blockNumber);

  combineTokenRecords(records, getTreasuryStableBacking(blockNumber));
  combineTokenRecords(records, getTreasuryVolatileBacking(blockNumber, true));
  combineTokenRecords(records, getLiquidityPoolValue(false, true, blockNumber));

  return records;
}

/**
 * Returns the liquid backing per OHM, equal to:
 *
 * total backing / OHM circulating supply
 * {getTreasuryTotalBacking} / {getCirculatingSupply}
 *
 * @param blockNumber
 * @returns
 */
export function getTreasuryLiquidBackingPerOhm(blockNumber: BigInt): BigDecimal {
  return getTreasuryTotalBacking(blockNumber).value.div(
    getCirculatingSupply(blockNumber, getTotalSupply(blockNumber)),
  );
}

/**
 * Returns the floating backing per OHM, equal to:
 *
 * total backing / (OHM circulating supply + OHM in LPs)
 * {getTreasuryTotalBacking} / {getCirculatingSupply}
 *
 * @param blockNumber
 * @returns
 */
export function getTreasuryFloatingBackingPerOhm(blockNumber: BigInt): BigDecimal {
  return BigDecimal.zero();
}

/**
 * Returns the market value, which is composed of:
 * - stable value (getStableValue)
 * - liquidity pool value (getLiquidityPoolValue)
 * - volatile value (getVolatileValue)
 *
 * @param blockNumber
 * @returns
 */
export function getMarketValue(blockNumber: BigInt): TokenRecords {
  log.info("Calculating market value", []);
  // TODO check that ETH and stables aren't being double-counted
  const records = newTokenRecords("Market value", blockNumber);

  combineTokenRecords(records, getStableValue(blockNumber));
  combineTokenRecords(records, getLiquidityPoolValue(false, false, blockNumber));
  combineTokenRecords(records, getVolatileValue(blockNumber, false, true));

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
export function getRiskFreeValue(blockNumber: BigInt): TokenRecords {
  log.info("Calculating risk-free value", []);
  const records = newTokenRecords("Risk-free value", blockNumber);

  combineTokenRecords(records, getStableValue(blockNumber));
  combineTokenRecords(records, getLiquidityPoolValue(true, true, blockNumber));

  log.info("Risk-free value: {}", [records.value.toString()]);
  return records;
}
