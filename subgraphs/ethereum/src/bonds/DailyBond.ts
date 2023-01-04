import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { DailyBond, Token } from "../../generated/schema";
import { dayFromTimestamp } from "../utils/Dates";

export function loadOrCreateDailyBond(timestamp: BigInt, token: Token): DailyBond {
  const day_timestamp = dayFromTimestamp(timestamp);
  const id = day_timestamp + token.id;
  let dailyBond = DailyBond.load(id);
  if (dailyBond == null) {
    dailyBond = new DailyBond(id);
    dailyBond.amount = new BigDecimal(new BigInt(0));
    dailyBond.value = new BigDecimal(new BigInt(0));
    dailyBond.timestamp = BigInt.fromString(day_timestamp);
    dailyBond.token = token.id;
    dailyBond.save();
  }
  return dailyBond as DailyBond;
}

export function createDailyBondRecord(
  timestamp: BigInt,
  token: Token,
  amount: BigDecimal,
  value: BigDecimal,
): void {
  const dailyBond = loadOrCreateDailyBond(timestamp, token);
  dailyBond.amount = dailyBond.amount.plus(amount);
  dailyBond.value = dailyBond.amount.plus(value);
  dailyBond.save();
}
