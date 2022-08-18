import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { getISO8601StringFromTimestamp } from "../helpers/DateHelper";

/**
 * Returns the value of the given TokenRecord.
 *
 * value = balance * rate * multiplier
 *
 * @param record
 * @returns
 */
function getTokenRecordValue(record: TokenRecord): BigDecimal {
  return record.balance.times(record.rate).times(record.multiplier);
}

/**
 * Helper function to create a new TokenRecord.
 *
 * This function generates an id that should be unique,
 * and saves the record.
 *
 * @param timestamp
 * @param tokenName
 * @param tokenAddress
 * @param sourceName
 * @param sourceAddress
 * @param rate
 * @param balance
 * @param blockNumber
 * @param multiplier
 * @returns
 */
export function createOrUpdateTokenRecord(
  timestamp: BigInt,
  tokenName: string,
  tokenAddress: string,
  sourceName: string,
  sourceAddress: string,
  rate: BigDecimal,
  balance: BigDecimal,
  blockNumber: BigInt,
  multiplier: BigDecimal = BigDecimal.fromString("1"),
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  category: string = "",
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  isLiquid: boolean = false,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  isBluechip: boolean = false,
): TokenRecord {
  const dateString = getISO8601StringFromTimestamp(timestamp);
  const recordId = `${dateString}/${sourceName}/${tokenName}`;

  // Attempt to fetch the current day's record
  const existingRecord = TokenRecord.load(recordId);

  const record = existingRecord ? existingRecord : new TokenRecord(recordId);

  record.block = blockNumber;
  record.date = dateString;
  record.timestamp = timestamp;
  record.token = tokenName;
  record.tokenAddress = tokenAddress;
  record.source = sourceName;
  record.sourceAddress = sourceAddress;
  record.rate = rate;
  record.balance = balance;
  record.multiplier = multiplier;
  record.category = category;
  record.isLiquid = isLiquid;
  record.isBluechip = isBluechip;
  record.value = getTokenRecordValue(record);

  record.save();

  return record;
}
