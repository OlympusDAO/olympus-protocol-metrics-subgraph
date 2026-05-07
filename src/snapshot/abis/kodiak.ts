import { parseAbi } from "viem";

export const KODIAK_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getUnderlyingBalances() view returns (uint256 amount0Current, uint256 amount1Current)",
]);
