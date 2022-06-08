import { BigDecimal } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenRecords } from "../../generated/schema";

// TokenRecord

export const getTokenRecordValue = (record: TokenRecord): BigDecimal => {
  return record.balance.times(record.rate).times(record.multiplier);
};

export const setTokenRecordMultiplier = (record: TokenRecord, multiplier: BigDecimal): void => {
  record.multiplier = multiplier;
  record.value = getTokenRecordValue(record);

  record.save();
};

export const newTokenRecord = (
  name: string,
  source: string,
  sourceAddress: string,
  rate: BigDecimal,
  balance: BigDecimal,
  multiplier: BigDecimal = BigDecimal.fromString("1"),
): TokenRecord => {
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
};

// TokenRecords

export const getTokenRecordsBalance = (records: TokenRecords): BigDecimal => {
  let totalBalance = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const idValue = idValues[i];
    const record = TokenRecord.load(idValue);
    if (!record) continue;

    totalBalance = totalBalance.plus(record.balance);
  }

  return totalBalance;
};

export const getTokenRecordsValue = (records: TokenRecords): BigDecimal => {
  let totalValue = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const idValue = idValues[i];
    const record = TokenRecord.load(idValue);
    if (!record) continue;

    totalValue = totalValue.plus(record.value);
  }

  return totalValue;
};

export const pushTokenRecord = (
  records: TokenRecords,
  record: TokenRecord,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  update: boolean = true,
): void => {
  const newArray = records.records;
  newArray.push(record.id);
  records.records = newArray;

  if (update) {
    records.balance = getTokenRecordsBalance(records);
    records.value = getTokenRecordsValue(records);
  }

  records.save();
};

export const combineTokenRecords = (records1: TokenRecords, records2: TokenRecords): void => {
  for (let i = 0; i < records2.records.length; i++) {
    const records2Id = records2.records[i];
    const records2Value = TokenRecord.load(records2Id);
    if (!records2Value) continue;

    pushTokenRecord(records1, records2Value, false);
  }

  records1.balance = getTokenRecordsBalance(records1);
  records1.value = getTokenRecordsValue(records1);

  records1.save();
};

export const setTokenRecordsMultiplier = (records: TokenRecords, multiplier: BigDecimal): void => {
  for (let i = 0; i < records.records.length; i++) {
    const recordId = records.records[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) continue;

    setTokenRecordMultiplier(recordValue, multiplier);
  }

  records.balance = getTokenRecordsBalance(records);
  records.value = getTokenRecordsValue(records);

  records.save();
};

export const sortTokenRecords = (records: TokenRecords): void => {
  // We sort by ID anyway ({name}-{source}), so we can just use the ID array
  records.records = records.records.sort((a, b) => (a > b ? 1 : -1));

  records.save();
};

export const newTokenRecords = (id: string): TokenRecords => {
  const records = new TokenRecords(id);
  records.records = [];
  records.save();

  return records;
};
