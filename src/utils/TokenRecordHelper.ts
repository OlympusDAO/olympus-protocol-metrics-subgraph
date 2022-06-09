import { BigDecimal } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenRecords } from "../../generated/schema";

// TokenRecord

export function getTokenRecordValue(record: TokenRecord): BigDecimal {
  return record.balance.times(record.rate).times(record.multiplier);
}

export function setTokenRecordMultiplier(record: TokenRecord, multiplier: BigDecimal): void {
  record.multiplier = multiplier;
  record.value = getTokenRecordValue(record);

  record.save();
}

export function newTokenRecord(
  name: string,
  source: string,
  sourceAddress: string,
  rate: BigDecimal,
  balance: BigDecimal,
  multiplier: BigDecimal = BigDecimal.fromString("1"),
): TokenRecord {
  const record = new TokenRecord(name + "-" + source);
  record.name = name;
  record.source = source;
  record.sourceAddress = sourceAddress;
  record.rate = rate;
  record.balance = balance;
  record.multiplier = multiplier;
  record.value = getTokenRecordValue(record);

  record.save();

  return record;
}

// TokenRecords

export function getTokenRecordsBalance(records: TokenRecords): BigDecimal {
  let totalBalance = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const recordId = idValues[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecords " +
          records.id,
      );
    }

    totalBalance = totalBalance.plus(recordValue.balance);
  }

  return totalBalance;
}

export function getTokenRecordsValue(records: TokenRecords): BigDecimal {
  let totalValue = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const recordId = idValues[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecords " +
          records.id,
      );
    }

    totalValue = totalValue.plus(recordValue.value);
  }

  return totalValue;
}

export function pushTokenRecord(
  records: TokenRecords,
  record: TokenRecord,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  update: boolean = true,
): void {
  const newArray = records.records || [];
  newArray.push(record.id);
  records.records = newArray;

  if (update) {
    records.balance = getTokenRecordsBalance(records);
    records.value = getTokenRecordsValue(records);
  }

  records.save();
}

export function combineTokenRecords(records1: TokenRecords, records2: TokenRecords): void {
  for (let i = 0; i < records2.records.length; i++) {
    const records2Id = records2.records[i];
    const records2Value = TokenRecord.load(records2Id);
    if (!records2Value) {
      throw new Error(
        "combineTokenRecords: Unexpected null value for id " +
          records2Id +
          " in TokenRecords " +
          records2.id,
      );
    }

    pushTokenRecord(records1, records2Value, false);
  }

  records1.balance = getTokenRecordsBalance(records1);
  records1.value = getTokenRecordsValue(records1);

  records1.save();
}

export function setTokenRecordsMultiplier(records: TokenRecords, multiplier: BigDecimal): void {
  for (let i = 0; i < records.records.length; i++) {
    const recordId = records.records[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecords " +
          records.id,
      );
    }

    setTokenRecordMultiplier(recordValue, multiplier);
  }

  records.balance = getTokenRecordsBalance(records);
  records.value = getTokenRecordsValue(records);

  records.save();
}

export function sortTokenRecords(records: TokenRecords): void {
  // We sort by ID anyway ({name}-{source}), so we can just use the ID array
  records.records = records.records.sort((a, b) => (a > b ? 1 : -1));

  records.save();
}

export function newTokenRecords(id: string): TokenRecords {
  const records = new TokenRecords(id);
  records.records = [];
  records.balance = BigDecimal.fromString("0");
  records.value = BigDecimal.fromString("0");
  records.save();

  return records;
}