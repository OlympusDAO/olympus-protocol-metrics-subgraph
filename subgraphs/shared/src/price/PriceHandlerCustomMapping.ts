import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ContractNameLookup } from "../contracts/ContractLookup";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

/**
 * Class for mapping the price of one or more tokens to the price of another.
 *
 * For example, pegging the price of sKLIMA to that of KLIMA.
 */
export class PriceHandlerCustomMapping implements PriceHandler {
  protected tokenAddress: string;
  protected mappedTokenAddresses: string[];
  protected contractLookup: ContractNameLookup;

  constructor(
    tokenAddress: string,
    mappedTokenAddresses: string[],
    contractLookup: ContractNameLookup,
  ) {
    this.tokenAddress = tokenAddress;
    this.mappedTokenAddresses = mappedTokenAddresses;
    this.contractLookup = contractLookup;
  }

  getId(): string {
    return `${this.tokenAddress}-${this.mappedTokenAddresses.join("/")}`;
  }

  exists(): boolean {
    return true;
  }

  matches(tokenAddress: string): boolean {
    return arrayIncludesLoose(this.mappedTokenAddresses, tokenAddress);
  }

  getTokens(): string[] {
    return this.mappedTokenAddresses;
  }

  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    block: BigInt,
  ): PriceLookupResult | null {
    return priceLookup(this.tokenAddress, block, null);
  }

  getTotalValue(
    _excludedTokens: string[],
    _priceLookup: PriceLookup,
    _block: BigInt,
  ): BigDecimal | null {
    // TODO implement
    return BigDecimal.zero();
  }

  getUnitPrice(_priceLookup: PriceLookup, _block: BigInt): BigDecimal | null {
    // TODO implement
    return BigDecimal.zero();
  }

  getBalance(_walletAddress: string, _block: BigInt): BigDecimal {
    // TODO implement
    return BigDecimal.zero();
  }

  getUnderlyingTokenBalance(_walletAddress: string, _tokenAddress: string, _block: BigInt): BigDecimal {
    throw new Error("Method not implemented.");
  }
}
