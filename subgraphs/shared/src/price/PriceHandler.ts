import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

// Prettier is disabled for this file, as PriceLookup will cause compilation problems after wrapping
// https://github.com/AssemblyScript/assemblyscript/issues/2509

export class PriceLookupResult {
  liquidity: BigDecimal;
  price: BigDecimal;
}

/**
 * Base function for doing price lookups.
 *
 * This should be implemented for each network and include the following:
 * - inject the array of PriceHandler objects
 * - loop through PriceHandler objects and look up prices
 * - skip any handlers with getId() == currentPool
 *
 * The returned type enables the calling function to choose between the results of different
 * price handlers. For example, choosing the result with greater liquidity.
 *
 * @param tokenAddress
 * @param block
 * @param currentPool the id of the current pool, using getId()
 * @returns PriceLookupResult
 */
export type PriceLookup = (tokenAddress: string, block: BigInt, currentPool: string | null) => PriceLookupResult | null;

/**
 * Defines how to determine the price of particular tokens, by mapping them to
 * a liquidity pool.
 */
export interface PriceHandler {
  /**
   * Returns a unique identifier for the PriceHandler.
   */
  getId(): string;

  /**
   * @returns true if the liquidity pool exists at the current block
   */
  exists(): boolean;

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
   * @returns PriceLookupResult or null
   */
  getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null;

  /**
   * Returns the total value of the liquidity pool.
   *
   * @param excludedTokens if specified, the total value will exclude the value of these tokens
   * @param priceLookup function to perform price lookups
   * @param block
   */
  getTotalValue(excludedTokens: string[], priceLookup: PriceLookup, block: BigInt): BigDecimal | null;

  /**
   * Returns the unit price of the liquidity pool.
   *
   * @param priceLookup
   * @param block
   */
  getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null;

  /**
   * Returns the balance of the liquidity pool held by {walletAddress}.
   *
   * @param walletAddress
   * @param block
   */
  getBalance(walletAddress: string, block: BigInt): BigDecimal;

  /**
   * Returns the balance of the underlying token held by the liquidity pool.
   *
   * @param tokenAddress
   * @param block
   */
  getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal;
}
