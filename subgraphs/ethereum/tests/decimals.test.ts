import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../../common/src/utils/Decimals";

describe("toDecimal", () => {
  test("applies default decimal places", () => {
    const integer = BigInt.fromString("10000000000000000000");

    assert.stringEquals(toDecimal(integer).toString(), "10");
  });

  test("applies custom decimal places", () => {
    const integer = BigInt.fromString("10000000000000000000");

    assert.stringEquals(toDecimal(integer, 17).toString(), "100");
  });

  test("handles decimal values", () => {
    const integer = BigInt.fromString("10123000000000000000");

    assert.stringEquals(toDecimal(integer).toString(), "10.123");
  });
});

describe("toBigInt", () => {
  test("applies default decimal places", () => {
    const decimal = BigDecimal.fromString("10");

    assert.stringEquals(toBigInt(decimal).toString(), "10000000000000000000");
  });

  test("applies custom decimal places", () => {
    const decimal = BigDecimal.fromString("10");

    assert.stringEquals(toBigInt(decimal, 4).toString(), "100000");
  });

  test("handles decimal values", () => {
    const decimal = BigDecimal.fromString("10.1234");

    assert.stringEquals(toBigInt(decimal).toString(), "10123400000000000000");
  });
});
