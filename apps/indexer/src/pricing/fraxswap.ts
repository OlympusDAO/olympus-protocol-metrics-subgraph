import type BigNumber from "bignumber.js";

import { snapshotFraxSwapPool } from "../effects";
import { addr, same, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// FraxSwap pair pricing (UniV2-compatible with TWAMM extensions). LP price is
// derived the same way: LP = (reserve0 × price0 + reserve1 × price1) / totalSupply.
// We don't try to do spot-price recursion through the pair; if a non-LP
// token (e.g. OHM, FRAX) needs pricing via this pair, that would require
// inverting the reserves — left to follow-ups since legacy uses FraxSwap
// pairs only for POL valuation, not as a spot price source.

export class FraxSwapPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "fraxswap" }>
> {
  private async snapshot(blockNumber: bigint) {
    return (await this.context.effect(snapshotFraxSwapPool, {
      chainId: this.config.chainId,
      pool: addr(this.handler.id),
      atBlock: Number(blockNumber),
    })) as { reserve0: string; reserve1: string; totalSupply: string };
  }

  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;

    const snapshot = await this.snapshot(blockNumber);
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;

    const reserve0 = toDecimal(BigInt(snapshot.reserve0), this.handler.decimals0);
    const reserve1 = toDecimal(BigInt(snapshot.reserve1), this.handler.decimals1);
    const price0 = await priceLookup(this.handler.token0, blockNumber, this.handler.id);
    const price1 = await priceLookup(this.handler.token1, blockNumber, this.handler.id);
    if (price0.price.isZero() && price1.price.isZero()) return null;

    const poolValue = reserve0.times(price0.price).plus(reserve1.times(price1.price));
    if (poolValue.eq(ZERO)) return null;
    const lpSupply = toDecimal(BigInt(snapshot.totalSupply), 18);
    if (lpSupply.eq(ZERO)) return null;
    const price = poolValue.div(lpSupply);
    return { price, liquidity: poolValue };
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const snapshot = await this.snapshot(blockNumber);
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;

    const legs = [
      { token: this.handler.token0, reserve: snapshot.reserve0, decimals: this.handler.decimals0 },
      { token: this.handler.token1, reserve: snapshot.reserve1, decimals: this.handler.decimals1 },
    ];
    let total = ZERO;
    for (const leg of legs) {
      if (excludedTokens.some((excluded) => same(excluded, leg.token))) continue;
      const price = await priceLookup(leg.token, blockNumber, this.handler.id);
      total = total.plus(toDecimal(BigInt(leg.reserve), leg.decimals).times(price.price));
    }
    return total;
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;
    const snapshot = await this.snapshot(blockNumber);
    const lpSupply = toDecimal(BigInt(snapshot.totalSupply), 18);
    return lpSupply.eq(ZERO) ? null : totalValue.div(lpSupply);
  }

  async getTokenQuantityPerLp(
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const leg = same(tokenAddress, this.handler.token0)
      ? { key: "reserve0" as const, decimals: this.handler.decimals0 }
      : same(tokenAddress, this.handler.token1)
        ? { key: "reserve1" as const, decimals: this.handler.decimals1 }
        : null;
    if (!leg) return null;
    const snapshot = await this.snapshot(blockNumber);
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;
    const reserve = toDecimal(BigInt(snapshot[leg.key]), leg.decimals);
    return reserve.div(toDecimal(BigInt(snapshot.totalSupply), 18));
  }

  async getUnderlyingTokenBalance(): Promise<BigNumber> {
    return ZERO;
  }
}
