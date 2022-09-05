import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ContractNameLookup } from "../contracts/ContractLookup";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

export class PriceHandlerStablecoin implements PriceHandler {
  protected addresses: string[];
  protected contractLookup: ContractNameLookup;

  constructor(addresses: string[], contractLookup: ContractNameLookup) {
    this.addresses = addresses;
    this.contractLookup = contractLookup;
  }

  matches(tokenAddress: string): boolean {
    return arrayIncludesLoose(this.addresses, tokenAddress);
  }

  getPrice(tokenAddress: string, _priceLookup: PriceLookup, _block: BigInt): PriceLookupResult {
    if (!this.matches(tokenAddress)) {
      throw new Error(
        `Attempted to look up unsupported token ${this.contractLookup(
          tokenAddress,
        )} (${tokenAddress})`,
      );
    }

    return {
      price: BigDecimal.fromString("1"),
      liquidity: BigDecimal.fromString("0"), // TODO consider setting liquidity
    };
  }
}
