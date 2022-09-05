import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { getUSDRate } from "../../src/price/PriceRouter";
import { PriceHandlerCustom } from "./PriceHandlerCustom";

const TOKEN = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5"; // OHM V2

describe("getUSDRate", () => {
  test("no handlers", () => {
    const priceLookup: PriceLookup = (
      _address: string,
      _block: BigInt,
    ): PriceLookupResult | null => {
      return null;
    };

    const result: BigDecimal | null = getUSDRate(TOKEN, [], priceLookup, BigInt.fromString("1"));
    assert.assertTrue(result === null);
  });

  test("one handler", () => {
    const priceLookup: PriceLookup = (
      _address: string,
      _block: BigInt,
    ): PriceLookupResult | null => {
      return {
        price: BigDecimal.fromString("1"),
        liquidity: BigDecimal.fromString("1"),
      };
    };

    const customHandler = new PriceHandlerCustom({
      price: BigDecimal.fromString("1.234"),
      liquidity: BigDecimal.fromString("222222"),
    });

    const result = getUSDRate(TOKEN, [customHandler], priceLookup, BigInt.fromString("1"));
    assert.stringEquals("1.234", result ? result.toString() : "");
  });

  test("chooses highest liquidity", () => {
    const priceLookup: PriceLookup = (
      _address: string,
      _block: BigInt,
    ): PriceLookupResult | null => {
      return {
        price: BigDecimal.fromString("1"),
        liquidity: BigDecimal.fromString("1"),
      };
    };

    const customHandler = new PriceHandlerCustom({
      price: BigDecimal.fromString("1.5"),
      liquidity: BigDecimal.fromString("222222"),
    });

    const customHandlerTwo = new PriceHandlerCustom({
      price: BigDecimal.fromString("1.234"),
      liquidity: BigDecimal.fromString("222223"), // Higher
    });

    const result = getUSDRate(
      TOKEN,
      [customHandler, customHandlerTwo],
      priceLookup,
      BigInt.fromString("1"),
    );
    // customHandlerTwo is selected, due to the higher liquidity
    assert.stringEquals("1.234", result ? result.toString() : "");
  });
});
