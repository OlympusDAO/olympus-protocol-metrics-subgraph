import { parseAbi } from "viem";

export const TREASURE_MINING_ABI = parseAbi([
  "function getAllUserDepositIds(address) view returns (uint256[])",
  "function userInfo(address,uint256) view returns (uint256 originalDepositAmount, uint256 depositAmount, uint256 lpAmount, uint256 lockedUntil, uint256 vestingLastUpdate, int256 rewardDebt, uint8 lock)",
]);
