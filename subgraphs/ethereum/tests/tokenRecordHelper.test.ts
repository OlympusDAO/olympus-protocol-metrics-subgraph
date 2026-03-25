import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, log, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../../shared/generated/schema";
import {
  TokenCategoryStable,
  TokenCategoryVolatile,
  TokenDefinition,
} from "../../shared/src/contracts/TokenDefinition";
import {
  createTokenRecord,
  getTokenAddressesInCategory,
  isTokenAddressInCategory,
} from "../../shared/src/utils/TokenRecordHelper";
import {
  BLOCKCHAIN,
  ERC20_ALCX,
  ERC20_DAI,
  ERC20_TOKENS,
  ERC20_USDC,
  ERC20_WETH,
} from "../src/utils/Constants";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";

const TIMESTAMP = BigInt.fromString("1");

const createSampleTokenRecord = (): TokenRecord => {
  return createTokenRecord(
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

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();
  mockClearinghouseRegistryAddressNull();
});

describe("constructor", () => {
  test("basic values", () => {
    const record = createSampleTokenRecord();

    assert.stringEquals("name", record.token);
    assert.stringEquals("tokenAddress", record.tokenAddress);
    assert.stringEquals("source", record.source);
    assert.stringEquals("address", record.sourceAddress);
    assert.stringEquals("2", record.rate.toString());
    assert.stringEquals("3", record.balance.toString());
    assert.stringEquals("1", record.multiplier.toString());
  });

  test("custom multiplier", () => {
    const record = createTokenRecord(
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
    const record = createSampleTokenRecord();

    // Creating the record will set the value
    // 2 * 3 * 1
    assert.stringEquals("6", record.value.toString());
    assert.stringEquals("6", record.valueExcludingOhm.toString());
  });
});

describe("value", () => {
  test("multiplier = 1", () => {
    const record = createTokenRecord(
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
    const record = createTokenRecord(
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

  test("liquidBackingMultiplier specified", () => {
    const tokenDefinitions = new Map<string, TokenDefinition>();
    tokenDefinitions.set(
      ERC20_ALCX,
      new TokenDefinition(
        ERC20_ALCX,
        TokenCategoryVolatile,
        true,
        false,
        BigDecimal.fromString("0.5"),
      ),
    );

    const record = createTokenRecord(
      TIMESTAMP,
      "name",
      ERC20_ALCX,
      "source",
      "address",
      BigDecimal.fromString("2"),
      BigDecimal.fromString("3"),
      BigInt.fromString("1"),
      true,
      tokenDefinitions,
      BLOCKCHAIN,
    );

    // 2 * 3 * 1
    assert.stringEquals("6", record.value.toString());
    // 2 * 3 * 1 * 0.5
    assert.stringEquals("3", record.valueExcludingOhm.toString());
  });

  test("liquidBackingMultiplier specified, nonOhmMultiplier overrides", () => {
    const tokenDefinitions = new Map<string, TokenDefinition>();
    tokenDefinitions.set(
      ERC20_ALCX,
      new TokenDefinition(
        ERC20_ALCX,
        TokenCategoryVolatile,
        true,
        false,
        BigDecimal.fromString("0.5"),
      ),
    );

    const record = createTokenRecord(
      TIMESTAMP,
      "name",
      ERC20_ALCX,
      "source",
      "address",
      BigDecimal.fromString("2"),
      BigDecimal.fromString("3"),
      BigInt.fromString("1"),
      true,
      tokenDefinitions,
      BLOCKCHAIN,
      BigDecimal.fromString("0.75"),
    );

    // 2 * 3 * 1
    assert.stringEquals("6", record.value.toString());
    // 2 * 3 * 1 * 0.75
    assert.stringEquals("4.5", record.valueExcludingOhm.toString());
  });

  test("liquidBackingMultiplier is positive in TokenRecord", () => {
    const tokenDefinitions = new Map<string, TokenDefinition>();
    tokenDefinitions.set(
      ERC20_ALCX,
      new TokenDefinition(
        ERC20_ALCX,
        TokenCategoryStable,
        true,
        false,
        BigDecimal.fromString("0.5"),
        false,
      ),
    );

    const record = createTokenRecord(
      TIMESTAMP,
      "Token",
      ERC20_ALCX,
      "source",
      "address",
      BigDecimal.fromString("1"),
      BigDecimal.fromString("100"),
      BigInt.fromString("1"),
      true,
      tokenDefinitions,
      BLOCKCHAIN,
    );

    assert.stringEquals("0.5", record.multiplier.toString());
    assert.stringEquals("100", record.value.toString());
    assert.stringEquals("50", record.valueExcludingOhm.toString());
  });

  test("isLiability with multiplier: both values negative, multiplier only on valueExcludingOhm", () => {
    const tokenDefinitions = new Map<string, TokenDefinition>();
    tokenDefinitions.set(
      ERC20_ALCX,
      new TokenDefinition(
        ERC20_ALCX,
        TokenCategoryStable,
        true,
        false,
        BigDecimal.fromString("0.5"),
        true,
      ),
    );

    const record = createTokenRecord(
      TIMESTAMP,
      "Variable Debt",
      ERC20_ALCX,
      "source",
      "address",
      BigDecimal.fromString("1"),
      BigDecimal.fromString("100"),
      BigInt.fromString("1"),
      true,
      tokenDefinitions,
      BLOCKCHAIN,
    );

    assert.stringEquals("0.5", record.multiplier.toString());
    assert.stringEquals("-100", record.value.toString());
    assert.stringEquals("-50", record.valueExcludingOhm.toString());
  });

  test("isLiability with no multiplier: both values negative, multiplier = 1", () => {
    const tokenDefinitions = new Map<string, TokenDefinition>();
    tokenDefinitions.set(
      ERC20_ALCX,
      new TokenDefinition(ERC20_ALCX, TokenCategoryStable, true, false, null, true),
    );

    const record = createTokenRecord(
      TIMESTAMP,
      "Variable Debt",
      ERC20_ALCX,
      "source",
      "address",
      BigDecimal.fromString("1"),
      BigDecimal.fromString("100"),
      BigInt.fromString("1"),
      true,
      tokenDefinitions,
      BLOCKCHAIN,
    );

    assert.stringEquals("1", record.multiplier.toString());
    assert.stringEquals("-100", record.value.toString());
    assert.stringEquals("-100", record.valueExcludingOhm.toString());
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

describe("TokenDefinition multiplier validation", () => {
  test("accepts null multiplier", () => {
    const def = new TokenDefinition(ERC20_DAI, TokenCategoryStable, true, false, null, false);
    assert.assertTrue(def.getLiquidBackingMultiplier() === null);
  });

  test("accepts zero multiplier", () => {
    const def = new TokenDefinition(
      ERC20_DAI,
      TokenCategoryStable,
      true,
      false,
      BigDecimal.fromString("0"),
      false,
    );
    assert.stringEquals("0", def.getLiquidBackingMultiplier()!.toString());
  });

  test("accepts positive multiplier", () => {
    const def = new TokenDefinition(
      ERC20_DAI,
      TokenCategoryStable,
      true,
      false,
      BigDecimal.fromString("0.5"),
      false,
    );
    assert.stringEquals("0.5", def.getLiquidBackingMultiplier()!.toString());
  });
});
