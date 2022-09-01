import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import { ERC20_DAI, ERC20_USDC, ERC20_WETH } from "../src/utils/Constants";
import { TokenCategoryStable, TokenCategoryVolatile } from "../src/utils/TokenDefinition";
import {
  createOrUpdateTokenRecord,
  getTokenAddressesInCategory,
  isTokenAddressInCategory,
} from "../src/utils/TokenRecordHelper";

const TIMESTAMP = BigInt.fromString("1");

const createTokenRecord = (): TokenRecord => {
  return createOrUpdateTokenRecord(
    TIMESTAMP,
    "name",
    "tokenAddress",
    "source",
    "address",
    BigDecimal.fromString("2"),
    BigDecimal.fromString("3"),
    BigInt.fromString("1"),
    true,
  );
};

describe("constructor", () => {
  test("basic values", () => {
    const record = createTokenRecord();

    assert.stringEquals("1970-01-01/source/name", record.id);
    assert.stringEquals("name", record.token);
    assert.stringEquals("tokenAddress", record.tokenAddress);
    assert.stringEquals("source", record.source);
    assert.stringEquals("address", record.sourceAddress);
    assert.stringEquals("2", record.rate.toString());
    assert.stringEquals("3", record.balance.toString());
    assert.stringEquals("1", record.multiplier.toString());
  });

  test("custom multiplier", () => {
    const record = createOrUpdateTokenRecord(
      TIMESTAMP,
      "name",
      "tokenAddress",
      "source",
      "address",
      BigDecimal.fromString("2"),
      BigDecimal.fromString("3"),
      BigInt.fromString("1"),
      true,
      BigDecimal.fromString("0.25"),
    );

    assert.stringEquals("0.25", record.multiplier.toString());
  });

  test("sets value", () => {
    const record = createTokenRecord();

    // Creating the record will set the value
    // 2 * 3 * 1
    assert.stringEquals("6", record.value.toString());
    assert.stringEquals("6", record.valueExcludingOhm.toString());
  });
});

describe("value", () => {
  test("multiplier = 1", () => {
    const record = createOrUpdateTokenRecord(
      TIMESTAMP,
      "name",
      "tokenAddress",
      "source",
      "address",
      BigDecimal.fromString("2"),
      BigDecimal.fromString("3"),
      BigInt.fromString("1"),
      true,
    );

    // 2 * 3 * 1
    assert.stringEquals("6", record.value.toString());
    assert.stringEquals("6", record.valueExcludingOhm.toString());
  });

  test("multiplier = 0.25", () => {
    const record = createOrUpdateTokenRecord(
      TIMESTAMP,
      "name",
      "tokenAddress",
      "source",
      "address",
      BigDecimal.fromString("2"),
      BigDecimal.fromString("3"),
      BigInt.fromString("1"),
      true,
      BigDecimal.fromString("0.25"),
    );

    assert.stringEquals("6", record.value.toString());
    // 2 * 3 * 0.25
    assert.stringEquals("1.5", record.valueExcludingOhm.toString());
  });
});

describe("getTokenAddressesInCategory", () => {
  test("stablecoins", () => {
    const addresses = getTokenAddressesInCategory(TokenCategoryStable);

    assert.assertTrue(addresses.includes(ERC20_DAI) == true);
    assert.assertTrue(addresses.includes(ERC20_WETH) == false);
  });

  test("volatile", () => {
    const addresses = getTokenAddressesInCategory(TokenCategoryVolatile);

    assert.assertTrue(addresses.includes(ERC20_DAI) == false);
    assert.assertTrue(addresses.includes(ERC20_WETH) == true);
  });
});

describe("isTokenAddressInCategory", () => {
  test("stablecoin category, DAI", () => {
    assert.assertTrue(isTokenAddressInCategory(ERC20_DAI, TokenCategoryStable) == true);
  });

  test("stablecoin category, DAI hexString", () => {
    assert.assertTrue(
      isTokenAddressInCategory(Address.fromString(ERC20_DAI).toHexString(), TokenCategoryStable) ==
        true,
    );
  });

  test("stablecoin category, USDC", () => {
    assert.assertTrue(isTokenAddressInCategory(ERC20_USDC, TokenCategoryStable) == true);
  });

  test("stablecoin category, USDC toHexString", () => {
    assert.assertTrue(
      isTokenAddressInCategory(Address.fromString(ERC20_USDC).toHexString(), TokenCategoryStable) ==
        true,
    );
  });

  test("stablecoin category, wETH", () => {
    assert.assertTrue(isTokenAddressInCategory(ERC20_WETH, TokenCategoryStable) == false);
  });
});
