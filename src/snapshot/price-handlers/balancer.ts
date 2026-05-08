import type BigNumber from "bignumber.js";

import { BALANCER_POOL_TOKEN_ABI } from "../abis/balancer";
import {
  getBalancerPool,
  getBalancerPoolToken,
  getDecimals,
  getErc20DecimalBalance,
  getErc20TotalSupply,
  readContract,
} from "../contracts";
import { same, toDecimal, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

export class BalancerPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "balancer" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const pool = await getBalancerPool(this.config, this.client, this.handler, blockNumber);
    if (!pool) return null;
    const poolToken = await getBalancerPoolToken(this.client, this.handler, blockNumber);
    if (!poolToken) return null;
    const weights = await readContract(
      this.client,
      poolToken,
      BALANCER_POOL_TOKEN_ABI,
      "getNormalizedWeights",
      [],
      blockNumber,
    );
    const decimals = await getDecimals(this.client, poolToken, blockNumber);
    if (!weights) return null;
    const lookupIndex = pool.tokens.findIndex((value: string) => same(value, tokenAddress));
    if (lookupIndex < 0) return null;
    for (let i = 0; i < pool.tokens.length; i++) {
      if (i === lookupIndex) continue;
      const secondaryPrice = await priceLookup(pool.tokens[i], blockNumber, this.getId());
      if (secondaryPrice.eq(ZERO)) continue;
      const lookupReserve = toDecimal(
        pool.balances[lookupIndex],
        await getDecimals(this.client, pool.tokens[lookupIndex], blockNumber),
      );
      const secondaryReserve = toDecimal(
        pool.balances[i],
        await getDecimals(this.client, pool.tokens[i], blockNumber),
      );
      const lookupWeight = toDecimal(weights[lookupIndex], decimals);
      const secondaryWeight = toDecimal(weights[i], decimals);
      const price = secondaryReserve
        .div(secondaryWeight)
        .div(lookupReserve.div(lookupWeight))
        .times(secondaryPrice);
      return { price, liquidity: ZERO };
    }
    return null;
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const pool = await getBalancerPool(this.config, this.client, this.handler, blockNumber);
    if (!pool) return null;
    let total = ZERO;
    for (let i = 0; i < pool.tokens.length; i++) {
      if (excludedTokens.some((excluded) => same(excluded, pool.tokens[i]))) continue;
      const balance = toDecimal(
        pool.balances[i],
        await getDecimals(this.client, pool.tokens[i], blockNumber),
      );
      const price = await priceLookup(pool.tokens[i], blockNumber, null);
      total = total.plus(balance.times(price));
    }
    return total;
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;
    const poolToken = await getBalancerPoolToken(this.client, this.handler, blockNumber);
    if (!poolToken) return null;
    const supply = await getErc20TotalSupply(this.client, poolToken, blockNumber);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
    const poolToken = await getBalancerPoolToken(this.client, this.handler, blockNumber);
    return poolToken ? getErc20DecimalBalance(this.client, poolToken, wallet, blockNumber) : ZERO;
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
    const poolToken = await getBalancerPoolToken(this.client, this.handler, blockNumber);
    if (!poolToken) return ZERO;
    const totalSupply = await getErc20TotalSupply(this.client, poolToken, blockNumber);
    if (totalSupply.eq(ZERO)) return ZERO;
    const walletBalance = await this.getBalance(wallet, blockNumber);
    if (walletBalance.eq(ZERO)) return ZERO;
    const pool = await getBalancerPool(this.config, this.client, this.handler, blockNumber);
    if (!pool) return ZERO;
    const index = pool.tokens.findIndex((token: string) => same(token, tokenAddress));
    if (index < 0) return ZERO;
    const reserve = toDecimal(
      pool.balances[index],
      await getDecimals(this.client, tokenAddress, blockNumber),
    );
    return reserve.times(walletBalance).div(totalSupply);
  }
}
