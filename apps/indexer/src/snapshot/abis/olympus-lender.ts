import { parseAbi } from "viem";

export const OLYMPUS_LENDER_ABI = parseAbi([
  "function activeAMOCount() view returns (uint256)",
  "function activeAMOs(uint256) view returns (address)",
  "function getDeployedOhm(address) view returns (uint256)",
]);
