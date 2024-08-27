import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
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

export function createProtocolMetric(timestamp: BigInt, blockNumber: BigInt): ProtocolMetric {
  const dateString = getISO8601DateStringFromTimestamp(timestamp);
  // YYYY-MM-DD/<block>
  const recordId = Bytes.fromUTF8(dateString).concatI32(blockNumber.toI32());

  const protocolMetric = new ProtocolMetric(recordId);
  protocolMetric.date = dateString;
  protocolMetric.timestamp = timestamp;

  return protocolMetric as ProtocolMetric;
}

export function updateProtocolMetrics(block: ethereum.Block, tokenRecords: TokenRecord[], tokenSupplies: TokenSupply[]): void {
  const blockNumber = block.number;
  log.info("Starting protocol metrics for block {}", [blockNumber.toString()]);

  const pm = createProtocolMetric(block.timestamp, block.number);

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

export function handleMetricsBlock(block: ethereum.Block): void {
  log.debug("handleMetricsBlock: *** Indexing block {}", [block.number.toString()]);

  // TokenRecord
  const tokenRecords = generateTokenRecords(block.timestamp, block.number);

  // TokenSupply
  const tokenSupplies = generateTokenSupply(block.timestamp, block.number);

  // Use the generated records to calculate protocol/treasury metrics
  // Otherwise we would be re-generating the records
  updateProtocolMetrics(block, tokenRecords, tokenSupplies);
}
