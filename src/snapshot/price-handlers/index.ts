import type { PublicClient } from "viem";

import type { ChainConfig, LiquidityHandler } from "../types";
import { BalancerPriceHandler } from "./balancer";
import { KodiakPriceHandler } from "./kodiak";
import { StablePriceHandler } from "./stable";
import type { PriceHandler } from "./types";
import { Univ2PriceHandler } from "./univ2";
import { Univ3PriceHandler, Univ3QuoterPriceHandler } from "./univ3";

export function createPriceHandler(
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
): PriceHandler {
  if (handler.kind === "stable") return new StablePriceHandler(config, client, handler);
  if (handler.kind === "univ2") return new Univ2PriceHandler(config, client, handler);
  if (handler.kind === "univ3") return new Univ3PriceHandler(config, client, handler);
  if (handler.kind === "univ3-quoter") return new Univ3QuoterPriceHandler(config, client, handler);
  if (handler.kind === "balancer") return new BalancerPriceHandler(config, client, handler);
  return new KodiakPriceHandler(config, client, handler);
}
