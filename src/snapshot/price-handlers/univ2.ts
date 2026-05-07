import type BigNumber from "bignumber.js";

import { UNIV2_ABI } from "../abis/univ2";
import { getDecimals, getErc20DecimalBalance, getErc20TotalSupply, safeRead } from "../contracts";
import { addr, same, toDecimal, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup } from "./types";

export class Univ2PriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "univ2" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(this.client, this.handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV2_ABI, "token1", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? addr(token1) : addr(token0);
    const secondaryPrice = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondaryPrice.eq(ZERO)) return null;
    const token0Reserve = toDecimal(
      reserves[0],
      await getDecimals(this.client, addr(token0), blockNumber),
    );
    const token1Reserve = toDecimal(
      reserves[1],
      await getDecimals(this.client, addr(token1), blockNumber),
    );
    return (
      lookupIsToken0 ? token1Reserve.div(token0Reserve) : token0Reserve.div(token1Reserve)
    ).times(secondaryPrice);
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(this.client, this.handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV2_ABI, "token1", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    const tokens = [addr(token0), addr(token1)];
    const balances = [
      toDecimal(reserves[0], await getDecimals(this.client, addr(token0), blockNumber)),
      toDecimal(reserves[1], await getDecimals(this.client, addr(token1), blockNumber)),
    ];
    return sumTokenValues(tokens, balances, excludedTokens, priceLookup, blockNumber);
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;
    const supply = await getErc20TotalSupply(this.client, this.handler.id, blockNumber);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber> {
    return getErc20DecimalBalance(this.client, this.handler.id, wallet, blockNumber);
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    const totalSupply = await getErc20TotalSupply(this.client, this.handler.id, blockNumber);
    if (totalSupply.eq(ZERO)) return ZERO;
    const walletBalance = await this.getBalance(wallet, blockNumber);
    if (walletBalance.eq(ZERO)) return ZERO;
    const [token0, reserves] = await Promise.all([
      safeRead(this.client, this.handler.id, UNIV2_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.id, UNIV2_ABI, "getReserves", [], blockNumber),
    ]);
    if (!token0 || !reserves) return ZERO;
    const reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], await getDecimals(this.client, tokenAddress, blockNumber))
      : toDecimal(reserves[1], await getDecimals(this.client, tokenAddress, blockNumber));
    return reserve.times(walletBalance).div(totalSupply);
  }
}

async function sumTokenValues(
  tokens: string[],
  balances: BigNumber[],
  excludedTokens: string[],
  priceLookup: PriceLookup,
  blockNumber: bigint,
): Promise<BigNumber> {
  let total = ZERO;
  for (let i = 0; i < tokens.length; i++) {
    if (excludedTokens.some((excluded) => same(excluded, tokens[i]))) continue;
    const price = await priceLookup(tokens[i], blockNumber, null);
    total = total.plus(balances[i].times(price));
  }
  return total;
}
