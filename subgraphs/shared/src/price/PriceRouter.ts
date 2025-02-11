import { BigInt, log } from "@graphprotocol/graph-ts";

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
  currentPool: string | null = null,
): PriceLookupResult | null {
  const FUNC = `getUSDRate: ${tokenAddress}`;
  let finalPriceResult: PriceLookupResult | null = null;
  log.info("{}: Getting USD rate", [FUNC]);

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];
    const HANDLER = `${FUNC}: handler ${handler.getId()}`;
    log.info("{}: Checking handler", [HANDLER]);

    // If under recursion, skip the current pool
    if (currentPool && handler.getId() == currentPool) {
      log.info("{}: Skipping handler due to recursion", [HANDLER]);
      continue;
    }

    if (!handler.matches(tokenAddress)) {
      log.info("{}: Skipping handler due to token mismatch", [HANDLER]);
      continue;
    }

    const priceResult = handler.getPrice(tokenAddress, priceLookup, block);
    if (!priceResult) {
      log.info("{}: Skipping handler due to no price result", [HANDLER]);
      continue;
    }

    // If there's no value set, set it and continue
    if (!finalPriceResult) {
      log.info("{}: Setting first price result: {}", [HANDLER, priceResult.price.toString()]);
      finalPriceResult = priceResult;
      continue;
    }

    // If the liquidity of the previous result is higher, skip the current one
    if (finalPriceResult.liquidity.gt(priceResult.liquidity)) {
      log.info("{}: Skipping handler due to lower liquidity", [HANDLER]);
      continue;
    }

    log.info("{}: Setting highest price result: {}", [HANDLER, priceResult.price.toString()]);
    finalPriceResult = priceResult;
  }

  return finalPriceResult ? finalPriceResult : null;
}
