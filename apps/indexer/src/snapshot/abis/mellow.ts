import { parseAbi } from "viem";

// Verified Robinhood implementations: see docs/robinhood-mellow-integration.md.
export const MELLOW_ABI = parseAbi([
  "function sharesOf(address account) view returns (uint256)",
  "function getReport(address asset) view returns (uint224 priceD18, uint32 timestamp, bool isSuspicious)",
  "function syncDepositParams() view returns (uint256 penaltyD6, uint32 maxAge)",
  "function requestsOf(address account, uint256 offset, uint256 limit) view returns ((uint256 timestamp, uint256 shares, bool isClaimable, uint256 assets)[] requests)",
]);
