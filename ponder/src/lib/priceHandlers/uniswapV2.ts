import type { Address, PublicClient } from "viem";
import { parseAbi } from "viem";
import type { PriceHandler, PriceLookup, PriceLookupResult } from "./types";
import { readERC20Decimals, readERC20Balance } from "../contracts";

const uniswapV2PairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

function includesLoose(arr: string[], addr: string): boolean {
  const lower = addr.toLowerCase();
  return arr.some((a) => a.toLowerCase() === lower);
}

export class PriceHandlerUniswapV2 implements PriceHandler {
  private tokens: string[];
  private poolAddress: Address;

  constructor(tokens: string[], poolAddress: Address) {
    this.tokens = tokens;
    this.poolAddress = poolAddress;
  }

  getId(): string {
    return this.poolAddress;
  }

  matches(tokenAddress: string): boolean {
    return includesLoose(this.tokens, tokenAddress);
  }

  getTokens(): string[] {
    return this.tokens;
  }

  async getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<PriceLookupResult | null> {
    try {
      const [token0, token1, reserves] = await client.multicall({
        contracts: [
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "token0" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "token1" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "getReserves" },
        ],
        blockNumber,
      });

      if (token0.status !== "success" || token1.status !== "success" || reserves.status !== "success") {
        return null;
      }

      const t0 = (token0.result as string).toLowerCase();
      const t1 = (token1.result as string).toLowerCase();
      const [reserve0, reserve1] = reserves.result as [bigint, bigint, number];

      const t0Decimals = await readERC20Decimals(client, t0 as Address, blockNumber);
      const t1Decimals = await readERC20Decimals(client, t1 as Address, blockNumber);

      const t0Reserves = Number(reserve0) / 10 ** t0Decimals;
      const t1Reserves = Number(reserve1) / 10 ** t1Decimals;

      // Determine which token is the secondary (the one we need to price via recursion)
      const isToken0 = tokenAddress.toLowerCase() === t0;
      const secondaryToken = isToken0 ? t1 : t0;

      const secondaryPrice = await priceLookup(secondaryToken, blockNumber, this.getId());
      if (!secondaryPrice) return null;

      // price(A) = (reserves(B) / reserves(A)) * price(B)
      const ratio = isToken0
        ? t1Reserves / t0Reserves
        : t0Reserves / t1Reserves;

      return {
        price: ratio * secondaryPrice.price,
        liquidity: 0, // TODO: compute liquidity depth
      };
    } catch {
      return null;
    }
  }

  async getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number | null> {
    try {
      const [token0, token1, reserves] = await client.multicall({
        contracts: [
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "token0" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "token1" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "getReserves" },
        ],
        blockNumber,
      });

      if (token0.status !== "success" || token1.status !== "success" || reserves.status !== "success") {
        return null;
      }

      const t0 = (token0.result as string).toLowerCase();
      const t1 = (token1.result as string).toLowerCase();
      const [reserve0, reserve1] = reserves.result as [bigint, bigint, number];

      const t0Decimals = await readERC20Decimals(client, t0 as Address, blockNumber);
      const t1Decimals = await readERC20Decimals(client, t1 as Address, blockNumber);

      const t0Reserves = Number(reserve0) / 10 ** t0Decimals;
      const t1Reserves = Number(reserve1) / 10 ** t1Decimals;

      const t0Rate = await priceLookup(t0, blockNumber, null);
      const t1Rate = await priceLookup(t1, blockNumber, null);
      if (!t0Rate || !t1Rate) return null;

      const t0Value = includesLoose(excludedTokens, t0) ? 0 : t0Reserves * t0Rate.price;
      const t1Value = includesLoose(excludedTokens, t1) ? 0 : t1Reserves * t1Rate.price;

      return t0Value + t1Value;
    } catch {
      return null;
    }
  }

  async getUnitPrice(
    priceLookup: PriceLookup,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number | null> {
    try {
      const [totalSupplyResult, decimalsResult] = await client.multicall({
        contracts: [
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "totalSupply" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "decimals" },
        ],
        blockNumber,
      });

      if (totalSupplyResult.status !== "success" || decimalsResult.status !== "success") return null;

      const totalSupply = Number(totalSupplyResult.result as bigint) / 10 ** Number(decimalsResult.result);
      const totalValue = await this.getTotalValue([], priceLookup, blockNumber, client);
      if (!totalValue || totalSupply === 0) return null;

      return totalValue / totalSupply;
    } catch {
      return null;
    }
  }

  async getBalance(
    walletAddress: string,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number> {
    return readERC20Balance(client, this.poolAddress, walletAddress as Address, blockNumber);
  }

  async getUnderlyingTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    blockNumber: bigint,
    client: PublicClient,
  ): Promise<number> {
    try {
      const [token0, reserves, totalSupplyResult, decimalsResult] = await client.multicall({
        contracts: [
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "token0" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "getReserves" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "totalSupply" },
          { address: this.poolAddress, abi: uniswapV2PairAbi, functionName: "decimals" },
        ],
        blockNumber,
      });

      if (
        token0.status !== "success" ||
        reserves.status !== "success" ||
        totalSupplyResult.status !== "success" ||
        decimalsResult.status !== "success"
      ) {
        return 0;
      }

      const t0 = (token0.result as string).toLowerCase();
      const [reserve0, reserve1] = reserves.result as [bigint, bigint, number];

      const tokenDecimals = await readERC20Decimals(client, tokenAddress as Address, blockNumber);
      const isToken0 = tokenAddress.toLowerCase() === t0;
      const tokenReserves = isToken0
        ? Number(reserve0) / 10 ** tokenDecimals
        : Number(reserve1) / 10 ** tokenDecimals;

      const totalSupply = Number(totalSupplyResult.result as bigint) / 10 ** Number(decimalsResult.result);
      const balance = await this.getBalance(walletAddress, blockNumber, client);

      if (totalSupply === 0) return 0;
      return tokenReserves * balance / totalSupply;
    } catch {
      return 0;
    }
  }
}
