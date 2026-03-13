import type { Address, PublicClient } from "viem";
import { parseAbi } from "viem";
import type { PriceLookupResult } from "./types";

const chainlinkAbi = parseAbi([
  "function latestAnswer() view returns (int256)",
  "function decimals() view returns (uint8)",
]);

/**
 * Reads the USD price from a Chainlink price feed.
 */
export async function getChainlinkPrice(
  client: PublicClient,
  feedAddress: Address,
  blockNumber: bigint,
): Promise<PriceLookupResult | null> {
  try {
    const [answerResult, decimalsResult] = await client.multicall({
      contracts: [
        { address: feedAddress, abi: chainlinkAbi, functionName: "latestAnswer" },
        { address: feedAddress, abi: chainlinkAbi, functionName: "decimals" },
      ],
      blockNumber,
    });

    if (answerResult.status !== "success" || decimalsResult.status !== "success") {
      return null;
    }

    const answer = answerResult.result as bigint;
    const decimals = Number(decimalsResult.result);

    return {
      price: Number(answer) / 10 ** decimals,
      liquidity: Number.MAX_SAFE_INTEGER, // Chainlink is highest priority
    };
  } catch {
    return null;
  }
}
