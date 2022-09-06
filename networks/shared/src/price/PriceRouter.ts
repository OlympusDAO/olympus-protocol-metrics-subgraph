import { BigInt } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

/**
 * Returns the rate of {tokenAddress} in USD.
 *
 * The {priceLookup} function is passed in to allow for recursive lookups of
 * tokens. e.g. for an OHM-ETH pair, in order to find out the price of OHM,
 * the price of ETH would need to be determined first.
 *
 * @param tokenAddress
 * @param handlers a list of price handlers
 * @param priceLookup
 * @param block
 * @returns PriceLookupResult or null
 */
export function getUSDRate(
  tokenAddress: string,
  handlers: PriceHandler[],
  priceLookup: PriceLookup,
  block: BigInt,
): PriceLookupResult | null {
  let finalPriceResult: PriceLookupResult | null = null;

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];

    if (!handler.matches(tokenAddress)) {
      continue;
    }

    const priceResult = handler.getPrice(tokenAddress, priceLookup, block);
    if (!priceResult) {
      continue;
    }

    // If there's no value set, set it and continue
    if (!finalPriceResult) {
      finalPriceResult = priceResult;
      continue;
    }

    // If the liquidity of the previous result is higher, skip the current one
    if (finalPriceResult.liquidity.gt(priceResult.liquidity)) {
      continue;
    }

    finalPriceResult = priceResult;
  }

  return finalPriceResult ? finalPriceResult : null;
}
