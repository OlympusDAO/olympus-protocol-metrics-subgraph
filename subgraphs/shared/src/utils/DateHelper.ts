import { BigInt } from "@graphprotocol/graph-ts";

/**
 * Returns in YYYY-MM-DD format
 *
 * @param date
 * @returns
 */
export const getISO8601DateString = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const getISO8601DateStringFromTimestamp = (timestamp: BigInt): string => {
  const date = new Date(timestamp.toI64() * 1000);
  return getISO8601DateString(date);
};

export const getISO8601StringFromTimestamp = (timestamp: BigInt): string => {
  const date = new Date(timestamp.toI64() * 1000);
  return date.toISOString();
};
