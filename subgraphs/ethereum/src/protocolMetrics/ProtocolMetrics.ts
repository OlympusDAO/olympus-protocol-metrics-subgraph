import { BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenSupply } from "../../../shared/generated/schema";
import { getCurrentIndex } from "../../../shared/src/supply/OhmCalculations";
import { getISO8601DateStringFromTimestamp } from "../../../shared/src/utils/DateHelper";
import { LogRebase } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { ProtocolMetric } from "../../generated/schema";
import { ERC20_OHM_V2 } from "../utils/Constants";
import { getGOhmSyntheticSupply, getGOhmTotalSupply } from "../utils/GOhmCalculations";
import {
  getCirculatingSupply,
  getFloatingSupply,
  getSOhmCirculatingSupply,
  getTotalSupply,
  getTotalValueLocked,
} from "../utils/OhmCalculations";
import { getUSDRate } from "../utils/Price";
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

  pm.ohmPrice = getUSDRate(ERC20_OHM_V2, block.number);

  pm.currentIndex = getCurrentIndex(block.number);

  pm.gOhmPrice = pm.ohmPrice.times(pm.currentIndex);

  pm.totalValueLocked = getTotalValueLocked(block.number);

  // Rebase rewards, APY, rebase
  pm.nextDistributedOhm = getNextOHMRebase(blockNumber);
  const apy_rebase = getAPY_Rebase(pm.sOhmCirculatingSupply, pm.nextDistributedOhm);
  pm.currentAPY = apy_rebase[0];
  pm.nextEpochRebase = apy_rebase[1];

  // Token supply
  const ohmCirculatingSupply = getCirculatingSupply(tokenSupplies, blockNumber);
  pm.ohmCirculatingSupply = ohmCirculatingSupply;
  const ohmFloatingSupply = getFloatingSupply(tokenSupplies, blockNumber);
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

export function handleMetrics(event: LogRebase): void {
  log.debug("handleMetrics: *** Indexing block {}", [event.block.number.toString()]);

  // TokenRecord
  const tokenRecords = generateTokenRecords(event.block.timestamp, event.block.number);

  // TokenSupply
  const tokenSupplies = generateTokenSupply(event.block.timestamp, event.block.number);

  // Use the generated records to calculate protocol/treasury metrics
  // Otherwise we would be re-generating the records
  updateProtocolMetrics(event.block, tokenRecords, tokenSupplies);
}

/**
 * DO NOT USE IN PRODUCTION
 * 
 * FOR TESTING ONLY
 */
export function handleMetricsBlock(block: ethereum.Block): void {
  log.debug("handleMetrics: *** Indexing block {}", [block.number.toString()]);

  // TokenRecord
  const tokenRecords = generateTokenRecords(block.timestamp, block.number);

  // TokenSupply
  const tokenSupplies = generateTokenSupply(block.timestamp, block.number);

  // Use the generated records to calculate protocol/treasury metrics
  // Otherwise we would be re-generating the records
  updateProtocolMetrics(block, tokenRecords, tokenSupplies);
}
