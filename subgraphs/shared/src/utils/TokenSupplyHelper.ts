import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../generated/schema";
import { getISO8601DateStringFromTimestamp } from "./DateHelper";

export const TYPE_BONDS_DEPOSITS = "OHM Bonds (Burnable Deposits)";
export const TYPE_BONDS_PREMINTED = "OHM Bonds (Pre-minted)";
export const TYPE_BONDS_VESTING_DEPOSITS = "OHM Bonds (Vesting Deposits)";
export const TYPE_BONDS_VESTING_TOKENS = "OHM Bonds (Vesting Tokens)";
export const TYPE_BOOSTED_LIQUIDITY_VAULT = "Boosted Liquidity Vault";
export const TYPE_LENDING = "Lending";
export const TYPE_LIQUIDITY = "Liquidity";
export const TYPE_OFFSET = "Manual Offset";
export const TYPE_TOTAL_SUPPLY = "Total Supply";
export const TYPE_TREASURY = "Treasury";

/**
 * Helper function to create a new TokenRecord.
 *
 * This function generates an id that should be unique,
 * and saves the record.
 * @returns
 */
export function createTokenSupply(
  timestamp: BigInt,
  tokenName: string,
  tokenAddress: string,
  poolName: string | null,
  poolAddress: string | null,
  sourceName: string | null,
  sourceAddress: string | null,
  type: string,
  balance: BigDecimal,
  blockNumber: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiplier: i32 = 1,
): TokenSupply {
  const dateString = getISO8601DateStringFromTimestamp(timestamp);

  const poolNameNotNull: string = poolName !== null ? poolName : "Unknown Pool";
  const sourceNameNotNull: string = sourceName !== null ? sourceName : "";

  // YYYY-MM-DD/<block>/<token>/<type>/<pool>/<source>
  const recordId = Bytes.fromUTF8(dateString).concatI32(blockNumber.toI32()).concat(Bytes.fromUTF8(tokenName)).concat(Bytes.fromUTF8(type)).concat(Bytes.fromUTF8(poolNameNotNull)).concat(Bytes.fromUTF8(sourceNameNotNull)); `${dateString}/${tokenName}/${type}/${poolNameNotNull}/${sourceNameNotNull}`;
  const record = new TokenSupply(recordId);

  record.block = blockNumber;
  record.date = dateString;
  record.timestamp = timestamp;
  record.token = tokenName;
  record.tokenAddress = tokenAddress;
  record.source = sourceName;
  record.sourceAddress = sourceAddress;
  record.pool = poolName;
  record.poolAddress = poolAddress;
  record.type = type;
  record.balance = balance;
  record.supplyBalance = balance.times(BigDecimal.fromString(multiplier.toString()));

  record.save();

  return record;
}
