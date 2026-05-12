import type BigNumber from "bignumber.js";

import { addr, getTokenDecimals, same, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Univ2 sorts tokens by address so token0 is always the lower-address one.
// We compute the sort at access time so callers can pass `tokens` in any order.
function sortTokens(tokens: string[]): [string, string] {
  const sorted = [...tokens].map(addr).sort();
  return [sorted[0], sorted[1]];
}

export class Univ2PriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "univ2" }>
> {
  private async getState() {
    return this.context.Univ2PoolState.get(`${this.config.chainId}-${addr(this.handler.id)}`);
  }

  private getSortedTokens(): { token0: string; token1: string } {
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
    if (!state) return null;

    const { token0, token1 } = this.getSortedTokens();
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? token1 : token0;
    const secondaryPrice = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondaryPrice.eq(ZERO)) return null;

    const decimals0 = getTokenDecimals(this.config.tokens, token0);
    const decimals1 = getTokenDecimals(this.config.tokens, token1);
    const reserve0 = toDecimal(state.reserve0, decimals0);
    const reserve1 = toDecimal(state.reserve1, decimals1);
    if (reserve0.eq(ZERO) || reserve1.eq(ZERO)) return null;

    const price = (lookupIsToken0 ? reserve1.div(reserve0) : reserve0.div(reserve1)).times(
      secondaryPrice,
    );
    return { price, liquidity: ZERO };
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.getState();
    if (!state) return null;

    const { token0, token1 } = this.getSortedTokens();
    const decimals0 = getTokenDecimals(this.config.tokens, token0);
    const decimals1 = getTokenDecimals(this.config.tokens, token1);
    const tokens = [token0, token1];
    const balances = [toDecimal(state.reserve0, decimals0), toDecimal(state.reserve1, decimals1)];

    let total = ZERO;
    for (let i = 0; i < tokens.length; i++) {
      if (excludedTokens.some((excluded) => same(excluded, tokens[i]))) continue;
      const price = await priceLookup(tokens[i], blockNumber, null);
      total = total.plus(balances[i].times(price));
    }
    return total;
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;

    const supplyEntity = await this.context.Erc20Supply.get(
      `${this.config.chainId}-${addr(this.handler.id)}`,
    );
    if (!supplyEntity) return null;
    const lpDecimals = getTokenDecimals(this.config.tokens, this.handler.id);
    const supply = toDecimal(supplyEntity.totalSupply, lpDecimals);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
    const state = await this.getState();
    if (!state) return ZERO;
    const supplyEntity = await this.context.Erc20Supply.get(
      `${this.config.chainId}-${addr(this.handler.id)}`,
    );
    if (!supplyEntity) return ZERO;
    const lpDecimals = getTokenDecimals(this.config.tokens, this.handler.id);
    const totalSupply = toDecimal(supplyEntity.totalSupply, lpDecimals);
    if (totalSupply.eq(ZERO)) return ZERO;

    const walletBalanceEntity = await this.context.TokenBalance.get(
      `${this.config.chainId}-${addr(this.handler.id)}-${addr(wallet)}`,
    );
    if (!walletBalanceEntity || walletBalanceEntity.balance === 0n) return ZERO;
    const walletBalance = toDecimal(walletBalanceEntity.balance, lpDecimals);

    const { token0 } = this.getSortedTokens();
    const tokenDecimals = getTokenDecimals(this.config.tokens, tokenAddress);
    const reserve = same(tokenAddress, token0)
      ? toDecimal(state.reserve0, tokenDecimals)
      : toDecimal(state.reserve1, tokenDecimals);

    return reserve.times(walletBalance).div(totalSupply);
  }
}
