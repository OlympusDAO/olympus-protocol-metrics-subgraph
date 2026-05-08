import type BigNumber from "bignumber.js";

import { KODIAK_ABI } from "../abis/kodiak";
import { UNIV3_ABI } from "../abis/univ3";
import { UNIV3_QUOTER_ABI } from "../abis/univ3-quoter";
import {
  getDecimals,
  getErc20DecimalBalance,
  getErc20TotalSupply,
  readContract,
  readInvariantContract,
} from "../contracts";
import { addr, same, toDecimal, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

const SQRT_PRICE_LIMIT_X96 = 2n ** 96n;

export class KodiakPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "kodiak" }>
> {
  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const [token0, token1, underlyingPool] = await Promise.all([
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "token1", [], blockNumber),
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "pool", [], blockNumber),
    ]);
    const lookupIsToken0 = same(tokenAddress, token0);
    const secondaryToken = lookupIsToken0 ? addr(token1) : addr(token0);
    const [fee, tokenDecimals, secondaryDecimals] = await Promise.all([
      readInvariantContract(this.client, addr(underlyingPool), UNIV3_ABI, "fee", [], blockNumber),
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
    return { price, liquidity: ZERO };
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const [token0, token1, reserves] = await Promise.all([
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "token1", [], blockNumber),
      readContract(
        this.client,
        this.handler.pool,
        KODIAK_ABI,
        "getUnderlyingBalances",
        [],
        blockNumber,
      ),
    ]);
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
    if (!this.isActive(blockNumber)) return null;
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;
    const supply = await getErc20TotalSupply(this.client, this.handler.pool, blockNumber);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
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
    if (!this.isActive(blockNumber)) return ZERO;
    const totalSupply = await getErc20TotalSupply(this.client, this.handler.pool, blockNumber);
    if (totalSupply.eq(ZERO)) return ZERO;
    const walletBalance = await this.getBalance(wallet, blockNumber);
    if (walletBalance.eq(ZERO)) return ZERO;
    const [token0, reserves] = await Promise.all([
      readInvariantContract(this.client, this.handler.pool, KODIAK_ABI, "token0", [], blockNumber),
      readContract(
        this.client,
        this.handler.pool,
        KODIAK_ABI,
        "getUnderlyingBalances",
        [],
        blockNumber,
      ),
    ]);
    const reserve = same(tokenAddress, token0)
      ? toDecimal(reserves[0], await getDecimals(this.client, tokenAddress, blockNumber))
      : toDecimal(reserves[1], await getDecimals(this.client, tokenAddress, blockNumber));
    return reserve.times(walletBalance).div(totalSupply);
  }
}
