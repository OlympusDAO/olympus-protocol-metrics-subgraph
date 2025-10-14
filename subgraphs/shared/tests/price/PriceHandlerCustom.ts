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

  getTokens(): string[] {
    return [];
  }

  exists(): boolean {
    return true;
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
    _excludedTokens: string[],
    _priceLookup: PriceLookup,
    _block: BigInt,
  ): BigDecimal | null {
    throw new Error("Method not implemented.");
  }

  getUnitPrice(_priceLookup: PriceLookup, _block: BigInt): BigDecimal | null {
    throw new Error("Method not implemented.");
  }

  getBalance(_walletAddress: string, _block: BigInt): BigDecimal {
    throw new Error("Method not implemented.");
  }

  getUnderlyingTokenBalance(_walletAddress: string, _tokenAddress: string, _block: BigInt): BigDecimal {
    throw new Error("Method not implemented.");
  }
}
