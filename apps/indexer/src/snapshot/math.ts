import BigNumber from "bignumber.js";
import { BigDecimal } from "envio";

import type { BasePriceFeed, Bytes32, LiquidityHandler, TokenDefinition } from "./types";

export const ZERO = new BigNumber(0);
export const ONE = new BigNumber(1);

// Convert a bignumber.js value to Envio's BigDecimal (postgres NUMERIC).
// Goes through the base-10 string form so arbitrary precision is preserved
// across the FFI boundary — neither BigNumber nor BigDecimal lose precision
// to floating point in this round-trip. Replaces the repeated
// `new BigDecimal(value.toString(10))` pattern from BlockHandlers.ts.
export function toBigDecimal(value: BigNumber): BigDecimal {
  return new BigDecimal(value.toFixed());
}

// Named-parameter factory for token definitions. The previous positional
// form required `undefined` for skipped optionals (e.g.
// `token(addr, "Volatile", true, false, undefined, { decimals: 18 })`)
// per @0xJem on PR #311; the named form drops the floating undefined and
// makes call sites self-documenting at the cost of slightly more
// vertical space for the common case.
export function token(args: {
  address: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
  multiplier?: string;
  startBlock?: number;
  decimals?: number;
  isLiability?: boolean;
  nonStandardBalance?: boolean;
}): TokenDefinition {
  return {
    address: addr(args.address),
    category: args.category,
    isLiquid: args.isLiquid,
    isBluechip: args.isBluechip,
    multiplier: args.multiplier,
    decimals: args.decimals ?? 18,
    startBlock: args.startBlock,
    isLiability: args.isLiability,
    nonStandardBalance: args.nonStandardBalance,
  };
}

export function getTokenDecimals(
  tokens: TokenDefinition[],
  address: string,
  fallback = 18,
): number {
  const lower = addr(address);
  return tokens.find((value) => value.address === lower)?.decimals ?? fallback;
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

// UniV3 token amounts from L + sqrtPrice + tick bounds. Mirrors legacy
// `getPairBalances` exactly — uses lossy Math.pow on the tick → sqrt-ratio
// conversion so historical parity stays exact. Output is in raw token units
// (apply each token's decimals when consumed).
export function univ3PositionAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
): { amount0: bigint; amount1: bigint } {
  const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
  const sqrtLower = Math.sqrt(1.0001 ** tickLower);
  const sqrtUpper = Math.sqrt(1.0001 ** tickUpper);
  const L = Number(liquidity);
  let amount0Float = 0;
  let amount1Float = 0;
  if (sqrtPrice <= sqrtLower) {
    amount0Float = L * ((sqrtUpper - sqrtLower) / (sqrtUpper * sqrtLower));
  } else if (sqrtPrice >= sqrtUpper) {
    amount1Float = L * (sqrtUpper - sqrtLower);
  } else {
    amount0Float = L * ((sqrtUpper - sqrtPrice) / (sqrtUpper * sqrtPrice));
    amount1Float = L * (sqrtPrice - sqrtLower);
  }
  return {
    amount0: BigInt(Math.max(0, Math.floor(amount0Float))),
    amount1: BigInt(Math.max(0, Math.floor(amount1Float))),
  };
}
