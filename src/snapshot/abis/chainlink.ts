import { parseAbi } from "viem";

export const CHAINLINK_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestAnswer() view returns (int256)",
]);
