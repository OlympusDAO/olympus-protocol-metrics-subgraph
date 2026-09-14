import type BigNumber from "bignumber.js";

import { snapshotCurvePool } from "../effects";
import { addr, same, toDecimal, ZERO } from "../snapshot/math";
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
  private async snapshot(blockNumber: bigint) {
    return (await this.context.effect(snapshotCurvePool, {
      chainId: this.config.chainId,
      pool: addr(this.handler.id),
      lpToken: addr(this.handler.lpToken),
      coinCount: this.handler.coins.length,
      atBlock: Number(blockNumber),
    })) as { balances: string[]; totalSupply: string };
  }

  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;

    const snapshot = await this.snapshot(blockNumber);
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

  // Pool value in USD across coins, skipping `excludedTokens` (OHM, when
  // computing the non-OHM share of protocol-owned liquidity).
  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const snapshot = await this.snapshot(blockNumber);
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;

    let total = ZERO;
    for (let i = 0; i < this.handler.coins.length; i++) {
      const coin = this.handler.coins[i];
      if (excludedTokens.some((excluded) => same(excluded, coin))) continue;
      const balanceRaw = snapshot.balances[i];
      if (!balanceRaw || balanceRaw === "0") continue;
      const balance = toDecimal(BigInt(balanceRaw), this.handler.coinDecimals[i]);
      const coinPrice = await priceLookup(coin, blockNumber, this.handler.id);
      total = total.plus(balance.times(coinPrice.price));
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
    const index = this.handler.coins.findIndex((coin) => same(coin, tokenAddress));
    if (index < 0) return null;
    const snapshot = await this.snapshot(blockNumber);
    if (!snapshot.totalSupply || snapshot.totalSupply === "0") return null;
    const balance = toDecimal(
      BigInt(snapshot.balances[index] ?? "0"),
      this.handler.coinDecimals[index],
    );
    return balance.div(toDecimal(BigInt(snapshot.totalSupply), 18));
  }

  async getUnderlyingTokenBalance(): Promise<BigNumber> {
    return ZERO;
  }
}
