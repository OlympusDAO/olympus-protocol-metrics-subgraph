import type { PriceHandler, PriceLookupResult } from "./types";

/**
 * Checks if two handlers cover the same set of tokens (case-insensitive).
 */
function hasSameTokenSet(a: PriceHandler, b: PriceHandler): boolean {
  const aTokens = a.getTokens().map((t) => t.toLowerCase()).sort();
  const bTokens = b.getTokens().map((t) => t.toLowerCase()).sort();

  if (aTokens.length !== bTokens.length) return false;
  return aTokens.every((t, i) => t === bTokens[i]);
}

/**
 * Port of PriceRouter.getUSDRate from AssemblyScript.
 *
 * Iterates all handlers, skipping:
 * 1. The handler with the same ID as currentPool (direct recursion guard)
 * 2. Any handler with the same token set as the current pool (indirect recursion guard)
 *
 * Among matching handlers, selects the one with the highest liquidity.
 */
export function getUSDRate(
  tokenAddress: string,
  handlers: PriceHandler[],
  priceLookup: (
    tokenAddress: string,
    blockNumber: bigint,
    currentPool: string | null,
  ) => Promise<PriceLookupResult | null>,
  blockNumber: bigint,
  client: any,
  currentPool: string | null = null,
): Promise<PriceLookupResult | null> {
  return _getUSDRate(tokenAddress, handlers, priceLookup, blockNumber, client, currentPool);
}

async function _getUSDRate(
  tokenAddress: string,
  handlers: PriceHandler[],
  priceLookup: (
    tokenAddress: string,
    blockNumber: bigint,
    currentPool: string | null,
  ) => Promise<PriceLookupResult | null>,
  blockNumber: bigint,
  client: any,
  currentPool: string | null,
): Promise<PriceLookupResult | null> {
  let finalResult: PriceLookupResult | null = null;

  // Find the current pool handler for token set comparison
  let currentPoolHandler: PriceHandler | null = null;
  if (currentPool) {
    for (const handler of handlers) {
      if (handler.getId() === currentPool) {
        currentPoolHandler = handler;
        break;
      }
    }
  }

  for (const handler of handlers) {
    // Skip the current pool (direct recursion)
    if (currentPool && handler.getId() === currentPool) {
      continue;
    }

    // Skip handlers with the same token set (indirect recursion)
    if (currentPoolHandler && hasSameTokenSet(handler, currentPoolHandler)) {
      continue;
    }

    // Skip if handler doesn't cover this token
    if (!handler.matches(tokenAddress)) {
      continue;
    }

    const result = await handler.getPrice(tokenAddress, priceLookup, blockNumber, client);
    if (!result) continue;

    // Select the result with the highest liquidity
    if (!finalResult || result.liquidity > finalResult.liquidity) {
      finalResult = result;
    }
  }

  return finalResult;
}
