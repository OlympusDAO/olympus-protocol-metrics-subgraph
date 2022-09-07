import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";

/**
 * Price handler used in tests that will return a specific value passed into the constructor.
 */
export class PriceHandlerCustom implements PriceHandler {
  protected returnValue: PriceLookupResult;

  constructor(returnValue: PriceLookupResult) {
    this.returnValue = returnValue;
  }

  getId(): string {
    return "PriceHandlerCustom";
  }

  matches(_tokenAddress: string): boolean {
    return true;
  }

  getPrice(
    _tokenAddress: string,
    _priceLookup: PriceLookup,
    _block: BigInt,
  ): PriceLookupResult | null {
    return this.returnValue;
  }

  getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    block: BigInt,
  ): BigDecimal | null {
    throw new Error("Method not implemented.");
  }

  getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
    throw new Error("Method not implemented.");
  }
}
