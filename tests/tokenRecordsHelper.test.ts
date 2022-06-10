import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord, TokenRecords } from "../generated/schema";
import {
  combineTokenRecords,
  getTokenRecordsBalance,
  getTokenRecordsValue,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
  setTokenRecordsMultiplier,
  sortTokenRecords,
} from "../src/utils/TokenRecordHelper";

const createTokenRecord = (): TokenRecord => {
  return newTokenRecord(
    "name",
    "source",
    "address",
    BigDecimal.fromString("2"),
    BigDecimal.fromString("3"),
  );
};

describe("constructor", () => {
  test("id not null", () => {
    const records = newTokenRecords("test");

    assert.assertNotNull(records.id);
    assert.assertNotNull(records.records);
  });
});

describe("push", () => {
  test("single", () => {
    const records = newTokenRecords("test");
    const record1 = createTokenRecord();

    pushTokenRecord(records, record1);

    assert.i32Equals(1, records.records.length);
    // Updates value
    assert.stringEquals("6", records.value.toString());
    // Updates balance
    assert.stringEquals("3", records.balance.toString());
  });

  test("multiple", () => {
    const records = newTokenRecords("test");
    const record1 = createTokenRecord();
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );

    pushTokenRecord(records, record1);
    pushTokenRecord(records, record2);

    assert.i32Equals(2, records.records.length);
  });
});

describe("combine", () => {
  test("non-empty", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    pushTokenRecord(records1, record1);

    const records2 = newTokenRecords("test");
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );
    pushTokenRecord(records2, record2);

    combineTokenRecords(records1, records2);

    assert.i32Equals(2, records1.records.length);
    // Updates value: 2*3 + 10*5
    assert.stringEquals("56", records1.value.toString());
    // Updates balance
    assert.stringEquals("8", records1.balance.toString());
  });

  test("empty", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    pushTokenRecord(records1, record1);

    const records2 = newTokenRecords("test");

    combineTokenRecords(records1, records2);

    assert.i32Equals(1, records1.records.length);
  });
});

describe("multiplier", () => {
  test("records updated", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    setTokenRecordsMultiplier(records1, BigDecimal.fromString("0.25"));

    const record1Updated = TokenRecord.load(record1.id);
    const record2Updated = TokenRecord.load(record2.id);
    assert.stringEquals("0.25", record1Updated ? record1Updated.multiplier.toString() : "");
    assert.stringEquals("0.25", record2Updated ? record2Updated.multiplier.toString() : "");

    const recordsUpdated = TokenRecords.load(records1.id);
    // 10 * 5 * 0.25 + 2 * 3 * 0.25
    assert.stringEquals("14", recordsUpdated ? recordsUpdated.value.toString() : "");
  });
});

describe("balance", () => {
  test("records updated", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    // 3 + 5
    assert.stringEquals("8", getTokenRecordsBalance(records1).toString());
  });
});

describe("value", () => {
  test("correct", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );
    pushTokenRecord(records1, record1);
    pushTokenRecord(records1, record2);

    // 2*3 + 10*5
    assert.stringEquals("56", getTokenRecordsValue(records1).toString());
  });
});

describe("sorted records", () => {
  test("correct", () => {
    const records1 = newTokenRecords("test");
    const record1 = createTokenRecord();
    const record2 = newTokenRecord(
      "name2",
      "source2",
      "sourceAdd2",
      BigDecimal.fromString("10"),
      BigDecimal.fromString("5"),
    );
    pushTokenRecord(records1, record2); // name2 before name
    pushTokenRecord(records1, record1);

    sortTokenRecords(records1);
    assert.stringEquals("name-source", records1.records[0]);
    assert.stringEquals("name2-source2", records1.records[1]);
  });
});
