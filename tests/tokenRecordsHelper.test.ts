import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import { createOrUpdateTokenRecord } from "../src/utils/TokenRecordHelper";

const createTokenRecord = (): TokenRecord => {
  return createOrUpdateTokenRecord(
    "metric",
    "name",
    "tokenAddress",
    "source",
    "address",
    BigDecimal.fromString("2"),
    BigDecimal.fromString("3"),
    BigInt.fromString("1"),
  );
};

describe("constructor", () => {
  test("id not null", () => {
    const records = newTokenRecordsWrapper("test", BigInt.fromString("1"));

    assert.assertNotNull(records.id);
    assert.assertNotNull(records.records);
  });
});

describe("push", () => {
  test("single", () => {
    const records = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();

    pushTokenRecord(records, record1);

    assert.i32Equals(1, records.records.length);
    // Updates value
    assert.stringEquals("6", records.value.toString());
    // Updates balance
    assert.stringEquals("3", records.balance.toString());
  });

  test("multiple", () => {
    const records = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );

    pushTokenRecord(records, record1);
    pushTokenRecord(records, record2);

    assert.i32Equals(2, records.records.length);
  });

  test("multiple, same id", () => {
    const records = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createTokenRecord();
    setTokenRecordMultiplier(record2, BigDecimal.fromString("2")); // Same id, different value

    pushTokenRecord(records, record1);
    pushTokenRecord(records, record2);

    assert.i32Equals(1, records.records.length);
    // record2 will overwrite record1
    const fetchedRecord = TokenRecord.load(records.records[0]);
    assert.stringEquals("2", fetchedRecord ? fetchedRecord.multiplier.toString() : "");
  });
});

describe("combine", () => {
  test("non-empty", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    pushTokenRecord(records1, record1);

    const records2 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );
    pushTokenRecord(records2, record2);

    combineTokenRecordsWrapper(records1, records2);

    assert.i32Equals(2, records1.records.length);
    // Updates value: 2*3 + 10*5
    assert.stringEquals("56", records1.value.toString());
    // Updates balance
    assert.stringEquals("8", records1.balance.toString());
  });

  test("empty", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    pushTokenRecord(records1, record1);

    const records2 = newTokenRecordsWrapper("test", BigInt.fromString("1"));

    combineTokenRecordsWrapper(records1, records2);

    assert.i32Equals(1, records1.records.length);
  });
});

describe("multiplier", () => {
  test("push, records updated", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    setTokenRecordsWrapperMultiplier(records1, BigDecimal.fromString("0.25"));

    const record1Updated = TokenRecord.load(record1.id);
    const record2Updated = TokenRecord.load(record2.id);
    assert.stringEquals("0.25", record1Updated ? record1Updated.multiplier.toString() : "");
    assert.stringEquals("0.25", record2Updated ? record2Updated.multiplier.toString() : "");

    const recordsUpdated = TokenRecordsWrapper.load(records1.id);
    // 10 * 5 * 0.25 + 2 * 3 * 0.25
    assert.stringEquals("14", recordsUpdated ? recordsUpdated.value.toString() : "");
  });

  test("combine, records updated", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddres2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );

    const records2 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    pushTokenRecord(records2, record1);
    pushTokenRecord(records2, record2);
    setTokenRecordsWrapperMultiplier(records2, BigDecimal.fromString("0.25"));

    combineTokenRecordsWrapper(records1, records2);

    // 10 * 5 * 0.25 + 2 * 3 * 0.25
    assert.stringEquals("14", records1.value.toString());

    // Individual values are consistent
    let totalValue = BigDecimal.fromString("0");
    for (let i = 0; i < records1.records.length; i++) {
      const currentId = records1.records[i];
      const currentRecord = TokenRecord.load(currentId);
      if (!currentRecord) continue;

      totalValue = totalValue.plus(currentRecord.value);
    }

    assert.stringEquals(records1.value.toString(), totalValue.toString());
  });
});

describe("balance", () => {
  test("records updated", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    // 3 + 5
    assert.stringEquals("8", getTokenRecordsWrapperBalance(records1).toString());
  });
});

describe("value", () => {
  test("correct", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    // 2*3 + 10*5
    assert.stringEquals("56", getTokenRecordsWrapperValue(records1).toString());
  });
});

describe("sorted records", () => {
  test("correct", () => {
    const records1 = newTokenRecordsWrapper("test", BigInt.fromString("1"));
    const record1 = createTokenRecord();
    const record2 = createOrUpdateTokenRecord(
      "metric",
      "name2",
      "tokenAddress2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
      BigInt.fromString("1"),
    );
    pushTokenRecord(records1, record2); // name2 before name
    pushTokenRecord(records1, record1);

    sortTokenRecordsWrapper(records1);
    assert.stringEquals("metric-name-source-1", records1.records[0]);
    assert.stringEquals("metric-name2-source2-1", records1.records[1]);
  });
});
