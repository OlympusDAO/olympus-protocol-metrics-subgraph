import type BigNumber from "bignumber.js";

import { ONE, ZERO } from "../math";
import type { LiquidityHandler } from "../types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

export class StablePriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "stable" }>
> {
  async getPrice(
    _tokenAddress: string,
    _priceLookup: PriceLookup,
    _blockNumber: bigint,
  ): Promise<PriceLookupResult> {
    return { price: ONE, liquidity: ZERO };
  }

  async getTotalValue(
    _excludedTokens: string[],
    _priceLookup: PriceLookup,
    _blockNumber: bigint,
  ): Promise<BigNumber | null> {
    return ONE;
  }

  async getUnitPrice(_priceLookup: PriceLookup, _blockNumber: bigint): Promise<BigNumber | null> {
    return ONE;
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
