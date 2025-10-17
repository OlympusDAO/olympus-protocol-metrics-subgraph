import { BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

/**
 * Simple bubble sort for string arrays (AssemblyScript compatible)
 */
function sortStringArray(arr: string[]): string[] {
  const sorted: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    sorted.push(arr[i].toLowerCase());
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = 0; j < sorted.length - i - 1; j++) {
      if (sorted[j] > sorted[j + 1]) {
        const temp = sorted[j];
        sorted[j] = sorted[j + 1];
        sorted[j + 1] = temp;
      }
    }
  }

  return sorted;
}

/**
 * Checks if a handler supports the same set of tokens as the currentPool handler.
 *
 * @param handler the handler to check
 * @param currentPoolHandler the current pool handler to compare against
 * @returns true if the handlers support the same set of tokens
 */
function hasSameTokenSet(handler: PriceHandler, currentPoolHandler: PriceHandler): boolean {
  const FUNC = "hasSameTokenSet";
  const handlerTokens = handler.getTokens();
  const currentPoolTokens = currentPoolHandler.getTokens();

  // Different lengths means different sets
  if (handlerTokens.length !== currentPoolTokens.length) {
    log.info("{}: different length", [FUNC]);
    return false;
  }

  // Sort both arrays (case-insensitive)
  const sortedHandlerTokens = sortStringArray(handlerTokens);
  const sortedCurrentPoolTokens = sortStringArray(currentPoolTokens);

  // Compare sorted arrays
  for (let i = 0; i < sortedHandlerTokens.length; i++) {
    if (sortedHandlerTokens[i].toLowerCase() != sortedCurrentPoolTokens[i].toLowerCase()) {
      log.info("{}: different values at index {}: {}, {}", [FUNC, i.toString(), sortedHandlerTokens[i], sortedCurrentPoolTokens[i]]);
      return false;
    }
  }

  return true;
}

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
  if (currentPool === null) {
    log.info("{}: currentPool is null", [FUNC]);
  }
  else {
    log.info("{}: currentPool: {}", [FUNC, currentPool]);
  }

  // Find the current pool handler for token set comparison
  let currentPoolHandler: PriceHandler | null = null;
  if (currentPool) {
    for (let j = 0; j < handlers.length; j++) {
      if (handlers[j].getId() == currentPool) {
        currentPoolHandler = handlers[j];

        const currentPoolTokens: string[] = currentPoolHandler.getTokens();
        for (let k = 0; k < currentPoolTokens.length; k++) {
          log.info("{}: current pool token at index {}: {}", [FUNC, k.toString(), currentPoolTokens[k]]);
        }

        break;
      }
    }
  }

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];
    const HANDLER = `${FUNC}: handler ${handler.getId()}`;
    log.info("{}: Checking handler", [HANDLER]);

    // If under recursion, skip the current pool and any handlers with the same token set
    if (currentPool && handler.getId() == currentPool) {
      log.info("{}: Skipping handler due to recursion (same handler)", [HANDLER]);
      continue;
    }

    // Skip handlers that support the same set of tokens as the current pool
    if (currentPoolHandler && hasSameTokenSet(handler, currentPoolHandler)) {
      log.info("{}: Skipping handler due to recursion (same token set)", [HANDLER]);
      continue;
    }

    // If the handler does not handle this token address
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
