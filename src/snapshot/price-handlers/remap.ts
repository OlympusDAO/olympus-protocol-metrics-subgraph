import type BigNumber from "bignumber.js";

import { ZERO } from "../math";
import type { LiquidityHandler } from "../types";
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
