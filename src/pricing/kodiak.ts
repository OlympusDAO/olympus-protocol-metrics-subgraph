import BigNumber from "bignumber.js";

import { KODIAK_ABI } from "../snapshot/abis/kodiak";
import { readContract } from "../snapshot/contracts";
import { addr, getTokenDecimals, ONE, same, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Kodiak handler sorts its declared tokens by address to mirror UniV3's
// canonical token0/token1 ordering. The underlying UniV3 pool determines the
// real order, but for OHM-HONEY both orderings coincide; if a future Kodiak
// LP uses a different order we'd resolve token0/token1 from the underlying
// Univ3PoolState's first-seen Swap event instead.
function sortTokens(tokens: string[]): [string, string] {
  const sorted = [...tokens].map(addr).sort();
  return [sorted[0], sorted[1]];
}

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
  const diff = lookupIsToken0 ? decimals0 - decimals1 : decimals1 - decimals0;
  const factor = new BigNumber(10).pow(Math.abs(diff));
  const adjusted = diff < 0 ? ONE.div(factor) : factor;
  return adjusted.times(lookupIsToken0 ? ONE.div(rawPriceToken0InToken1) : rawPriceToken0InToken1);
}

export class KodiakPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "kodiak" }>
> {
  private async getUnderlyingState() {
    const mapping = await this.context.KodiakPool.get(
      `${this.config.chainId}-${addr(this.handler.pool)}`,
    );
    if (!mapping) return null;
    return this.context.Univ3PoolState.get(
      `${this.config.chainId}-${addr(mapping.underlyingPoolAddress)}`,
    );
  }

  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.getUnderlyingState();
    if (!state || state.sqrtPriceX96 === 0n) return null;

    const [token0, token1] = sortTokens(this.handler.tokens);
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? token1 : token0;
    const secondary = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondary.price.eq(ZERO)) return null;

    const decimals0 = getTokenDecimals(this.config.tokens, token0);
    const decimals1 = getTokenDecimals(this.config.tokens, token1);
    const raw = priceToken0InToken1(state.sqrtPriceX96);
    const adjusted = applyDecimalAdjustment(raw, decimals0, decimals1, lookupIsToken0);
    const price = adjusted.times(secondary.price);
    // Same liquidity treatment as Univ3 — Kodiak Islands wrap a UniV3 pool
    // and the underlying state.liquidity is the meaningful tiebreaker.
    return { price, liquidity: new BigNumber(state.liquidity.toString()) };
  }

  // getUnderlyingBalances would require tracking the Kodiak LP's
  // pool-share-of-Univ3 math. The treasury never holds the bare underlying
  // UniV3 reserves through Kodiak — only the wrapping LP — so reporting a
  // pooled total value here is not needed for the current snapshot output.
  // Returning null is consistent with the Univ3 handler.
  async getTotalValue(): Promise<BigNumber | null> {
    return null;
  }

  async getUnitPrice(): Promise<BigNumber | null> {
    return null;
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
    const lpDecimals = getTokenDecimals(this.config.tokens, this.handler.pool);
    const supplyEntity = await this.context.Erc20Supply.get(
      `${this.config.chainId}-${addr(this.handler.pool)}`,
    );
    if (!supplyEntity || supplyEntity.totalSupply === 0n) return ZERO;
    const totalSupply = toDecimal(supplyEntity.totalSupply, lpDecimals);
    if (totalSupply.eq(ZERO)) return ZERO;

    const lpAddress = addr(this.handler.rewardVault ?? this.handler.pool);
    const balanceEntity = await this.context.TokenBalance.get(
      `${this.config.chainId}-${lpAddress}-${addr(wallet)}`,
    );
    if (!balanceEntity || balanceEntity.balance === 0n) return ZERO;
    const walletBalance = toDecimal(balanceEntity.balance, lpDecimals);

    // Kodiak's `getUnderlyingBalances` returns the active range's underlying
    // reserves. This is still RPC; deriving it from events would require
    // tracking Univ3 concentrated-liquidity math against the Kodiak position's
    // tick range, which is out of scope for this pass. TODO(kodiak-reserves).
    const [token0, reserves] = await Promise.all([
      this.resolveToken0(),
      readContract(
        this.client,
        this.handler.pool,
        KODIAK_ABI,
        "getUnderlyingBalances",
        [],
        blockNumber,
      ),
    ]);
    if (!token0) return ZERO;
    const tokenDecimals = getTokenDecimals(this.config.tokens, tokenAddress);
    const reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], tokenDecimals)
      : toDecimal(reserves[1], tokenDecimals);
    return reserve.times(walletBalance).div(totalSupply);
  }

  private async resolveToken0(): Promise<string | null> {
    const [token0] = sortTokens(this.handler.tokens);
    return token0;
  }
}
