import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

/**
 * Defines how to determine the price of particular tokens, by mapping them to
 * a liquidity pool.
 */
export interface PriceHandler {
  /**
   * @returns true if {tokenAddress} can be handled
   */
  matches(tokenAddress: string): boolean;

  /**
   * Determines the price of {tokenAddress} in USD.
   *
   * Implementations will support the price lookup of tokens other than {tokenAddress}
   * through the {priceLookup} argument. This enables recursion without hard-coding
   * a specific file.
   *
   * @param tokenAddress
   * @param priceLookup pass in a function to perform a price lookup for other tokens
   * @param block
   * @returns BigDecimal
   */
  getPrice(
    tokenAddress: string,
    priceLookup: (inAddress: string, inBlock: BigInt) => BigDecimal,
    block: BigInt,
  ): BigDecimal;
}
