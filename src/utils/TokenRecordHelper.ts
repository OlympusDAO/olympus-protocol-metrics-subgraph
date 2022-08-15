import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenRecordsWrapper } from "../../generated/schema";

// TokenRecord

/**
 * Returns the value of the given TokenRecord.
 *
 * value = balance * rate * multiplier
 *
 * @param record
 * @returns
 */
export function getTokenRecordValue(record: TokenRecord): BigDecimal {
  return record.balance.times(record.rate).times(record.multiplier);
}

/**
 * Set the multiplier on the TokenRecord and update the value.
 *
 * @param record
 * @param multiplier
 */
export function setTokenRecordMultiplier(record: TokenRecord, multiplier: BigDecimal): void {
  record.multiplier = multiplier;
  record.value = getTokenRecordValue(record);

  record.save();
}

/**
 * Helper function to create a new TokenRecord.
 *
 * This function generates an id that should be unique,
 * and saves the record.
 *
 * @param metric
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
export function newTokenRecord(
  metric: string,
  tokenName: string,
  tokenAddress: string,
  sourceName: string,
  sourceAddress: string,
  rate: BigDecimal,
  balance: BigDecimal,
  blockNumber: BigInt,
  multiplier: BigDecimal = BigDecimal.fromString("1"),
): TokenRecord {
  // We need to separate records between metrics, otherwise they get clobbered
  const record = new TokenRecord(`${blockNumber.toString()}/${sourceName}/${tokenName}`);
  record.block = blockNumber;
  record.token = tokenName;
  record.tokenAddress = tokenAddress;
  record.source = sourceName;
  record.sourceAddress = sourceAddress;
  record.rate = rate;
  record.balance = balance;
  record.multiplier = multiplier;
  record.value = getTokenRecordValue(record);

  record.save();

  return record;
}

// TokenRecordsWrapper

export function getTokenRecordsWrapperBalance(records: TokenRecordsWrapper): BigDecimal {
  let totalBalance = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const recordId = idValues[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsWrapperMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecordsWrapper " +
          records.id,
      );
    }

    totalBalance = totalBalance.plus(recordValue.balance);
  }

  return totalBalance;
}

/**
 * Returns the value of all of the TokenRecordsWrapper.
 *
 * @param records
 * @returns
 */
export function getTokenRecordsWrapperValue(records: TokenRecordsWrapper): BigDecimal {
  let totalValue = BigDecimal.fromString("0");
  const idValues = records.records;

  for (let i = 0; i < idValues.length; i++) {
    const recordId = idValues[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsWrapperMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecordsWrapper " +
          records.id,
      );
    }

    totalValue = totalValue.plus(recordValue.value);
  }

  return totalValue;
}

/**
 * Pushes the `record` parameter into the array within `records`.
 *
 * @param records TokenRecordsWrapper to add to
 * @param record TokenRecord to add
 * @param update if true, updates the balance and value
 */
export function pushTokenRecord(
  records: TokenRecordsWrapper,
  record: TokenRecord,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  update: boolean = true,
): void {
  // const newArray = records.records || [];
  // // Don't allow duplicates
  // if (!newArray.includes(record.id)) {
  //   newArray.push(record.id);
  // }
  // records.records = newArray;
  // if (update) {
  //   records.balance = getTokenRecordsWrapperBalance(records);
  //   records.value = getTokenRecordsWrapperValue(records);
  // }
  // records.save();
}

/**
 * Combines two TokenRecordsWrapper objects.
 *
 * The balance and value will be updated, and {records1} will be saved.
 *
 * @param records1 The TokenRecordsWrapper to add to
 * @param records2 The TokenRecordsWrapper to include
 */
export function combineTokenRecordsWrapper(
  records1: TokenRecordsWrapper,
  records2: TokenRecordsWrapper,
): void {
  // for (let i = 0; i < records2.records.length; i++) {
  //   const records2Id = records2.records[i];
  //   const records2Value = TokenRecord.load(records2Id);
  //   if (!records2Value) {
  //     throw new Error(
  //       "combineTokenRecordsWrapper: Unexpected null value for id " +
  //         records2Id +
  //         " in TokenRecordsWrapper " +
  //         records2.id,
  //     );
  //   }
  //   pushTokenRecord(records1, records2Value, false);
  // }
  // records1.balance = getTokenRecordsWrapperBalance(records1);
  // records1.value = getTokenRecordsWrapperValue(records1);
  // records1.save();
}

/**
 * Sets the multiplier across all contained TokenRecord objects.
 *
 * The balance and value are updated, and the records saved.
 *
 * @param records
 * @param multiplier
 */
export function setTokenRecordsWrapperMultiplier(
  records: TokenRecordsWrapper,
  multiplier: BigDecimal,
): void {
  for (let i = 0; i < records.records.length; i++) {
    const recordId = records.records[i];
    const recordValue = TokenRecord.load(recordId);
    if (!recordValue) {
      throw new Error(
        "setTokenRecordsWrapperMultiplier: Unexpected null value for id " +
          recordId +
          " in TokenRecordsWrapper " +
          records.id,
      );
    }

    setTokenRecordMultiplier(recordValue, multiplier);
  }

  records.balance = getTokenRecordsWrapperBalance(records);
  records.value = getTokenRecordsWrapperValue(records);

  records.save();
}

export function sortTokenRecordsWrapper(records: TokenRecordsWrapper): void {
  // We sort by ID anyway ({name}-{source}), so we can just use the ID array
  records.records = records.records.sort((a, b) => (a > b ? 1 : -1));

  records.save();
}

/**
 * Helper function to create a new TokenRecordsWrapper object.
 *
 * @param id
 * @param blockNumber
 * @returns
 */
export function newTokenRecordsWrapper(id: string, blockNumber: BigInt): TokenRecordsWrapper {
  const records = new TokenRecordsWrapper(id + "-" + blockNumber.toString());
  records.records = [];
  records.balance = BigDecimal.fromString("0");
  records.value = BigDecimal.fromString("0");
  records.save();

  return records;
}

/**
 * Combines {metricName} with {addition}
 *
 * @param metricName \
 * @param addition
 * @returns
 */
export function addToMetricName(metricName: string, addition: string): string {
  return metricName + "/" + addition;
}
