import { AsyncLocalStorage } from "node:async_hooks";
import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { isActive, ZERO } from "../snapshot/math";
import type { ChainConfig, LiquidityHandler } from "../snapshot/types";
import { BalancerPriceHandler } from "./balancer";
import { ChainlinkPriceHandler } from "./chainlink";
import { CurvePriceHandler } from "./curve";
import { Erc4626PriceHandler } from "./erc4626";
import { FraxSwapPriceHandler } from "./fraxswap";
import { GohmPriceHandler } from "./gohm";
import { KodiakPriceHandler } from "./kodiak";
import { RemapPriceHandler } from "./remap";
import { StablePriceHandler } from "./stable";
import type { PriceHandler, PriceLookupResult } from "./types";
import { Univ2PriceHandler } from "./univ2";
import { Univ3PriceHandler, Univ3QuoterPriceHandler } from "./univ3";

const ZERO_RESULT: PriceLookupResult = { price: ZERO, liquidity: ZERO };

export function createPriceHandler(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
): PriceHandler {
  if (handler.kind === "stable") return new StablePriceHandler(config, context, client, handler);
  if (handler.kind === "remap") return new RemapPriceHandler(config, context, client, handler);
  if (handler.kind === "chainlink") {
    return new ChainlinkPriceHandler(config, context, client, handler);
  }
  if (handler.kind === "gohm") return new GohmPriceHandler(config, context, client, handler);
  if (handler.kind === "erc4626") {
    return new Erc4626PriceHandler(config, context, client, handler);
  }
  if (handler.kind === "curve") return new CurvePriceHandler(config, context, client, handler);
  if (handler.kind === "fraxswap") {
    return new FraxSwapPriceHandler(config, context, client, handler);
  }
  if (handler.kind === "univ2") return new Univ2PriceHandler(config, context, client, handler);
  if (handler.kind === "univ3") return new Univ3PriceHandler(config, context, client, handler);
  if (handler.kind === "univ3-quoter") {
    return new Univ3QuoterPriceHandler(config, context, client, handler);
  }
  if (handler.kind === "balancer") {
    return new BalancerPriceHandler(config, context, client, handler);
  }
  return new KodiakPriceHandler(config, context, client, handler);
}

// `cache` memoizes in-flight + resolved lookups so concurrent calls share work.
// `inFlight` separately tracks keys whose Promise hasn't settled yet, so a
// recursive lookup that hits the same key can short-circuit instead of
// awaiting a Promise that's transitively awaiting itself (which would
// deadlock — the symptom that wedged the indexer; see tasks/envio-bug-report.md
// for the original investigation).
type PricingCacheStore = {
  cache: Map<string, Promise<unknown>>;
  inFlight: Set<string>;
};

const pricingCacheStorage = new AsyncLocalStorage<PricingCacheStore>();

export async function withPricingCache<T>(operation: () => Promise<T>): Promise<T> {
  return pricingCacheStorage.run({ cache: new Map(), inFlight: new Set() }, operation);
}

