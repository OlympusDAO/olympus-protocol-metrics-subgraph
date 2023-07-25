import { BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { TokenSupply } from "../../../shared/generated/schema";
import { pushTokenRecordArray, pushTokenSupplyArray } from "../../../shared/src/utils/ArrayHelper";
import { getOwnedLiquidityPoolValue } from "../liquidity/LiquidityCalculations";
import {
  getBoostedLiquiditySupplyRecords,
  getIncurDebtSupplyRecords,
  getMintedBorrowableOHMRecords,
  getProtocolOwnedLiquiditySupplyRecords,
  getTotalSupplyRecord,
  getTreasuryOHMRecords,
  getVestingBondSupplyRecords,
} from "./OhmCalculations";
import { getStablecoinBalances } from "./TokenStablecoins";
import { getVolatileTokenBalances } from "./TokenVolatile";

/**
 * Returns the market value, which is composed of:
 * - stable value (getStablecoinBalances)
 * - volatile value (getVolatileTokenBalances)
 * - protocol-owned liquidity value (getOwnedLiquidityPoolValue)
 *
 * Market value does not exclude the value of OHM in the treasury.
 *
 * @param blockNumber
 * @returns
 */
export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  // Stable without protocol-owned liquidity
  pushTokenRecordArray(
    records,
    getStablecoinBalances(timestamp, false, blockNumber),
  );

  // Volatile without protocol-owned liquidity, but blue-chip assets
  pushTokenRecordArray(
    records,
    getVolatileTokenBalances(timestamp, false, false, true, blockNumber),
  );

  // Protocol-owned liquidity
  pushTokenRecordArray(
    records,
    getOwnedLiquidityPoolValue(timestamp, blockNumber),
  );

  return records;
}

export function generateTokenSupply(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // OHM
  // Total supply
  pushTokenSupplyArray(
    records,
    [getTotalSupplyRecord(timestamp, blockNumber)],
  );

  // Treasury OHM & migration offset
  pushTokenSupplyArray(
    records,
    getTreasuryOHMRecords(timestamp, blockNumber),
  );

  // POL
  pushTokenSupplyArray(
    records,
    getProtocolOwnedLiquiditySupplyRecords(timestamp, blockNumber),
  );

  // Bond vesting
  pushTokenSupplyArray(
    records,
    getVestingBondSupplyRecords(timestamp, blockNumber),
  );

  // Borrowable OHM
  pushTokenSupplyArray(
    records,
    getMintedBorrowableOHMRecords(timestamp, blockNumber),
  );

  // OHM in Boosted Liquidity Vaults
  pushTokenSupplyArray(
    records,
    getBoostedLiquiditySupplyRecords(timestamp, blockNumber),
  );

  // OHM in IncurDebt
  pushTokenSupplyArray(
    records,
    getIncurDebtSupplyRecords(timestamp, blockNumber),
  );

  return records;
}
