import { parseAbi } from "viem";

export const JONES_STAKING_ABI = parseAbi([
  "function poolInfo(uint256) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardSecond, uint256 accJonesPerShare, uint256 currentDeposit)",
  "function deposited(uint256,address) view returns (uint256)",
]);
