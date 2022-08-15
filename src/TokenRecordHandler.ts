import { StakeCall } from "../generated/ProtocolMetrics/OlympusStakingV3";
import { getStableValue } from "./utils/TokenStablecoins";
import { getVolatileValue } from "./utils/TokenVolatile";
import { getTreasuryProtocolOwnedLiquidityBacking } from "./utils/TreasuryCalculations";

export function execute(call: StakeCall): void {
  const blockNumber = call.block.number;
  //   const timestamp = new Date(call.block.timestamp.toI64() * 1000).toISOString();

  getStableValue("", blockNumber);
  getVolatileValue("", blockNumber, false, true, false);
  getTreasuryProtocolOwnedLiquidityBacking("", blockNumber);
}
