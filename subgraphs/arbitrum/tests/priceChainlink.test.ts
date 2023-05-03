import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  assert,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { ERC20_LUSD } from "../src/contracts/Constants";
import { getPrice } from "../src/price/PriceLookup";
import { mockPriceFeed } from "./chainlink";

describe("price chainlink", () => {
  test("resolves chainlink price", () => {
    const lusdPrice = BigDecimal.fromString("1.01");
    mockPriceFeed(ERC20_LUSD, lusdPrice);

    const price = getPrice(ERC20_LUSD, BigInt.fromString("1"));
    assert.stringEquals(price.toString(), lusdPrice.toString());
  });
});