import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { ContractNameLookup } from "../../src/contracts/ContractLookup";
import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { PriceHandlerCustomMapping } from "../../src/price/PriceHandlerCustomMapping";

const ERC20_KLIMA = "0x4e78011ce80ee02d2c3e649fb657e45898257815".toLowerCase();
const ERC20_KLIMA_STAKED = "0xb0C22d8D350C67420f06F48936654f567C73E8C8".toLowerCase();
const BLOCK = BigInt.fromString("1");

describe("getPrice", () => {
  test("returns mapped token value", () => {
    const priceLookup: PriceLookup = (_tokenAddress: string, _block: BigInt): PriceLookupResult => {
      return {
        liquidity: BigDecimal.fromString("0"),
        price: BigDecimal.fromString("1.5"),
      };
    };

    const contractLookup: ContractNameLookup = (_tokenAddress: string): string => "sKLIMA";

    const handler = new PriceHandlerCustomMapping(
      ERC20_KLIMA,
      [ERC20_KLIMA_STAKED],
      contractLookup,
    );

    // Should return the price of KLIMA
    const priceResult = handler.getPrice(ERC20_KLIMA_STAKED, priceLookup, BLOCK);
    assert.stringEquals("1.5", priceResult ? priceResult.price.toString() : "");
  });
});
