import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../../shared/generated/schema";
import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../shared/src/contracts/TokenDefinition";
import {
  createOrUpdateTokenRecord,
  getTokenAddressesInCategory,
  isTokenAddressInCategory,
} from "../../shared/src/utils/TokenRecordHelper";
import {
  BLOCKCHAIN,
  ERC20_DAI,
  ERC20_TOKENS,
  ERC20_USDC,
  ERC20_WETH,
} from "../src/utils/Constants";

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
    ERC20_TOKENS,
    BLOCKCHAIN,
  );
};

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();
});

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
      ERC20_TOKENS,
      BLOCKCHAIN,
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
      ERC20_TOKENS,
      BLOCKCHAIN,
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
      ERC20_TOKENS,
      BLOCKCHAIN,
      BigDecimal.fromString("0.25"),
    );

    assert.stringEquals("6", record.value.toString());
    // 2 * 3 * 0.25
    assert.stringEquals("1.5", record.valueExcludingOhm.toString());
  });
});

describe("getTokenAddressesInCategory", () => {
  test("stablecoins", () => {
    const addresses = getTokenAddressesInCategory(TokenCategoryStable, ERC20_TOKENS);

    assert.assertTrue(addresses.includes(ERC20_DAI) == true);
    assert.assertTrue(addresses.includes(ERC20_WETH) == false);
  });

  test("volatile", () => {
    const addresses = getTokenAddressesInCategory(TokenCategoryVolatile, ERC20_TOKENS);

    assert.assertTrue(addresses.includes(ERC20_DAI) == false);
    assert.assertTrue(addresses.includes(ERC20_WETH) == true);
  });
});

describe("isTokenAddressInCategory", () => {
  test("stablecoin category, DAI", () => {
    assert.assertTrue(
      isTokenAddressInCategory(ERC20_DAI, TokenCategoryStable, ERC20_TOKENS) == true,
    );
  });

  test("stablecoin category, DAI hexString", () => {
    assert.assertTrue(
      isTokenAddressInCategory(
        Address.fromString(ERC20_DAI).toHexString(),
        TokenCategoryStable,
        ERC20_TOKENS,
      ) == true,
    );
  });

  test("stablecoin category, USDC", () => {
    assert.assertTrue(
      isTokenAddressInCategory(ERC20_USDC, TokenCategoryStable, ERC20_TOKENS) == true,
    );
  });

  test("stablecoin category, USDC toHexString", () => {
    assert.assertTrue(
      isTokenAddressInCategory(
        Address.fromString(ERC20_USDC).toHexString(),
        TokenCategoryStable,
        ERC20_TOKENS,
      ) == true,
    );
  });

  test("stablecoin category, wETH", () => {
    assert.assertTrue(
      isTokenAddressInCategory(ERC20_WETH, TokenCategoryStable, ERC20_TOKENS) == false,
    );
  });
});
