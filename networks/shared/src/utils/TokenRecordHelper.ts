import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { TokenDefinition } from "../contracts/TokenDefinition";
import { getISO8601StringFromTimestamp } from "./DateHelper";

export const getTokenCategory = (
  contractAddress: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): string => {
  const contractAddressLower = contractAddress.toLowerCase();

  return tokenDefinitions.has(contractAddressLower)
    ? tokenDefinitions.get(contractAddressLower).getCategory()
    : "Unknown";
};

export const getIsTokenVolatileBluechip = (
  contractAddress: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): boolean => {
  const contractAddressLower = contractAddress.toLowerCase();

  return tokenDefinitions.has(contractAddressLower)
    ? tokenDefinitions.get(contractAddressLower).getIsVolatileBluechip()
    : false;
};

export const getIsTokenLiquid = (
  contractAddress: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): boolean => {
  const contractAddressLower = contractAddress.toLowerCase();

  return tokenDefinitions.has(contractAddressLower)
    ? tokenDefinitions.get(contractAddressLower).getIsLiquid()
    : true;
};

/**
 * Returns the value of the given TokenRecord.
 *
 * value = balance * rate
 *
 * @param record
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
function getTokenRecordValue(record: TokenRecord, nonOhmMultiplier: boolean = false): BigDecimal {
  return record.balance
    .times(record.rate)
    .times(nonOhmMultiplier ? record.multiplier : BigDecimal.fromString("1"));
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
 * @param isLiquid
 * @param tokenDefinitions
 * @param blockchain
 * @param nonOhmMultiplier The proportion (between 0 and 1) of the value that represents non-OHM assets.
 * @param category The asset category. If not specified, the value will be determined through a lookup.
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
  isLiquid: boolean,
  tokenDefinitions: Map<string, TokenDefinition>,
  blockchain: string,
  nonOhmMultiplier: BigDecimal = BigDecimal.fromString("1"),
  category: string | null = null,
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
  record.multiplier = nonOhmMultiplier;
  record.category = category !== null ? category : getTokenCategory(tokenAddress, tokenDefinitions);
  record.isLiquid = isLiquid;
  record.isBluechip = getIsTokenVolatileBluechip(tokenAddress, tokenDefinitions);
  record.blockchain = blockchain;
  record.value = getTokenRecordValue(record);
  record.valueExcludingOhm = getTokenRecordValue(record, true);

  record.save();

  return record;
}

export const getTokensInCategory = (
  category: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): TokenDefinition[] => {
  const filteredArray: TokenDefinition[] = [];

  // No support for closures in AssemblyScript, so we do it the old-fashioned way
  const values = tokenDefinitions.values();
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value.getCategory() !== category) {
      continue;
    }

    filteredArray.push(value);
  }

  return filteredArray;
};

export const getTokenAddressesInCategory = (
  category: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): string[] => {
  const getAddressFunc = (value: TokenDefinition, _index: i32, _array: TokenDefinition[]): string =>
    value.getAddress().toLowerCase();

  // Need to define the return type of map: https://github.com/AssemblyScript/assemblyscript/issues/449#issuecomment-459981415
  return getTokensInCategory(category, tokenDefinitions).map<string>(getAddressFunc);
};

export const isTokenAddressInCategory = (
  tokenAddress: string,
  category: string,
  tokenDefinitions: Map<string, TokenDefinition>,
): bool => {
  return getTokenAddressesInCategory(category, tokenDefinitions).includes(
    tokenAddress.toLowerCase(),
  );
};
