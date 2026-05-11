import type BigNumber from "bignumber.js";
import { AsyncLocalStorage } from "node:async_hooks";
import type { PublicClient } from "viem";

import { getBaseTokenRate } from "./contracts";
import { isActive, ZERO } from "./math";
import { createPriceHandler } from "./price-handlers";
import type { ChainConfig, LiquidityHandler } from "./types";

const pricingCacheStorage = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export async function withPricingCache<T>(operation: () => Promise<T>): Promise<T> {
  return pricingCacheStorage.run(new Map(), operation);
}

export async function getPrice(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<BigNumber> {
  return cachedPricingLookup(
    ["price", config.chainId, blockNumber.toString(), tokenAddress, currentPool],
    () => derivePrice(config, client, tokenAddress, blockNumber, currentPool),
  );
}

async function derivePrice(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<BigNumber> {
  const token = config.tokens.find((value) => value.address === tokenAddress.toLowerCase());
  if (token && !isActive(token, blockNumber)) return ZERO;
  const base = await getBaseTokenRate(config, client, tokenAddress, blockNumber);
  if (base) return base;

  const currentPoolHandler =
    currentPool === null
      ? null
      : (config.liquidityHandlers.find((handler) => handler.id === currentPool) ?? null);
  let selectedPrice: BigNumber | null = null;
  let selectedLiquidity: BigNumber | null = null;

  for (const handlerConfig of config.liquidityHandlers) {
    if (!isActive(handlerConfig, blockNumber)) continue;
    const handler = createPriceHandler(config, client, handlerConfig);
    if (!handler.matches(tokenAddress)) continue;
    if (handler.getId() === currentPool) continue;
    if (currentPoolHandler && hasSameTokenSet(handlerConfig, currentPoolHandler)) continue;

    const price = await handler.getPrice(
      tokenAddress,
      (lookupToken, lookupBlock, lookupPool) =>
        getPrice(config, client, lookupToken, lookupBlock, lookupPool),
      blockNumber,
    );
    if (!price) continue;
    if (selectedLiquidity?.gt(price.liquidity)) continue;
    selectedPrice = price.price;
    selectedLiquidity = price.liquidity;
  }
  return selectedPrice ?? ZERO;
}

export async function getTotalValue(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  excludedTokens: string[],
  blockNumber: bigint,
) {
  return cachedPricingLookup(
    [
      "totalValue",
      config.chainId,
      blockNumber.toString(),
      handler.kind,
      handler.id,
      [...excludedTokens].map((token) => token.toLowerCase()).sort(),
    ],
    () =>
      createPriceHandler(config, client, handler).getTotalValue(
        excludedTokens,
        (lookupToken, lookupBlock, lookupPool) =>
          getPrice(config, client, lookupToken, lookupBlock, lookupPool),
        blockNumber,
      ),
  );
}

export async function getUnitPrice(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  blockNumber: bigint,
) {
  return cachedPricingLookup(
    ["unitPrice", config.chainId, blockNumber.toString(), handler.kind, handler.id],
    () =>
      createPriceHandler(config, client, handler).getUnitPrice(
        (lookupToken, lookupBlock, lookupPool) =>
          getPrice(config, client, lookupToken, lookupBlock, lookupPool),
        blockNumber,
      ),
  );
}

export async function getLiquidityBalance(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  wallet: string,
  blockNumber: bigint,
) {
  return createPriceHandler(config, client, handler).getBalance(wallet, blockNumber);
}

export async function getUnderlyingTokenBalance(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  wallet: string,
  tokenAddress: string,
  blockNumber: bigint,
) {
  return createPriceHandler(config, client, handler).getUnderlyingTokenBalance(
    wallet,
    tokenAddress,
    blockNumber,
  );
}

function hasSameTokenSet(left: LiquidityHandler, right: LiquidityHandler) {
  if (left.tokens.length !== right.tokens.length) return false;
  const leftTokens = left.tokens.map((token) => token.toLowerCase()).sort();
  const rightTokens = right.tokens.map((token) => token.toLowerCase()).sort();
  return leftTokens.every((token, index) => token === rightTokens[index]);
}

async function cachedPricingLookup<T>(parts: unknown[], lookup: () => Promise<T>): Promise<T> {
  const cache = pricingCacheStorage.getStore();
  if (!cache) return lookup();

  const cacheKey = JSON.stringify(normalizeCacheValue(parts));
  const cached = cache.get(cacheKey);
  if (cached) return (await cached) as T;

  const result = lookup().catch((error: unknown) => {
    cache.delete(cacheKey);
    throw error;
  });
  cache.set(cacheKey, result);
  return await result;
}

function normalizeCacheValue(value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (typeof value === "string") return value.toLowerCase();
  if (Array.isArray(value)) return value.map((entry) => normalizeCacheValue(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeCacheValue(entry)]),
  );
}
