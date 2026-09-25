import BigNumber from "bignumber.js";

import { readErc20BalanceOf, readUniv3Twap } from "../effects";
import { addr, getTokenDecimals, ONE, same, toDecimal, ZERO } from "../snapshot/math";
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
  return lookupIsToken0
    ? rawPriceToken0InToken1.times(adjusted)
    : adjusted.div(rawPriceToken0InToken1);
}

abstract class Univ3PriceHandlerBase<
  THandler extends Extract<LiquidityHandler, { kind: "univ3" } | { kind: "univ3-quoter" }>,
> extends BasePriceHandler<THandler> {
  protected async getState() {
    return this.context.Univ3PoolState.get(`${this.config.chainId}-${addr(this.handler.id)}`);
  }

  protected getSortedTokens(): { token0: string; token1: string } {
    const [token0, token1] = sortTokens(this.handler.tokens);
    return { token0, token1 };
  }

  /** Value a pool pair, enforcing block-pinned TWAP guards when configured. */
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    let raw: BigNumber;
    if (this.handler.kind === "univ3" && this.handler.twap) {
      const { seconds, maxSpotDeviationBps } = this.handler.twap;
      if (
        !Number.isInteger(seconds) ||
        seconds <= 0 ||
        seconds > 0xffffffff ||
        !Number.isInteger(maxSpotDeviationBps) ||
        maxSpotDeviationBps <= 0 ||
        maxSpotDeviationBps > 10000
      ) {
        throw new Error("Invalid UniV3 TWAP configuration");
      }
      const observation = await this.context.effect(readUniv3Twap, {
        chainId: this.config.chainId,
        poolAddress: this.handler.id,
        atBlock: Number(blockNumber),
        seconds,
      });
      const delta = BigInt(observation.tickDelta);
      const window = BigInt(seconds);
      let tick = delta / window;
      // OracleLibrary.consult rounds negative arithmetic mean ticks down.
      if (delta < 0n && delta % window !== 0n) tick -= 1n;
      if (tick < -887272n || tick > 887272n || BigInt(observation.liquidityDelta) <= 0n) {
        throw new Error("Invalid UniV3 TWAP observation");
      }
      // Bound exponentiation precision locally; never alter global decimal math.
      const Decimal = BigNumber.clone({ POW_PRECISION: 60, DECIMAL_PLACES: 80 });
      raw = new BigNumber(new Decimal("1.0001").pow(Number(tick)).toString());
      const spot = priceToken0InToken1(BigInt(observation.sqrtPriceX96));
      if (spot.lte(0) || spot.div(raw).minus(1).abs().times(10000).gt(maxSpotDeviationBps)) {
        throw new Error("UniV3 spot/TWAP deviation exceeds configured bound");
      }
    } else {
      const state = await this.getState();
      if (!state || state.sqrtPriceX96 === 0n) return null;
      raw = priceToken0InToken1(state.sqrtPriceX96);
    }

    const { token0, token1 } = this.getSortedTokens();
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? token1 : token0;
    const secondary = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondary.price.lte(ZERO)) {
      if (this.handler.kind === "univ3" && this.handler.twap) {
        throw new Error("UniV3 TWAP secondary price unavailable");
      }
      return null;
    }

    const decimals0 = getTokenDecimals(this.config.tokens, token0);
    const decimals1 = getTokenDecimals(this.config.tokens, token1);
    const adjusted = applyDecimalAdjustment(raw, decimals0, decimals1, lookupIsToken0);
    const price = adjusted.times(secondary.price);
    // Liquidity for handler selection is USD depth on the secondary side, the
    // same unit Univ2 and Balancer report and legacy's
    // `otherTokenPrice * otherTokenBalance` (PriceHandlerUniswapV3.ts:156).
    // The active-range L parameter isn't comparable to USD: it let a thin
    // WETH-OHM pool outrank the deep SushiSwap OHM-DAI pool for OHM price in
    // 2022 (down to $0.0004 in May 2022). balanceOf(pool) is a cached read.
    const secondaryBalance = await this.context.effect(readErc20BalanceOf, {
      chainId: this.config.chainId,
      tokenAddress: secondaryToken,
      walletAddress: addr(this.handler.id),
      atBlock: Number(blockNumber),
    });
    const secondaryDecimals = lookupIsToken0 ? decimals1 : decimals0;
    const liquidity = toDecimal(BigInt(secondaryBalance), secondaryDecimals).times(secondary.price);
    return { price, liquidity };
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
> {
  /** Restrict a TWAP route to its base asset, leaving the quote asset independent. */
  matches(tokenAddress: string): boolean {
    return this.handler.twap
      ? same(tokenAddress, this.handler.twap.pricedToken)
      : super.matches(tokenAddress);
  }
}

export class Univ3QuoterPriceHandler extends Univ3PriceHandlerBase<
  Extract<LiquidityHandler, { kind: "univ3-quoter" }>
> {}
