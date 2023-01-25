import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as";

import { getDelta, getStandardDeviation } from "../src/helpers/Math";

describe("getDelta", () => {
    test("null previous value", () => {
        const currentValue: BigDecimal = BigDecimal.fromString("10.01");
        const previousValue: BigDecimal | null = null;
        const delta: BigDecimal | null = getDelta(currentValue, previousValue);

        assert.assertTrue(delta === null ? true : false);
    });

    test("zero previous value", () => {
        const currentValue: BigDecimal = BigDecimal.fromString("10.01");
        const previousValue: BigDecimal = BigDecimal.fromString("0");
        const delta: BigDecimal | null = getDelta(currentValue, previousValue);

        assert.assertTrue(delta === null ? true : false);
    });

    test("delta is accurate", () => {
        const currentValue: BigDecimal = BigDecimal.fromString("10");
        const previousValue: BigDecimal = BigDecimal.fromString("8");
        const delta: BigDecimal | null = getDelta(currentValue, previousValue);

        // (10/8) - 1 = 0.25
        const expectedDelta = currentValue.div(previousValue).minus(BigDecimal.fromString("1"));

        assert.stringEquals(expectedDelta.toString(), delta ? delta.toString() : "");
    });
});

describe("getStandardDeviation", () => {
    test("missing value", () => {
        const value = getStandardDeviation([BigDecimal.fromString("1"), BigDecimal.fromString("1.1"), BigDecimal.fromString("1.2")], 4);

        assert.assertTrue(value === null ? true : false);
    });

    test("standard deviation is accurate", () => {
        const value = getStandardDeviation([BigDecimal.fromString("1"), BigDecimal.fromString("1.1"), BigDecimal.fromString("1.2")], 3);

        // mean = 1.1
        // squared difference from mean = [(1-1.1)^2, (1.1-1.1)^2, (1.2-1.1)^2]
        // mean of squared differences = 0.0066666667
        // sqrt = 0.0816496581
        const expectedValue = "0.0816496581";

        assert.stringEquals(expectedValue.toString().slice(0, 11), value ? value.toString().slice(0, 11) : "");
    });
});