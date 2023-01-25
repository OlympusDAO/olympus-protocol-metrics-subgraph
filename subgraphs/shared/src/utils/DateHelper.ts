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

export const getDateFromBlockTimestamp = (timestamp: BigInt): Date => {
  return new Date(timestamp.toI64() * 1000);
}

export const addDays = (date: Date, days: u64): Date => {
  const newDate = new Date(date.getTime() + days * (24 * 60 * 60 * 1000));

  return newDate;
};
