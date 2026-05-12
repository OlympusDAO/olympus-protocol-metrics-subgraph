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
    const price = await priceLookup(this.handler.target, blockNumber, this.getId());
    if (price.eq(ZERO)) return null;
    return { price, liquidity: ZERO };
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
