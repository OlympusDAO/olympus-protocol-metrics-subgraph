import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  createPublicClient,
  getAddress,
  http,
  type PublicClient,
  type ReadContractReturnType,
} from "viem";
import { arbitrum } from "viem/chains";

import { BALANCER_VAULT_ABI } from "./abis/balancer";
import { CHAINLINK_ABI } from "./abis/chainlink";
import { ERC20_ABI } from "./abis/erc20";
import { addr, toDecimal, ZERO } from "./math";
import type { ChainConfig, LiquidityHandler } from "./types";

const clients = new Map<number, PublicClient>();

export function getClient(config: ChainConfig) {
  const existing = clients.get(config.chainId);
  if (existing) return existing;
  const client = createPublicClient({
    chain:
      config.chainId === 42161
        ? arbitrum
        : {
            id: 80094,
            name: "Berachain",
            nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
            rpcUrls: { default: { http: [config.rpcUrl] } },
          },
    transport: http(config.rpcUrl),
  });
  clients.set(config.chainId, client);
  return client;
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
    return await client.readContract({
      address: getAddress(address),
      abi,
      functionName,
      args,
      blockNumber,
    });
  } catch {
    return null;
  }
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
