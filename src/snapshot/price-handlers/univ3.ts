import BigNumber from "bignumber.js";

import { UNIV3_ABI } from "../abis/univ3";
import { getDecimals, getErc20DecimalBalance, safeRead } from "../contracts";
import { addr, ONE, same, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup } from "./types";

export class Univ3PriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "univ3" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const [token0, token1, slot0] = await Promise.all([
      safeRead(this.client, this.handler.id, UNIV3_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV3_ABI, "token1", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV3_ABI, "slot0", [], blockNumber),
    ]);
    if (!token0 || !token1 || !slot0) return null;
    const lookupIsToken1 = same(tokenAddress, token1);
    const otherToken = lookupIsToken1 ? addr(token0) : addr(token1);
    const otherPrice = await priceLookup(otherToken, blockNumber, this.getId());
    if (otherPrice.eq(ZERO)) return null;
    const priceRaw = new BigNumber(slot0[0].toString()).pow(2).div(new BigNumber(2).pow(192));
    const decimals0 = await getDecimals(this.client, addr(token0), blockNumber);
    const decimals1 = await getDecimals(this.client, addr(token1), blockNumber);
    const decimalDifference = lookupIsToken1 ? decimals1 - decimals0 : decimals0 - decimals1;
    const decimalFactor = new BigNumber(10).pow(Math.abs(decimalDifference));
    const adjusted = (decimalDifference < 0 ? ONE.div(decimalFactor) : decimalFactor).times(
      lookupIsToken1 ? ONE.div(priceRaw) : priceRaw,
    );
    return adjusted.times(otherPrice);
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const [token0, token1] = await Promise.all([
      safeRead(this.client, this.handler.id, UNIV3_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV3_ABI, "token1", [], blockNumber),
    ]);
    if (!token0 || !token1) return null;
    const tokens = [addr(token0), addr(token1)];
    const balances = [
      await getErc20DecimalBalance(this.client, addr(token0), this.handler.id, blockNumber),
      await getErc20DecimalBalance(this.client, addr(token1), this.handler.id, blockNumber),
    ];
    let total = ZERO;
    for (let i = 0; i < tokens.length; i++) {
      if (excludedTokens.some((excluded) => same(excluded, tokens[i]))) continue;
      const price = await priceLookup(tokens[i], blockNumber, null);
      total = total.plus(balances[i].times(price));
    }
    return total;
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    return this.getTotalValue([], priceLookup, blockNumber);
  }

  async getBalance(_wallet: string, _blockNumber: bigint): Promise<BigNumber> {
    return ZERO;
  }

  async getUnderlyingTokenBalance(
    _wallet: string,
    _tokenAddress: string,
    _blockNumber: bigint,
  ): Promise<BigNumber> {
    return ZERO;
  }
}
