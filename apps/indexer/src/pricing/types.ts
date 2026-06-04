import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { isActive } from "../snapshot/math";
import type { ChainConfig, LiquidityHandler } from "../snapshot/types";

export type PriceLookupResult = {
  price: BigNumber;
  liquidity: BigNumber;
};

// PriceLookup returns the full PriceLookupResult so handlers that pass through
// the inner lookup (Remap) can preserve the inner liquidity untouched. Handlers
// that only need the price (Univ2/Univ3/Balancer/Kodiak when looking up a
// secondary token) extract `.price` at the call site. Returns
// `{ price: ZERO, liquidity: ZERO }` when no handler matches the token.
export type PriceLookup = (
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
) => Promise<PriceLookupResult>;

export interface PriceHandler {
  getId(): string;
  matches(tokenAddress: string): boolean;
  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null>;
  getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null>;
  getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null>;
  getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber>;
}

export abstract class BasePriceHandler<THandler extends LiquidityHandler> implements PriceHandler {
  constructor(
    protected readonly config: ChainConfig,
    protected readonly context: EvmOnBlockContext,
    protected readonly client: PublicClient,
    protected readonly handler: THandler,
  ) {}

  getId(): string {
    return this.handler.id;
  }

  matches(tokenAddress: string): boolean {
    return this.handler.tokens.some((value) => value.toLowerCase() === tokenAddress.toLowerCase());
  }

  protected isActive(blockNumber: bigint): boolean {
    return isActive(this.handler, blockNumber);
  }

  abstract getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<PriceLookupResult | null>;
  abstract getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
  ): Promise<BigNumber | null>;
  abstract getUnitPrice(priceLookup: PriceLookup, blockNumber: bigint): Promise<BigNumber | null>;
  abstract getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber>;
}
