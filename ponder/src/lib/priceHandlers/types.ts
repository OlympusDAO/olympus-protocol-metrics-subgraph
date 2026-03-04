import type { PublicClient } from "viem";

export interface PriceLookupResult {
  price: number;
  liquidity: number;
}

/**
 * Recursive price lookup function.
 * Passed into handlers so they can look up the USD price of counterpart tokens.
 *
 * @param tokenAddress - address of the token to price
 * @param blockNumber - block number for the read
 * @param currentPool - handler ID of the calling pool (anti-recursion guard)
 */
export type PriceLookup = (
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
) => Promise<PriceLookupResult | null>;

/**
 * Port of the AssemblyScript PriceHandler interface.
 * Each handler knows how to price tokens from a specific liquidity source.
 */
export interface PriceHandler {
  /** Unique identifier (typically the pool address or pool ID) */
  getId(): string;

  /** Returns true if this handler can price the given token */
  matches(tokenAddress: string): boolean;

  /** Returns the token addresses this handler covers */
  getTokens(): string[];

  /** Get the USD price of tokenAddress */
  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<PriceLookupResult | null>;

  /** Total USD value of the pool, optionally excluding certain tokens */
  getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number | null>;

  /** Unit price of 1 LP token */
  getUnitPrice(
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number | null>;

  /** Balance of LP tokens held by walletAddress */
  getBalance(
    walletAddress: string,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number>;

  /** Balance of underlying token held by the pool, attributable to walletAddress's LP share */
  getUnderlyingTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number>;
}
