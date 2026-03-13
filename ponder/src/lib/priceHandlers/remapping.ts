import type { PublicClient } from "viem";
import type { PriceHandler, PriceLookup, PriceLookupResult } from "./types";

/**
 * Maps one token's price to another token.
 * E.g., NATIVE_BERA → WBERA (they have the same price).
 */
export class PriceHandlerRemapping implements PriceHandler {
  private sourceToken: string;
  private targetToken: string;

  constructor(sourceToken: string, targetToken: string) {
    this.sourceToken = sourceToken;
    this.targetToken = targetToken;
  }

  getId(): string {
    return `remapping-${this.sourceToken}-${this.targetToken}`;
  }

  matches(tokenAddress: string): boolean {
    return tokenAddress.toLowerCase() === this.sourceToken.toLowerCase();
  }

  getTokens(): string[] {
    return [this.sourceToken, this.targetToken];
  }

  async getPrice(
    _tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
    _client: PublicClient,
  ): Promise<PriceLookupResult | null> {
    return priceLookup(this.targetToken, blockNumber, this.getId());
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
