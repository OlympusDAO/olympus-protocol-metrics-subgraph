import type BigNumber from "bignumber.js";

import { KODIAK_ABI } from "../abis/kodiak";
import { getDecimals, getErc20DecimalBalance, getErc20TotalSupply, safeRead } from "../contracts";
import { addr, same, toDecimal, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup } from "./types";

export class KodiakPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "kodiak" }>
> {
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const total = await this.getTotalValue([], priceLookup, blockNumber);
    const supply = await getErc20TotalSupply(this.client, this.handler.pool, blockNumber);
    if (!total || supply.eq(ZERO)) return null;
    return total.div(supply);
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    const [token0, token1, reserves] = await Promise.all([
      safeRead(this.client, this.handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      safeRead(this.client, this.handler.pool, KODIAK_ABI, "token1", [], blockNumber),
      safeRead(
        this.client,
        this.handler.pool,
        KODIAK_ABI,
        "getUnderlyingBalances",
        [],
        blockNumber,
      ),
    ]);
    if (!token0 || !token1 || !reserves) return null;
    const tokens = [addr(token0), addr(token1)];
    const balances = [
      toDecimal(reserves[0], await getDecimals(this.client, addr(token0), blockNumber)),
      toDecimal(reserves[1], await getDecimals(this.client, addr(token1), blockNumber)),
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
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;
    const supply = await getErc20TotalSupply(this.client, this.handler.pool, blockNumber);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber> {
    return getErc20DecimalBalance(
      this.client,
      this.handler.rewardVault ?? this.handler.pool,
      wallet,
      blockNumber,
    );
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    const totalSupply = await getErc20TotalSupply(this.client, this.handler.pool, blockNumber);
    if (totalSupply.eq(ZERO)) return ZERO;
    const walletBalance = await this.getBalance(wallet, blockNumber);
    if (walletBalance.eq(ZERO)) return ZERO;
    const [token0, reserves] = await Promise.all([
      safeRead(this.client, this.handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      safeRead(
        this.client,
        this.handler.pool,
        KODIAK_ABI,
        "getUnderlyingBalances",
        [],
        blockNumber,
      ),
    ]);
    if (!token0 || !reserves) return ZERO;
    const reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], await getDecimals(this.client, tokenAddress, blockNumber))
      : toDecimal(reserves[1], await getDecimals(this.client, tokenAddress, blockNumber));
    return reserve.times(walletBalance).div(totalSupply);
  }
}
