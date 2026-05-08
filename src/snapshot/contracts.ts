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
import { addr, isActive, toDecimal } from "./math";
import type { ChainConfig, LiquidityHandler } from "./types";

const clients = new Map<number, PublicClient>();
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RPC_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 1_000;
const DEFAULT_HTTP_BATCH_SIZE = 1;
const DEFAULT_MULTICALL_BATCH_SIZE = 128;
const DEFAULT_RPC_TIMEOUT_MS = 30_000;
const DEFAULT_RPC_REQUESTS_PER_SECOND = 0;
const DEFAULT_CHAIN_RPC_REQUESTS_PER_SECOND: Record<number, number> = {
  42161: 5,
  80094: 5,
};
let activeContractReadCache: Map<string, Promise<unknown>> | null = null;
const invariantContractReadCache = new Map<string, Promise<unknown>>();
const rpcRateLimiters = new Map<number, RpcRateLimiter | null>();

export async function withContractReadCache<T>(operation: () => Promise<T>): Promise<T> {
  const previousCache = activeContractReadCache;
  activeContractReadCache = new Map();
  try {
    return await operation();
  } finally {
    activeContractReadCache = previousCache;
  }
}

export function getClient(config: ChainConfig) {
  const existing = clients.get(config.chainId);
  if (existing) return existing;
  const rateLimitedFetch = getRateLimitedFetch(config);
  const transports = config.rpcUrls.map((url) =>
    http(url, {
      batch: { batchSize: getHttpBatchSize() },
      fetchFn: rateLimitedFetch,
      retryCount: 0,
      timeout: getRpcTimeoutMs(),
    }),
  );
  const client = createPublicClient({
    chain: config.chainId === 42161 ? arbitrum : berachain,
    batch: { multicall: { batchSize: getMulticallBatchSize() } },
    transport: transports.length === 1 ? transports[0] : fallback(transports),
  });
  clients.set(config.chainId, client);
  return client;
}

function getHttpBatchSize(): number {
  const configured = Number(process.env.ENVIO_RPC_HTTP_BATCH_SIZE);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return DEFAULT_HTTP_BATCH_SIZE;
}

function getMulticallBatchSize(): number {
  const configured = Number(process.env.ENVIO_RPC_MULTICALL_BATCH_SIZE);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return DEFAULT_MULTICALL_BATCH_SIZE;
}

function getRpcTimeoutMs(): number {
  const configured = Number(process.env.ENVIO_RPC_TIMEOUT_MS);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return DEFAULT_RPC_TIMEOUT_MS;
}

function getRateLimitedFetch(config: ChainConfig): typeof fetch | undefined {
  const limiter = getRpcRateLimiter(config);
  if (!limiter) return undefined;
  return async (input, init) => {
    await limiter.wait();
    return fetch(input, init);
  };
}

function getRpcRateLimiter(config: ChainConfig): RpcRateLimiter | null {
  if (rpcRateLimiters.has(config.chainId)) return rpcRateLimiters.get(config.chainId) ?? null;
  const requestsPerSecond = getRpcRequestsPerSecond(config);
  const limiter = requestsPerSecond > 0 ? new RpcRateLimiter(requestsPerSecond) : null;
  rpcRateLimiters.set(config.chainId, limiter);
  return limiter;
}

function getRpcRequestsPerSecond(config: ChainConfig): number {
  const chainSpecificKey = `ENVIO_${config.blockchain.toUpperCase()}_RPC_REQUESTS_PER_SECOND`;
  const configured = getConfiguredNumber(
    process.env[chainSpecificKey] ?? process.env.ENVIO_RPC_REQUESTS_PER_SECOND,
  );
  if (configured !== null) return configured;
  return DEFAULT_CHAIN_RPC_REQUESTS_PER_SECOND[config.chainId] ?? DEFAULT_RPC_REQUESTS_PER_SECOND;
}

function getConfiguredNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const configured = Number(value);
  return Number.isFinite(configured) && configured >= 0 ? configured : null;
}

class RpcRateLimiter {
  private readonly intervalMs: number;
  private nextAvailableAt = 0;
  private queue = Promise.resolve();

  constructor(requestsPerSecond: number) {
    this.intervalMs = Math.ceil(1_000 / requestsPerSecond);
  }

  wait(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const now = Date.now();
      const delayMs = Math.max(0, this.nextAvailableAt - now);
      if (delayMs > 0) await sleep(delayMs);
      this.nextAvailableAt = Date.now() + this.intervalMs;
    });
    return this.queue;
  }
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

export async function readContract<
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
): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>> {
  const cache = activeContractReadCache;
  const cacheKey = getContractReadCacheKey(client, address, functionName, args, blockNumber);
  const cached = cache?.get(cacheKey);
  if (cached) {
    return (await cached) as ReadContractReturnType<TAbi, TFunctionName, TArgs>;
  }

  const read = retryRpc(() =>
    client.readContract({
      address: getAddress(address),
      abi,
      functionName,
      args,
      blockNumber,
    }),
  ).catch((error: unknown) => {
    cache?.delete(cacheKey);
    throw error;
  });
  cache?.set(cacheKey, read);
  return await read;
}

export async function readInvariantContract<
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
): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>> {
  const cacheKey = getInvariantContractReadCacheKey(client, address, functionName, args);
  const cached = invariantContractReadCache.get(cacheKey);
  if (cached) {
    return (await cached) as ReadContractReturnType<TAbi, TFunctionName, TArgs>;
  }

  const read = readContract(client, address, abi, functionName, args, blockNumber).catch(
    (error: unknown) => {
      invariantContractReadCache.delete(cacheKey);
      throw error;
    },
  );
  invariantContractReadCache.set(cacheKey, read);
  return await read;
}

function getContractReadCacheKey(
  client: PublicClient,
  address: string,
  functionName: string,
  args: unknown,
  blockNumber: bigint,
): string {
  return JSON.stringify([
    client.chain?.id ?? "unknown",
    getAddress(address).toLowerCase(),
    String(functionName),
    blockNumber.toString(),
    normalizeCacheValue(args),
  ]);
}

function getInvariantContractReadCacheKey(
  client: PublicClient,
  address: string,
  functionName: string,
  args: unknown,
): string {
  return JSON.stringify([
    client.chain?.id ?? "unknown",
    getAddress(address).toLowerCase(),
    String(functionName),
    normalizeCacheValue(args),
  ]);
}

function normalizeCacheValue(value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map((item) => normalizeCacheValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeCacheValue(entry)]),
  );
}

function isRetryableRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : undefined;
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  const details = "details" in error ? String(error.details) : "";
  const message = "message" in error ? String(error.message) : "";
  if (details.includes("Too Many Requests")) return true;
  if (details.includes("compute units per second capacity")) return true;
  if (message.includes("compute units per second capacity")) return true;
  return "cause" in error ? isRetryableRpcError(error.cause) : false;
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
  if (!isActive(handler, blockNumber)) return null;
  const result = await readInvariantContract(
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
  const result = await readContract(
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
