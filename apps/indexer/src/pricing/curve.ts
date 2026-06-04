import type BigNumber from "bignumber.js";

import { snapshotCurvePool } from "../effects";
import { addr, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Curve LP pricing:
//   LP_price = sum(balances[i] × coin_price[i]) / totalSupply
// All balances are read at the pool address; totalSupply is read at the LP
// token address (== pool for most V1 pools, lp_token() for V2). Effects are
// cached per (pool, atBlock).
//
// Liquidity used for handler tiebreaking = total pool value in USD. This
// matches legacy intent (largest-reserves wins among multiple pricing paths).

export class CurvePriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "curve" }>
> {
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;

    const snapshot = (await this.context.effect(snapshotCurvePool, {
      chainId: this.config.chainId,
      pool: addr(this.handler.id),
      lpToken: addr(this.handler.lpToken),
      coinCount: this.handler.coins.length,
      atBlock: Number(blockNumber),
    })) as { balances: string[]; totalSupply: string };
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;

    let poolValue = ZERO;
    for (let i = 0; i < this.handler.coins.length; i++) {
      const balanceRaw = snapshot.balances[i];
      if (!balanceRaw || balanceRaw === "0") continue;
      const balance = toDecimal(BigInt(balanceRaw), this.handler.coinDecimals[i]);
      const coinPrice = await priceLookup(this.handler.coins[i], blockNumber, this.handler.id);
      if (coinPrice.price.isZero()) continue;
      poolValue = poolValue.plus(balance.times(coinPrice.price));
    }
    if (poolValue.eq(ZERO)) return null;

    // Curve LP tokens are 18 decimals across the board.
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
