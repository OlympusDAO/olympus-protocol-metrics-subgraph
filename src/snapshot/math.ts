import BigNumber from "bignumber.js";

import type { BasePriceFeed, Bytes32, LiquidityHandler, TokenDefinition } from "./types";

export const ZERO = new BigNumber(0);
export const ONE = new BigNumber(1);

export function token(
  address: string,
  category: string,
  isLiquid: boolean,
  isBluechip: boolean,
  multiplier?: string,
  options: { startBlock?: number } = {},
): TokenDefinition {
  return { address: addr(address), category, isLiquid, isBluechip, multiplier, ...options };
}

export function feed(address: string, startBlock?: number): BasePriceFeed {
  return { address: addr(address), startBlock };
}

export function toDecimal(value: bigint, decimals: number) {
  return new BigNumber(value.toString()).div(new BigNumber(10).pow(decimals));
}

export function isoDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
}

export function addr(value: string) {
  return value.toLowerCase();
}

export function bytes32(value: string): Bytes32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Invalid bytes32 value: ${value}`);
  }
  return value.toLowerCase() as Bytes32;
}

export function same(left: string, right: string) {
  return addr(left) === addr(right);
}

export function matches(handler: LiquidityHandler, tokenAddress: string) {
  return handler.tokens.some((value) => same(value, tokenAddress));
}

export function isActive(definition: { startBlock?: number }, blockNumber: bigint) {
  return definition.startBlock === undefined || blockNumber >= BigInt(definition.startBlock);
}
