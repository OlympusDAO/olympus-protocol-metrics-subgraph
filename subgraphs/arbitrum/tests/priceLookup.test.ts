import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  assert,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { ERC20_USDC } from "../src/contracts/Constants";
import { getPrice } from "../src/price/PriceLookup";
import { mockPriceFeed } from "./chainlink";

describe("base token", () => {
  test("resolves USDC price", () => {
    const usdcPrice = BigDecimal.fromString("1.01");
    mockPriceFeed(ERC20_USDC, usdcPrice);

    const price = getPrice(ERC20_USDC, BigInt.fromString("1"));
    assert.stringEquals(price.toString(), usdcPrice.toString());
  });

  test("resolves USDC price - case-insensitive parameter to getPrice", () => {
    const usdcPrice = BigDecimal.fromString("1.01");
    mockPriceFeed(ERC20_USDC, usdcPrice);

    const price = getPrice("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", BigInt.fromString("1"));
    assert.stringEquals(price.toString(), usdcPrice.toString());
  });

  test("resolves USDC price - case-insensitive price feed", () => {
    const usdcPrice = BigDecimal.fromString("1.01");
    mockPriceFeed("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", usdcPrice);

    const price = getPrice(ERC20_USDC, BigInt.fromString("1"));
    assert.stringEquals(price.toString(), usdcPrice.toString());
  });
});