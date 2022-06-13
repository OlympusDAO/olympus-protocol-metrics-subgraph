import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import { getLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getTotalSupply } from "./OhmCalculations";
import {
  combineTokenRecords,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";
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
 * - add: getLiquidityPoolValue / 2 (as half of the LP is OHM)
 * - subtract: quantity of OHM circulating supply (not value)
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryTotalBacking(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("Treasury total backing", blockNumber);

  combineTokenRecords(records, getTreasuryStableBacking(blockNumber));
  combineTokenRecords(records, getTreasuryVolatileBacking(blockNumber, true));
  combineTokenRecords(records, getLiquidityPoolValue(false, true, blockNumber));

  // TODO previous implementation was the number of OHM, not the value. Keep as-is?
  const ohmCirculatingSupply = getCirculatingSupply(blockNumber, getTotalSupply(blockNumber));
  pushTokenRecord(
    records,
    newTokenRecord(
      "OHM Circulating Supply",
      "N/A",
      "0x0",
      BigDecimal.fromString("1"),
      ohmCirculatingSupply,
      blockNumber,
      BigDecimal.fromString("-1"), // Subtracted
    ),
  );

  return records;
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
