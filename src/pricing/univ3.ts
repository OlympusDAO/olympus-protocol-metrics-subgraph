import BigNumber from "bignumber.js";

import { addr, getTokenDecimals, ONE, same, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Univ3 sorts tokens by address (token0 < token1 by uint256).
function sortTokens(tokens: string[]): [string, string] {
  const sorted = [...tokens].map(addr).sort();
  return [sorted[0], sorted[1]];
}

// sqrtPriceX96 → price of token0 in units of token1, before decimal adjustment.
// (sqrtPriceX96 / 2^96)^2 = token1_amount / token0_amount at the current tick.
function priceToken0InToken1(sqrtPriceX96: bigint): BigNumber {
  const sqrt = new BigNumber(sqrtPriceX96.toString());
  const denom = new BigNumber(2).pow(192);
  return sqrt.pow(2).div(denom);
}

function applyDecimalAdjustment(
  rawPriceToken0InToken1: BigNumber,
  decimals0: number,
  decimals1: number,
  lookupIsToken0: boolean,
): BigNumber {
  // The raw price is in token0/token1 units expressed with raw integer scaling.
  // Adjust by decimal difference to get the price ratio in normalized units.
  const diff = lookupIsToken0 ? decimals0 - decimals1 : decimals1 - decimals0;
  const factor = new BigNumber(10).pow(Math.abs(diff));
  const adjusted = diff < 0 ? ONE.div(factor) : factor;
  return adjusted.times(lookupIsToken0 ? ONE.div(rawPriceToken0InToken1) : rawPriceToken0InToken1);
}

abstract class Univ3PriceHandlerBase<
  THandler extends Extract<
    LiquidityHandler,
    { kind: "univ3" } | { kind: "univ3-quoter" }
  >,
> extends BasePriceHandler<THandler> {
  protected async getState() {
    return this.context.Univ3PoolState.get(`${this.config.chainId}-${addr(this.handler.id)}`);
  }

  protected getSortedTokens(): { token0: string; token1: string } {
    const [token0, token1] = sortTokens(this.handler.tokens);
    return { token0, token1 };
  }

  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.getState();
    if (!state || state.sqrtPriceX96 === 0n) return null;

    const { token0, token1 } = this.getSortedTokens();
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? token1 : token0;
    const secondaryPrice = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondaryPrice.eq(ZERO)) return null;

    const decimals0 = getTokenDecimals(this.config.tokens, token0);
    const decimals1 = getTokenDecimals(this.config.tokens, token1);
    const raw = priceToken0InToken1(state.sqrtPriceX96);
    const adjusted = applyDecimalAdjustment(raw, decimals0, decimals1, lookupIsToken0);
    const price = adjusted.times(secondaryPrice);
    return { price, liquidity: ZERO };
  }

  // Total reserve value for Univ3 requires the actual token balances in the pool,
  // which Initialize / Swap events do NOT emit (they emit price/liquidity/tick,
  // not balances). We could maintain balances via Mint / Burn / Swap deltas, but
  // for now report null — Univ3 pools are never owned-liquidity holders in the
  // current treasury (no fungible LP). TODO(univ3-balances).
  async getTotalValue(): Promise<BigNumber | null> {
    return null;
  }

  async getUnitPrice(): Promise<BigNumber | null> {
    return null;
  }

  async getUnderlyingTokenBalance(): Promise<BigNumber> {
    return ZERO;
  }
}

export class Univ3PriceHandler extends Univ3PriceHandlerBase<
  Extract<LiquidityHandler, { kind: "univ3" }>
> {}

export class Univ3QuoterPriceHandler extends Univ3PriceHandlerBase<
  Extract<LiquidityHandler, { kind: "univ3-quoter" }>
> {}
