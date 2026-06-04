import type BigNumber from "bignumber.js";

import { ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

export class RemapPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "remap" }>
> {
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    // Pass through the inner lookup verbatim so the chosen downstream
    // handler's liquidity propagates to the router's tiebreaker. Matches
    // legacy PriceHandlerRemapping.ts:36.
    const result = await priceLookup(this.handler.target, blockNumber, this.getId());
    if (result.price.eq(ZERO)) return null;
    return result;
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
