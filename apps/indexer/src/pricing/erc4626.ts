import BigNumber from "bignumber.js";

import { readErc4626AssetsPerShare } from "../effects";
import { addr, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// ERC4626 vaults (sDAI, sUSDe, sUSDS, Gauntlet sUSDS) price one share as
// `convertToAssets(1 share) × underlying_price`. Legacy reads convertToAssets
// per snapshot via RPC; we mirror that with a cached effect rather than
// indexing events (vault rate updates have no canonical event).
//
// Like Chainlink, ERC4626 carries a deterministic priority so the formula
// wins over any pool-derived quote (legacy U64.MAX_VALUE pattern).
const ERC4626_PRIORITY = new BigNumber(10).pow(30);

export class Erc4626PriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "erc4626" }>
> {
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;

    const raw = (await this.context.effect(readErc4626AssetsPerShare, {
      chainId: this.config.chainId,
      vault: addr(this.handler.id),
      shareDecimals: this.handler.decimals,
      atBlock: Number(blockNumber),
    })) as string;
    if (!raw || raw === "") return null;

    // convertToAssets(10^shareDecimals) returns the underlying amount for one
    // raw share in **underlying-raw** units. Normalize by underlyingDecimals
    // to get the normalized "assets per share" multiplier, then scale the
    // recursively-resolved underlying USD price.
    const sharesRatio = new BigNumber(raw).div(
      new BigNumber(10).pow(this.handler.underlyingDecimals),
    );
    const underlyingResult = await priceLookup(
      this.handler.underlying,
      blockNumber,
      this.handler.id,
    );
    if (underlyingResult.price.isZero()) return null;

    return {
      price: underlyingResult.price.times(sharesRatio),
      liquidity: ERC4626_PRIORITY,
    };
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
