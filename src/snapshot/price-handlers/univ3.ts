import BigNumber from "bignumber.js";

import { UNIV3_ABI } from "../abis/univ3";
import { UNIV3_QUOTER_ABI } from "../abis/univ3-quoter";
import { getDecimals, getErc20DecimalBalance, readContract } from "../contracts";
import { addr, ONE, same, toDecimal, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

const SQRT_PRICE_LIMIT_X96 = 0n;

export class Univ3PriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "univ3" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const [token0, token1, slot0] = await Promise.all([
      readContract(this.client, this.handler.id, UNIV3_ABI, "token0", [], blockNumber),
      readContract(this.client, this.handler.id, UNIV3_ABI, "token1", [], blockNumber),
      readContract(this.client, this.handler.id, UNIV3_ABI, "slot0", [], blockNumber),
    ]);
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
    const price = adjusted.times(otherPrice);
    const otherTokenBalance = await getErc20DecimalBalance(
      this.client,
      otherToken,
      this.handler.id,
      blockNumber,
    );
    return { price, liquidity: otherPrice.times(otherTokenBalance) };
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const [token0, token1] = await Promise.all([
      readContract(this.client, this.handler.id, UNIV3_ABI, "token0", [], blockNumber),
      readContract(this.client, this.handler.id, UNIV3_ABI, "token1", [], blockNumber),
    ]);
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
    if (!this.isActive(blockNumber)) return null;
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

export class Univ3QuoterPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "univ3-quoter" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const [token0, token1, fee] = await Promise.all([
      readContract(this.client, this.handler.id, UNIV3_ABI, "token0", [], blockNumber),
      readContract(this.client, this.handler.id, UNIV3_ABI, "token1", [], blockNumber),
      readContract(this.client, this.handler.id, UNIV3_ABI, "fee", [], blockNumber),
    ]);
    const secondaryToken = same(tokenAddress, token0) ? addr(token1) : addr(token0);
    const [tokenDecimals, secondaryDecimals] = await Promise.all([
      getDecimals(this.client, tokenAddress, blockNumber),
      getDecimals(this.client, secondaryToken, blockNumber),
    ]);
    const quote = await readContract(
      this.client,
      this.handler.quoter,
      UNIV3_QUOTER_ABI,
      "quoteExactInputSingle",
      [
        {
          tokenIn: tokenAddress as `0x${string}`,
          tokenOut: secondaryToken as `0x${string}`,
          amountIn: 10n ** BigInt(tokenDecimals),
          fee,
          sqrtPriceLimitX96: SQRT_PRICE_LIMIT_X96,
        },
      ],
      blockNumber,
    );
    const secondaryPrice = await priceLookup(secondaryToken, blockNumber, this.getId());
    if (secondaryPrice.eq(ZERO)) return null;
    const price = toDecimal(quote[0], secondaryDecimals).times(secondaryPrice);
    const secondaryBalance = await getErc20DecimalBalance(
      this.client,
      secondaryToken,
      this.handler.id,
      blockNumber,
    );
    return { price, liquidity: secondaryPrice.times(secondaryBalance) };
  }

  async getTotalValue(
    _excludedTokens: string[],
    _priceLookup: PriceLookup,
    _blockNumber: bigint,
  ): Promise<BigNumber | null> {
    return null;
  }

  async getUnitPrice(_priceLookup: PriceLookup, _blockNumber: bigint): Promise<BigNumber | null> {
    return null;
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
