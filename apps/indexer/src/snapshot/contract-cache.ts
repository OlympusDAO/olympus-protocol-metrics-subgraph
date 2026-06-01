// Cached contract reads. Split out from contracts.ts per @0xJem on PR #311
// (Step 5.2). Two independent caches:
//
//   activeContractReadCache (per-snapshot): scoped to a single
//     withContractReadCache() invocation, then cleared. Lets the snapshot
//     handlers fan out the same (chain, contract, function, args, block)
//     read across N price lookups without N RPCs.
//
//   invariantContractReadCache (process-wide): for reads whose result is
//     immutable for a given (chain, contract, function, args) — e.g.
//     `decimals()` on an ERC20, `getPool()` on a Balancer Vault.
//     Outlives the snapshot and caches across the entire process lifetime.

import {
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  getAddress,
  type PublicClient,
  type ReadContractReturnType,
} from "viem";

import { retryRpc } from "./rpc-client";

let activeContractReadCache: Map<string, Promise<unknown>> | null = null;
const invariantContractReadCache = new Map<string, Promise<unknown>>();

export async function withContractReadCache<T>(operation: () => Promise<T>): Promise<T> {
  const previousCache = activeContractReadCache;
  activeContractReadCache = new Map();
  try {
    return await operation();
  } finally {
    activeContractReadCache = previousCache;
  }
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
