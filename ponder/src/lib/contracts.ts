import type { Address, PublicClient } from "viem";
import { parseAbi } from "viem";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

/** Cache for token decimals to avoid repeated RPC calls within a block */
const decimalsCache = new Map<string, number>();

export async function readERC20Decimals(
  client: PublicClient,
  tokenAddress: Address,
  blockNumber: bigint,
): Promise<number> {
  const key = tokenAddress.toLowerCase();
  if (decimalsCache.has(key)) {
    return decimalsCache.get(key)!;
  }

  try {
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
      blockNumber,
    });
    const result = Number(decimals);
    decimalsCache.set(key, result);
    return result;
  } catch {
    return 18; // default
  }
}

export async function readERC20Balance(
  client: PublicClient,
  tokenAddress: Address,
  walletAddress: Address,
  blockNumber: bigint,
): Promise<number> {
  try {
    const decimals = await readERC20Decimals(client, tokenAddress, blockNumber);
    const balance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
      blockNumber,
    });
    return Number(balance) / 10 ** decimals;
  } catch {
    return 0;
  }
}

export async function readERC20TotalSupply(
  client: PublicClient,
  tokenAddress: Address,
  blockNumber: bigint,
): Promise<number> {
  try {
    const decimals = await readERC20Decimals(client, tokenAddress, blockNumber);
    const totalSupply = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "totalSupply",
      blockNumber,
    });
    return Number(totalSupply) / 10 ** decimals;
  } catch {
    return 0;
  }
}

/**
 * Read ERC20 balances for a token across multiple wallets.
 * Uses multicall for efficiency.
 */
export async function readERC20BalancesMulticall(
  client: PublicClient,
  tokenAddress: Address,
  walletAddresses: Address[],
  blockNumber: bigint,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  if (walletAddresses.length === 0) return results;

  try {
    const decimals = await readERC20Decimals(client, tokenAddress, blockNumber);

    const calls = walletAddresses.map((wallet) => ({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [wallet] as const,
    }));

    const multicallResults = await client.multicall({ contracts: calls, blockNumber });

    for (let i = 0; i < walletAddresses.length; i++) {
      const result = multicallResults[i];
      if (result.status === "success") {
        const balance = Number(result.result as bigint) / 10 ** decimals;
        if (balance > 0) {
          results.set(walletAddresses[i].toLowerCase(), balance);
        }
      }
    }
  } catch {
    // Fallback: try one at a time
    for (const wallet of walletAddresses) {
      const balance = await readERC20Balance(client, tokenAddress, wallet, blockNumber);
      if (balance > 0) {
        results.set(wallet.toLowerCase(), balance);
      }
    }
  }

  return results;
}

/**
 * Read native token (ETH/BERA/MATIC/FTM) balance for a wallet.
 */
export async function readNativeBalance(
  client: PublicClient,
  walletAddress: Address,
  blockNumber: bigint,
): Promise<number> {
  try {
    const balance = await client.getBalance({ address: walletAddress, blockNumber });
    return Number(balance) / 10 ** 18;
  } catch {
    return 0;
  }
}
