import type BigNumber from "bignumber.js";
import type { PublicClient } from "viem";

import { isActive } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";

export type PriceLookup = (
  tokenAddress: string,
  blockNumber: bigint,
  currentPool: string | null,
) => Promise<BigNumber>;

export type PriceLookupResult = {
  price: BigNumber;
  liquidity: BigNumber;
};

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
  getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber>;
  getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber>;
}

export abstract class BasePriceHandler<THandler extends LiquidityHandler> implements PriceHandler {
  constructor(
    protected readonly config: ChainConfig,
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

  abstract getBalance(wallet: string, blockNumber: bigint): Promise<BigNumber>;

  abstract getUnderlyingTokenBalance(
    wallet: string,
    tokenAddress: string,
    blockNumber: bigint,
  ): Promise<BigNumber>;
}
