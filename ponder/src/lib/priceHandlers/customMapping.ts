import type { PublicClient } from "viem";
import type { PriceHandler, PriceLookup, PriceLookupResult } from "./types";

/**
 * Maps a set of tokens to the same price as a source token.
 * E.g., sKLIMA → KLIMA (staked token has same price as underlying).
 */
export class PriceHandlerCustomMapping implements PriceHandler {
  private sourceToken: string;
  private mappedTokens: string[];

  constructor(sourceToken: string, mappedTokens: string[]) {
    this.sourceToken = sourceToken;
    this.mappedTokens = mappedTokens;
  }

  getId(): string {
    return `custom-mapping-${this.sourceToken}`;
  }

  matches(tokenAddress: string): boolean {
    const lower = tokenAddress.toLowerCase();
    return (
      this.mappedTokens.some((t) => t.toLowerCase() === lower) ||
      this.sourceToken.toLowerCase() === lower
    );
  }

  getTokens(): string[] {
    return [this.sourceToken, ...this.mappedTokens];
  }

  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
    _client: PublicClient,
  ): Promise<PriceLookupResult | null> {
    // If the queried token is one of the mapped tokens, return the source token's price
    const lower = tokenAddress.toLowerCase();
    if (this.mappedTokens.some((t) => t.toLowerCase() === lower)) {
      return priceLookup(this.sourceToken, blockNumber, this.getId());
    }
    // If the queried token is the source itself, let other handlers price it
    return null;
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
