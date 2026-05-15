import type BigNumber from "bignumber.js";

import { BALANCER_POOL_TOKEN_ABI } from "../snapshot/abis/balancer";
import { getDecimals, readInvariantContract } from "../snapshot/contracts";
import { addr, getTokenDecimals, same, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Balancer V2 weighted pool poolId encodes the pool token (BPT) address in
// the first 20 bytes of the 32-byte poolId.
function bptAddressFromPoolId(poolId: string): string {
  return `0x${poolId.slice(2, 42).toLowerCase()}`;
}

export class BalancerPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "balancer" }>
> {
  private async getState() {
    return this.context.BalancerPoolState.get(
      `${this.config.chainId}-${this.handler.id.toLowerCase()}`,
    );
  }

  // Weights and BPT decimals are invariant; they're read once per pool and
  // cached process-wide. Not per-snapshot RPC.
  private async getWeightsAndDecimals(blockNumber: bigint): Promise<{
    weights: readonly bigint[];
    decimals: number;
  } | null> {
    const bpt = bptAddressFromPoolId(this.handler.id);
    const [weights, decimals] = await Promise.all([
      readInvariantContract(
        this.client,
        bpt,
        BALANCER_POOL_TOKEN_ABI,
        "getNormalizedWeights",
        [],
        blockNumber,
      ),
      getDecimals(this.client, bpt, blockNumber),
    ]);
    return { weights, decimals };
  }

  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.getState();
    if (!state) return null;
    const meta = await this.getWeightsAndDecimals(blockNumber);
    if (!meta) return null;
    const { weights, decimals } = meta;

    const lookupIndex = state.tokens.findIndex((value) => same(value, tokenAddress));
    if (lookupIndex < 0) return null;

    for (let i = 0; i < state.tokens.length; i++) {
      if (i === lookupIndex) continue;
      const secondary = await priceLookup(state.tokens[i], blockNumber, this.getId());
      if (secondary.price.eq(ZERO)) continue;
      const lookupReserve = toDecimal(
        state.balances[lookupIndex],
        getTokenDecimals(this.config.tokens, state.tokens[lookupIndex]),
      );
      const secondaryReserve = toDecimal(
        state.balances[i],
        getTokenDecimals(this.config.tokens, state.tokens[i]),
      );
      if (lookupReserve.eq(ZERO) || secondaryReserve.eq(ZERO)) continue;
      const lookupWeight = toDecimal(weights[lookupIndex], decimals);
      const secondaryWeight = toDecimal(weights[i], decimals);
      const price = secondaryReserve
        .div(secondaryWeight)
        .div(lookupReserve.div(lookupWeight))
        .times(secondary.price);
      // Balancer legacy returns liquidity = 0 (PriceHandlerBalancer.ts:216).
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
    const state = await this.getState();
    if (!state) return null;

    let total = ZERO;
    for (let i = 0; i < state.tokens.length; i++) {
      if (excludedTokens.some((excluded) => same(excluded, state.tokens[i]))) continue;
      const balance = toDecimal(
        state.balances[i],
        getTokenDecimals(this.config.tokens, state.tokens[i]),
      );
      const result = await priceLookup(state.tokens[i], blockNumber, null);
      total = total.plus(balance.times(result.price));
    }
    return total;
  }

  async getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null> {
    if (!this.isActive(blockNumber)) return null;
    const totalValue = await this.getTotalValue([], priceLookup, blockNumber);
    if (!totalValue) return null;

    const bpt = bptAddressFromPoolId(this.handler.id);
    const supplyEntity = await this.context.Erc20Supply.get(`${this.config.chainId}-${bpt}`);
    if (!supplyEntity) return null;
    const bptDecimals = getTokenDecimals(this.config.tokens, bpt);
    const supply = toDecimal(supplyEntity.totalSupply, bptDecimals);
    return supply.eq(ZERO) ? null : totalValue.div(supply);
  }

  async getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber> {
    if (!this.isActive(blockNumber)) return ZERO;
    const state = await this.getState();
    if (!state) return ZERO;

    const bpt = bptAddressFromPoolId(this.handler.id);
    const bptDecimals = getTokenDecimals(this.config.tokens, bpt);

    const supplyEntity = await this.context.Erc20Supply.get(`${this.config.chainId}-${bpt}`);
    if (!supplyEntity || supplyEntity.totalSupply === 0n) return ZERO;
    const totalSupply = toDecimal(supplyEntity.totalSupply, bptDecimals);

    const balanceEntity = await this.context.TokenBalance.get(
      `${this.config.chainId}-${bpt}-${addr(wallet)}`,
    );
    if (!balanceEntity || balanceEntity.balance === 0n) return ZERO;
    const walletBalance = toDecimal(balanceEntity.balance, bptDecimals);

    const index = state.tokens.findIndex((value) => same(value, tokenAddress));
    if (index < 0) return ZERO;
    const reserve = toDecimal(
      state.balances[index],
      getTokenDecimals(this.config.tokens, tokenAddress),
    );
    return reserve.times(walletBalance).div(totalSupply);
  }
}
