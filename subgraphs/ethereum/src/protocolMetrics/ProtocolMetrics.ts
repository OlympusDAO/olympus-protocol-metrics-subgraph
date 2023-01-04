import { BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../../common/generated/schema";
import { getISO8601DateStringFromTimestamp } from "../../../../common/src/utils/DateHelper";
import { StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { ProtocolMetric, TokenSupply } from "../../generated/schema";
import { getGOhmSyntheticSupply, getGOhmTotalSupply } from "../utils/GOhmCalculations";
import {
  getCirculatingSupply,
  getCurrentIndex,
  getFloatingSupply,
  getSOhmCirculatingSupply,
  getTotalSupply,
  getTotalValueLocked,
} from "../utils/OhmCalculations";
import { getBaseOhmUsdRate } from "../utils/Price";
import { generateTokenRecords, generateTokenSupply } from "../utils/TreasuryCalculations";
import { getAPY_Rebase, getNextOHMRebase } from "./Rebase";
import { getMarketCap, getTreasuryLiquidBacking, getTreasuryLiquidBackingPerGOhmSynthetic, getTreasuryLiquidBackingPerOhmFloating, getTreasuryMarketValue } from "./TreasuryMetrics";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  const dateString = getISO8601DateStringFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dateString);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dateString);
    protocolMetric.date = dateString;
    protocolMetric.timestamp = timestamp;
  }

  return protocolMetric as ProtocolMetric;
}

export function updateProtocolMetrics(block: ethereum.Block, tokenRecords: TokenRecord[], tokenSupplies: TokenSupply[]): void {
  const blockNumber = block.number;
  log.info("Starting protocol metrics for block {}", [blockNumber.toString()]);

  const pm = loadOrCreateProtocolMetric(block.timestamp);

  pm.block = blockNumber;

  pm.ohmTotalSupply = getTotalSupply(blockNumber);

  pm.sOhmCirculatingSupply = getSOhmCirculatingSupply(blockNumber);

  const gOhmTotalSupply = getGOhmTotalSupply(blockNumber);
  pm.gOhmTotalSupply = gOhmTotalSupply;

  pm.ohmPrice = getBaseOhmUsdRate(block.number);

  pm.currentIndex = getCurrentIndex(block.number);

  pm.gOhmPrice = pm.ohmPrice.times(pm.currentIndex);

  pm.totalValueLocked = getTotalValueLocked(block.number);

  // Rebase rewards, APY, rebase
  pm.nextDistributedOhm = getNextOHMRebase(blockNumber);
  const apy_rebase = getAPY_Rebase(pm.sOhmCirculatingSupply, pm.nextDistributedOhm);
  pm.currentAPY = apy_rebase[0];
  pm.nextEpochRebase = apy_rebase[1];

  // Token supply
  const ohmCirculatingSupply = getCirculatingSupply(tokenSupplies);
  pm.ohmCirculatingSupply = ohmCirculatingSupply;
  const ohmFloatingSupply = getFloatingSupply(tokenSupplies);
  pm.ohmFloatingSupply = ohmFloatingSupply;
  const gOhmSyntheticSupply = getGOhmSyntheticSupply(ohmFloatingSupply, pm.currentIndex);
  pm.gOhmSyntheticSupply = gOhmSyntheticSupply;

  // Treasury
  pm.marketCap = getMarketCap(pm.ohmPrice, ohmCirculatingSupply);
  pm.treasuryMarketValue = getTreasuryMarketValue(tokenRecords);
  const liquidBacking = getTreasuryLiquidBacking(tokenRecords);
  pm.treasuryLiquidBacking = liquidBacking;
  pm.treasuryLiquidBackingPerOhmFloating = getTreasuryLiquidBackingPerOhmFloating(liquidBacking, ohmFloatingSupply);
  pm.treasuryLiquidBackingPerGOhmSynthetic = getTreasuryLiquidBackingPerGOhmSynthetic(liquidBacking, gOhmSyntheticSupply);

  pm.save();
}

export function handleMetrics(call: StakeCall): void {
  log.debug("handleMetrics: *** Indexing block {}", [call.block.number.toString()]);

  // TokenRecord
  const tokenRecords = generateTokenRecords(call.block.timestamp, call.block.number);

  // TokenSupply
  const tokenSupplies = generateTokenSupply(call.block.timestamp, call.block.number);

  // Use the generated records to calculate protocol/treasury metrics
  // Otherwise we would be re-generating the records
  updateProtocolMetrics(call.block, tokenRecords, tokenSupplies);
}
