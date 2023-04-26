import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ContractNameLookup } from "../contracts/ContractLookup";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

/**
 * Dummy PriceHandler instance to return a value of 1 for the stablecoins specified in the constructor.
 */
export class PriceHandlerStablecoin implements PriceHandler {
  protected addresses: string[];
  protected contractLookup: ContractNameLookup;

  constructor(addresses: string[], contractLookup: ContractNameLookup) {
    this.addresses = addresses;
    this.contractLookup = contractLookup;
  }
  getId(): string {
    return "PriceHandlerStablecoin";
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

  getTotalValue(
    _excludedTokens: string[],
    _priceLookup: PriceLookup,
    _block: BigInt,
  ): BigDecimal | null {
    return null;
  }

  getUnitPrice(_priceLookup: PriceLookup, _block: BigInt): BigDecimal | null {
    return null;
  }

  getBalance(_walletAddress: string, _block: BigInt): BigDecimal {
    return BigDecimal.zero();
  }

  getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
    throw new Error("Method not implemented.");
  }
}