export async function getPrice(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<PriceLookupResult> {
  return cachedPricingLookup(
    ["price", config.chainId, blockNumber.toString(), tokenAddress, currentPool],
    () => derivePrice(config, context, client, tokenAddress, blockNumber, currentPool),
    ZERO_RESULT,
  );
}

async function derivePrice(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<PriceLookupResult> {
  const token = config.tokens.find((value) => value.address === tokenAddress.toLowerCase());
  if (token && !isActive(token, blockNumber)) return ZERO_RESULT;

  const currentPoolHandler =
    currentPool === null
      ? null
      : (config.liquidityHandlers.find((handler) => handler.id === currentPool) ?? null);
  let selected: PriceLookupResult | null = null;

  for (const handlerConfig of config.liquidityHandlers) {
    if (!isActive(handlerConfig, blockNumber)) continue;
    const handler = createPriceHandler(config, context, client, handlerConfig);
    if (!handler.matches(tokenAddress)) continue;
    if (handler.getId() === currentPool) continue;
    // Skip a same-token-set sibling only when it's a *different* underlying
    // pool — that's the genuine cycle-prevention case (e.g. two distinct
    // WETH-OHM pools). Sibling handlers that wrap the SAME underlying pool
    // (Beradrome / Infrared / BeraHub reward vaults all read
    // LP_KODIAK_OHM_HONEY) must NOT be skipped, otherwise the pool's own
    // tokens can't be priced when computing that pool's POL value — which
    // silently zeroed the OHM side of Berachain OHM-HONEY TVL. The in-flight
    // cycle guard in cachedPricingLookup backstops any residual recursion.
    if (
      currentPoolHandler &&
      hasSameTokenSet(handlerConfig, currentPoolHandler) &&
      underlyingPool(handlerConfig) !== underlyingPool(currentPoolHandler)
    )
      continue;

    const result = await handler.getPrice(
      tokenAddress,
      (lookupToken, lookupBlock, lookupPool) =>
        getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
      blockNumber,
    );
    if (!result) continue;
    if (selected && selected.liquidity.gt(result.liquidity)) continue;
    selected = result;
  }
  return selected ?? ZERO_RESULT;
}

// Underlying liquidity contract a handler reads from. Kodiak reward-vault
// wrappers (Beradrome / Infrared / BeraHub) each have a distinct `id` but
// share the same underlying `pool`; every other kind uses `id` as its pool
// identity.
function underlyingPool(handler: LiquidityHandler): string {
  return "pool" in handler && handler.pool
    ? handler.pool.toLowerCase()
    : handler.id.toLowerCase();
}

export async function getTotalValue(
  config: ChainConfig,
  context: EvmOnBlockContext,
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
      createPriceHandler(config, context, client, handler).getTotalValue(
        excludedTokens,
        (lookupToken, lookupBlock, lookupPool) =>
          getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
        blockNumber,
      ),
    null,
  );
}

export async function getUnitPrice(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
  blockNumber: bigint,
) {
  return cachedPricingLookup(
    ["unitPrice", config.chainId, blockNumber.toString(), handler.kind, handler.id],
    () =>
      createPriceHandler(config, context, client, handler).getUnitPrice(
        (lookupToken, lookupBlock, lookupPool) =>
          getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
        blockNumber,
      ),
    null,
  );
}

export async function getUnderlyingTokenBalance(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
  wallet: string,
  tokenAddress: string,
  blockNumber: bigint,
) {
  return createPriceHandler(config, context, client, handler).getUnderlyingTokenBalance(
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

async function cachedPricingLookup<T>(
  parts: unknown[],
  lookup: () => Promise<T>,
  cycleFallback: T,
): Promise<T> {
  const store = pricingCacheStorage.getStore();
  if (!store) return lookup();

  const cacheKey = JSON.stringify(normalizeCacheValue(parts));

  // Cycle: this exact lookup is already on the stack above us. Awaiting the
  // cached Promise would deadlock because it's waiting on us. Break the cycle
  // by contributing the fallback value to whoever called us — the upstream
  // resolver picks the highest-liquidity result so a zero contribution from
  // one branch doesn't poison the answer, it just gets ignored.
  //
  // Cycles are EXPECTED here, not exceptional: pools whose two tokens price
  // each other (Berachain OHM↔HONEY across the shared Kodiak pool, WBERA↔HONEY)
  // recurse until this guard breaks them, then resolve via a terminal source
  // (the stable handler). We deliberately do NOT log — at historical-sync
  // volume a per-cycle console.warn fires thousands of times and the
  // synchronous I/O measurably slows indexing.
  if (store.inFlight.has(cacheKey)) {
    return cycleFallback;
  }

  const cached = store.cache.get(cacheKey);
  if (cached) return (await cached) as T;

  store.inFlight.add(cacheKey);
  const result = lookup()
    .catch((error: unknown) => {
      store.cache.delete(cacheKey);
      throw error;
    })
    .finally(() => {
      store.inFlight.delete(cacheKey);
    });
  store.cache.set(cacheKey, result);
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
