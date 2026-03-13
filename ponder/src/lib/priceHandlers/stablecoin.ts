import type { PublicClient } from "viem";
import type { PriceHandler, PriceLookup, PriceLookupResult } from "./types";

/**
 * Returns a price of $1.00 for stablecoins that are assumed to be pegged.
 */
export class PriceHandlerStablecoin implements PriceHandler {
  private tokens: string[];

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  getId(): string {
    return `stablecoin-${this.tokens.join("-")}`;
  }

  matches(tokenAddress: string): boolean {
    return this.tokens.some((t) => t.toLowerCase() === tokenAddress.toLowerCase());
  }

  getTokens(): string[] {
    return this.tokens;
  }

  async getPrice(
    tokenAddress: string,
    _priceLookup: PriceLookup,
    _blockNumber: bigint,
    _client: PublicClient,
  ): Promise<PriceLookupResult | null> {
    if (!this.matches(tokenAddress)) return null;
    return { price: 1.0, liquidity: 0 };
  }

  async getTotalValue(): Promise<number | null> {
    return null;
  }

  async getUnitPrice(): Promise<number | null> {
    return null;
  }

  async getBalance(): Promise<number> {
    return 0;
  }

  async getUnderlyingTokenBalance(): Promise<number> {
    return 0;
  }
}
