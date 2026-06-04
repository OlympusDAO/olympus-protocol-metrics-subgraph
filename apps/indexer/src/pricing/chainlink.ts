import BigNumber from "bignumber.js";

import { readChainlinkLatestAnswer } from "../effects";
import { toDecimal, ZERO } from "../snapshot/math";
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
    // Read the proxy's `latestAnswer()` at the snapshot block via cached
    // effect. We can't subscribe to AnswerUpdated events on the proxy
    // (only the dynamic underlying aggregator emits them and we'd need to
    // chase Chainlink phase transitions to subscribe correctly), so this
    // matches legacy treasury-subgraph behaviour exactly: one RPC per
    // (chain, feed, block), cached so identical lookups in a snapshot dedup.
    const raw = await this.context.effect(readChainlinkLatestAnswer, {
      chainId: this.config.chainId,
      feedAddress: this.handler.id,
      atBlock: Number(blockNumber),
    });
    const answer = BigInt(raw);
    if (answer === 0n) return null;
    return { price: toDecimal(answer, this.handler.decimals), liquidity: CHAINLINK_PRIORITY };
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
