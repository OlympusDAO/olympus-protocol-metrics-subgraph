import type BigNumber from "bignumber.js";

import { snapshotFraxSwapPool } from "../effects";
import { addr, toDecimal, ZERO } from "../snapshot/math";
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
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;

    const snapshot = (await this.context.effect(snapshotFraxSwapPool, {
      chainId: this.config.chainId,
      pool: addr(this.handler.id),
      atBlock: Number(blockNumber),
    })) as { reserve0: string; reserve1: string; totalSupply: string };
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
