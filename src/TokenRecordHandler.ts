import { StakeCall } from "../generated/ProtocolMetrics/OlympusStakingV3";
import { getMarketValue } from "./utils/TreasuryCalculations";

export function execute(call: StakeCall): void {
  const blockNumber = call.block.number;

  /**
   * The handler is executed on every rebase (~ 8 hours). However, we only want 1 record per day
   * (in GMT), so we use the date (YYYY-MM-DD) as a unique identifier.
   */
  const date = new Date(call.block.timestamp.toI64() * 1000).toISOString().slice(0, 10);

  // This calculates stable, volatile and POL
  getMarketValue(date, blockNumber);

  // This calculates the OHM price
}
