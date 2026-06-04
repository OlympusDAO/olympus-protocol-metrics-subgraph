// Convenience contract-read helpers used by snapshot handlers + pricing.
// The transport layer (viem PublicClient, retry, rate limit, native reads)
// lives in `rpc-client.ts`. The cache layer (per-snapshot +
// process-invariant readContract / readInvariantContract) lives in
// `contract-cache.ts`. Both were extracted from this file per @0xJem on
// PR #311 (Step 5.2).

import type { Address, PublicClient } from "viem";

import { BALANCER_VAULT_ABI } from "./abis/balancer";
import { CHAINLINK_ABI } from "./abis/chainlink";
import { ERC20_ABI } from "./abis/erc20";
import { readContract, readInvariantContract } from "./contract-cache";
import { addr, isActive, toDecimal } from "./math";
import type { ChainConfig, LiquidityHandler } from "./types";

export async function getBalancerPool(
  _config: ChainConfig,
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  if (!isActive(handler, blockNumber)) return null;
  const result = await readContract(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPoolTokens",
    [handler.id],
    blockNumber,
  );
  return { tokens: result[0].map((value: string) => addr(value)), balances: result[1] as bigint[] };
}

export async function getBalancerPoolToken(
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  if (!isActive(handler, blockNumber)) return null;
  const result = await readInvariantContract(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPool",
    [handler.id],
    blockNumber,
  );
  return addr(result[0]);
}

export async function getBaseTokenRate(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const feed = config.basePriceFeeds[addr(tokenAddress)];
  if (!feed) return null;
  if (!isActive(feed, blockNumber)) return null;
  const [decimals, answer] = await Promise.all([
    readInvariantContract(client, feed.address, CHAINLINK_ABI, "decimals", [], blockNumber),
    readContract(client, feed.address, CHAINLINK_ABI, "latestAnswer", [], blockNumber),
  ]);
  if (answer <= 0n) return null;
  return toDecimal(answer, Number(decimals));
}

export async function getErc20DecimalBalance(
  client: PublicClient,
  tokenAddress: string,
  wallet: string,
  blockNumber: bigint,
) {
  const [decimals, balance] = await Promise.all([
    getDecimals(client, tokenAddress, blockNumber),
    readContract(client, tokenAddress, ERC20_ABI, "balanceOf", [wallet as Address], blockNumber),
  ]);
  return toDecimal(balance, decimals);
}

export async function getErc20RawBalance(
  client: PublicClient,
  tokenAddress: string,
  wallet: string,
  blockNumber: bigint,
) {
  return readContract(
    client,
    tokenAddress,
    ERC20_ABI,
    "balanceOf",
    [wallet as Address],
    blockNumber,
  );
}

export async function getErc20TotalSupply(
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const [decimals, totalSupply] = await Promise.all([
    getDecimals(client, tokenAddress, blockNumber),
    readContract(client, tokenAddress, ERC20_ABI, "totalSupply", [], blockNumber),
  ]);
  return toDecimal(totalSupply, decimals);
}

export async function getDecimals(client: PublicClient, tokenAddress: string, blockNumber: bigint) {
  return Number(
    await readInvariantContract(client, tokenAddress, ERC20_ABI, "decimals", [], blockNumber),
  );
}
