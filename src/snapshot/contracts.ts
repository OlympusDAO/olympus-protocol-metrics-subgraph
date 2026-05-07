import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  createPublicClient,
  fallback,
  getAddress,
  http,
  type PublicClient,
  type ReadContractReturnType,
} from "viem";
import { arbitrum, berachain } from "viem/chains";

import { BALANCER_VAULT_ABI } from "./abis/balancer";
import { CHAINLINK_ABI } from "./abis/chainlink";
import { ERC20_ABI } from "./abis/erc20";
import { addr, toDecimal, ZERO } from "./math";
import type { ChainConfig, LiquidityHandler } from "./types";

const clients = new Map<number, PublicClient>();
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RPC_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 1_000;

export function getClient(config: ChainConfig) {
  const existing = clients.get(config.chainId);
  if (existing) return existing;
  const transports = config.rpcUrls.map((url) => http(url, { batch: true, retryCount: 0 }));
  const client = createPublicClient({
    chain: config.chainId === 42161 ? arbitrum : berachain,
    batch: { multicall: { batchSize: 8_192 } },
    transport: transports.length === 1 ? transports[0] : fallback(transports),
  });
  clients.set(config.chainId, client);
  return client;
}

export async function retryRpc<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RPC_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableRpcError(error) || attempt === MAX_RPC_ATTEMPTS) break;
      await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

export async function getBlock(client: PublicClient, blockNumber: bigint) {
  return retryRpc(() => client.getBlock({ blockNumber }));
}

export async function getNativeBalance(
  client: PublicClient,
  address: Address,
  blockNumber: bigint,
) {
  return retryRpc(() => client.getBalance({ address, blockNumber }));
}

export async function safeRead<
  const TAbi extends Abi,
  const TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
  const TArgs extends ContractFunctionArgs<TAbi, "pure" | "view", TFunctionName>,
>(
  client: PublicClient,
  address: string,
  abi: TAbi,
  functionName: TFunctionName,
  args: TArgs,
  blockNumber: bigint,
): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs> | null> {
  try {
    return await retryRpc(() =>
      client.readContract({
        address: getAddress(address),
        abi,
        functionName,
        args,
        blockNumber,
      }),
    );
  } catch {
    return null;
  }
}

function isRetryableRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : undefined;
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  const details = "details" in error ? String(error.details) : "";
  return details.includes("Too Many Requests");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBalancerPool(
  _config: ChainConfig,
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  const result = await safeRead(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPoolTokens",
    [handler.id as `0x${string}`],
    blockNumber,
  );
  if (!result) return null;
  return { tokens: result[0].map((value: string) => addr(value)), balances: result[1] as bigint[] };
}

export async function getBalancerPoolToken(
  client: PublicClient,
  handler: Extract<LiquidityHandler, { kind: "balancer" }>,
  blockNumber: bigint,
) {
  const result = await safeRead(
    client,
    handler.vault,
    BALANCER_VAULT_ABI,
    "getPool",
    [handler.id as `0x${string}`],
    blockNumber,
  );
  return result ? addr(result[0]) : null;
}

export async function getBaseTokenRate(
  config: ChainConfig,
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const feed = config.basePriceFeeds[addr(tokenAddress)];
  if (!feed) return null;
  const [decimals, answer] = await Promise.all([
    safeRead(client, feed, CHAINLINK_ABI, "decimals", [], blockNumber),
    safeRead(client, feed, CHAINLINK_ABI, "latestAnswer", [], blockNumber),
  ]);
  if (decimals === null || answer === null || answer <= 0n) return null;
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
    safeRead(client, tokenAddress, ERC20_ABI, "balanceOf", [wallet as Address], blockNumber),
  ]);
  return balance ? toDecimal(balance, decimals) : ZERO;
}

export async function getErc20TotalSupply(
  client: PublicClient,
  tokenAddress: string,
  blockNumber: bigint,
) {
  const [decimals, totalSupply] = await Promise.all([
    getDecimals(client, tokenAddress, blockNumber),
    safeRead(client, tokenAddress, ERC20_ABI, "totalSupply", [], blockNumber),
  ]);
  return totalSupply ? toDecimal(totalSupply, decimals) : ZERO;
}

export async function getDecimals(client: PublicClient, tokenAddress: string, blockNumber: bigint) {
  const value = await safeRead(client, tokenAddress, ERC20_ABI, "decimals", [], blockNumber);
  return value === null ? 18 : Number(value);
}
