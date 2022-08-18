import { BigInt } from "@graphprotocol/graph-ts";

import { getOwnedLiquidityPoolValue } from "../liquidity/LiquidityCalculations";
import { getStablecoinBalances } from "./TokenStablecoins";
import { getVolatileTokenBalances } from "./TokenVolatile";

/**
 * Returns the market value, which is composed of:
 * - stable value (getStableValue)
 * - volatile value (getVolatileTokenBalances)
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
