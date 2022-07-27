import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { FraxSwapPool } from "../../generated/ProtocolMetrics/FraxSwapPool";
import { TokenRecords } from "../../generated/schema";
import { addToMetricName, newTokenRecords } from "./TokenRecordHelper";

/**
 * Returns the total value of the given FraxSwap pair.
 *
 * Calculated as: token0 balance * token0 rate + token1 balance * token1 rate
 *
 * @param pairAddress
 * @param excludeOhmValue If true, the value will exclude OHM. This can be used to calculate backing
 * @param restrictToToken  If true, the value will be restricted to that of the specified token. This can be used to calculate the value of liquidity for a certain token.
 * @param tokenAddress The tokenAddress to restrict to (or null)
 * @param blockNumber
 * @returns
 */
export function getFraxSwapPairTotalValue(
  pairAddress: string,
  excludeOhmValue: boolean,
  restrictToToken: boolean,
  tokenAddress: string | null,
  blockNumber: BigInt,
): BigDecimal {
  return BigDecimal.zero();
}

/**
 * Determines the unit rate of the given FraxSwap pool.
 *
 * Unit rate = total value / total supply
 *
 * @param poolTokenContract
 * @param totalValue
 * @param _blockNumber
 * @returns
 */
export function getFraxSwapPairUnitRate(
  pairContract: FraxSwapPool,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  return BigDecimal.zero();
}

export function getFraxSwapPairToken(
  pairAddress: string,
  blockNumber: BigInt,
): FraxSwapPool | null {
  return null;
}

/**
 * Helper method to simplify getting the balance from a FraxSwapPool contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound FraxSwapPool contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @returns BigDecimal
 */
export function getFraxSwapPairTokenBalance(
  contract: FraxSwapPool | null,
  address: string,
  currentBlockNumber: BigInt,
): BigDecimal {
  return BigDecimal.zero();
}

function getFraxSwapPairTokenRecords(
  metricName: string,
  pairContract: FraxSwapPool,
  unitRate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "FraxSwapPairToken"), blockNumber);

  return records;
}

/**
 * Provides TokenRecords representing the FraxSwap pair identified by {pairAddress}.
 *
 * @param metricName
 * @param pairAddress The address of the pool
 * @param excludeOhmValue If true, the value will exclude that of OHM
 * @param restrictToTokenValue If true, the value will reflect the portion of the pool made up by {tokenAddress}. Overrides {excludeOhmValue}.
 * @param blockNumber The current block number
 * @param tokenAddress If specified, this function will exit if the token is not in the liquidity pool
 * @returns
 */
export function getFraxSwapPairRecords(
  metricName: string,
  pairAddress: string,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
  tokenAddress: string | null = null,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "FraxSwapPool"), blockNumber);
  return records;
}

export function getFraxSwapPairTokenQuantity(
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  return BigDecimal.zero();
}

export function getFraxSwapPairTokenQuantityRecords(
  metricName: string,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, "FraxSwapPoolTokenQuantity"),
    blockNumber,
  );
  return records;
}
