import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { isActive, ZERO } from "../snapshot/math";
import type { ChainConfig, LiquidityHandler } from "../snapshot/types";
import { BalancerPriceHandler } from "./balancer";
import { KodiakPriceHandler } from "./kodiak";
import { RemapPriceHandler } from "./remap";
import { StablePriceHandler } from "./stable";
import type { PriceHandler } from "./types";
import { Univ2PriceHandler } from "./univ2";
import { Univ3PriceHandler, Univ3QuoterPriceHandler } from "./univ3";

export function createPriceHandler(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
): PriceHandler {
  if (handler.kind === "stable") return new StablePriceHandler(config, context, client, handler);
  if (handler.kind === "remap") return new RemapPriceHandler(config, context, client, handler);
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

export async function getPrice(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
): Promise<BigNumber> {
  const token = config.tokens.find((value) => value.address === tokenAddress.toLowerCase());
  if (token && !isActive(token, blockNumber)) return ZERO;

  const currentPoolHandler =
    currentPool === null
      ? null
      : (config.liquidityHandlers.find((handler) => handler.id === currentPool) ?? null);
  let selectedPrice: BigNumber | null = null;
  let selectedLiquidity: BigNumber | null = null;

  for (const handlerConfig of config.liquidityHandlers) {
    if (!isActive(handlerConfig, blockNumber)) continue;
    const handler = createPriceHandler(config, context, client, handlerConfig);
    if (!handler.matches(tokenAddress)) continue;
    if (handler.getId() === currentPool) continue;
    if (currentPoolHandler && hasSameTokenSet(handlerConfig, currentPoolHandler)) continue;

    const price = await handler.getPrice(
      tokenAddress,
      (lookupToken, lookupBlock, lookupPool) =>
        getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
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
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
  excludedTokens: string[],
  blockNumber: bigint,
) {
  return createPriceHandler(config, context, client, handler).getTotalValue(
    excludedTokens,
    (lookupToken, lookupBlock, lookupPool) =>
      getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
    blockNumber,
  );
}

export async function getUnitPrice(
  config: ChainConfig,
  context: EvmOnBlockContext,
  client: PublicClient,
  handler: LiquidityHandler,
  blockNumber: bigint,
) {
  return createPriceHandler(config, context, client, handler).getUnitPrice(
    (lookupToken, lookupBlock, lookupPool) =>
      getPrice(config, context, client, lookupToken, lookupBlock, lookupPool),
    blockNumber,
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
