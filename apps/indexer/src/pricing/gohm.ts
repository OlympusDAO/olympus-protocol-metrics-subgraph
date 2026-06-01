import BigNumber from "bignumber.js";

import { addr, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";
import { BasePriceHandler, type PriceLookup, type PriceLookupResult } from "./types";

// gOHM has a deterministic price formula:
//   gOHM_price = OHM_price * (sOHMv3.index() / 10^9)
// Legacy implementation: Price.ts:607-609 — `getGOhmUsdRate = getBaseOhmUsdRate
// × getCurrentIndex` (subgraphs/ethereum/src/utils/Price.ts).
//
// We mirror Chainlink's CHAINLINK_PRIORITY tiebreaker so gOHM's deterministic
// price beats any pool-derived gOHM quote, matching legacy's deterministic
// resolvePrice override (case 6 — "gOHM: OHM price × current index").
const GOHM_PRIORITY = new BigNumber(10).pow(30);

// sOHM index is 9-decimal precision (same as OHM's decimals on Ethereum).
const SOHM_INDEX_DECIMALS = 9;

export class GohmPriceHandler extends BasePriceHandler<
  Extract<LiquidityHandler, { kind: "gohm" }>
> {
  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null> {
    if (!this.isActive(blockNumber)) return null;
    const state = await this.context.OhmIndexState.get(
      `${this.config.chainId}-${addr(this.handler.id)}`,
    );
    if (!state || state.index === 0n) return null;

    // Recursive lookup for OHM. Pass our handler id as currentPool so the
    // router skips this handler if it ever gets matched again (cycle guard).
    const ohmResult = await priceLookup(this.handler.ohmToken, blockNumber, this.handler.id);
    if (ohmResult.price.isZero()) return null;

    const indexDecimal = toDecimal(state.index, SOHM_INDEX_DECIMALS);
    return { price: ohmResult.price.times(indexDecimal), liquidity: GOHM_PRIORITY };
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
