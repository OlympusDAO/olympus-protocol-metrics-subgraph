import BigNumber from "bignumber.js";

import { addr, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// Chainlink feeds are the authoritative price source for assets they cover.
// We give them a high constant liquidity so the recursive router prefers them
// over pool-derived prices when both quote the same token — mirrors the legacy
// ERC4626 `U64.MAX_VALUE` pattern (see subgraphs/shared/src/price/PriceHandlerERC4626.ts:100).
const CHAINLINK_PRIORITY = new BigNumber(10).pow(30);

export class ChainlinkPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "chainlink" }>
> {
  async getPrice(
    _tokenAddress: string,
    _priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.context.ChainlinkPriceState.get(
      `${this.config.chainId}-${addr(this.handler.id)}`,
    );
    if (!state || state.answer === 0n) return null;
    return { price: toDecimal(state.answer, this.handler.decimals), liquidity: CHAINLINK_PRIORITY };
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
