import { BigInt } from "@graphprotocol/graph-ts";

export function hourFromTimestamp(timestamp: BigInt): string {
  const day_ts = timestamp.toI32() - (timestamp.toI32() % 3600);
  return day_ts.toString();
}
