// RPC transport layer: per-chain viem PublicClient lifecycle, batching,
// rate limiting, retry-on-transient-error. Split out from contracts.ts per
// @0xJem on PR #311 (Step 5.2) — the cache + contract-read helpers now
// live in contract-cache.ts and the convenience contract reads
// (getErc20DecimalBalance, getBalancerPool, etc.) stay in contracts.ts.

import {
  type Address,
  type Chain,
  createPublicClient,
  fallback,
  http,
  type PublicClient,
} from "viem";
import { arbitrum, base, berachain, fantom, mainnet, polygon } from "viem/chains";

import { CHAIN_IDS, type ChainConfig, type ChainId } from "./types";

// Per-chain viem chain mapping. viem uses this for RPC error decoding,
// chain-specific multicall handling, and write-call signing semantics.
// Previously the code hard-coded `arbitrum`/`berachain` and silently
// fell back to `berachain` for every other chain — only safe by accident
// because all our snapshot work is read-only and viem's eth_call path
// doesn't enforce chain-specific behavior.
const VIEM_CHAIN_BY_ID: Record<ChainId, Chain> = {
  [CHAIN_IDS.ETHEREUM]: mainnet,
  [CHAIN_IDS.ARBITRUM]: arbitrum,
  [CHAIN_IDS.POLYGON]: polygon,
  [CHAIN_IDS.FANTOM]: fantom,
  [CHAIN_IDS.BASE]: base,
  [CHAIN_IDS.BERACHAIN]: berachain,
};

const clients = new Map<number, PublicClient>();
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RPC_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 1_000;
const DEFAULT_HTTP_BATCH_SIZE = 10;
const DEFAULT_MULTICALL_BATCH_SIZE = 128;
const DEFAULT_RPC_TIMEOUT_MS = 30_000;
// After the event-driven migration almost all snapshot data comes from
// HyperSync-backed entities; only a handful of cached effects still hit RPC.
// Per-chain rate limiting is no longer needed by default.
const DEFAULT_RPC_REQUESTS_PER_SECOND = 0;
const DEFAULT_CHAIN_RPC_REQUESTS_PER_SECOND: Record<number, number> = {};
const rpcRateLimiters = new Map<number, RpcRateLimiter | null>();

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
    chain: VIEM_CHAIN_BY_ID[config.chainId],
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
