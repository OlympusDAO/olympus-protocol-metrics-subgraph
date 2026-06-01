import { parseAbi } from "viem";

export const BALANCER_VAULT_ABI = parseAbi([
  "function getPool(bytes32 poolId) view returns (address poolAddress, uint8 specialization)",
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
]);

export const BALANCER_POOL_TOKEN_ABI = parseAbi([
  "function getNormalizedWeights() view returns (uint256[])",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
