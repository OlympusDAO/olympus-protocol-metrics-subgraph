import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { getISO8601StringFromTimestamp } from "../../../shared/src/utils/DateHelper";
import { StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { ProtocolMetric } from "../../generated/schema";
import { getGOhmTotalSupply } from "../utils/GOhmCalculations";
import {
  getCurrentIndex,
  getSOhmCirculatingSupply,
  getTotalSupply,
  getTotalValueLocked,
} from "../utils/OhmCalculations";
import { getBaseOhmUsdRate } from "../utils/Price";
import { generateTokenRecords, generateTokenSupply } from "../utils/TreasuryCalculations";
import { getAPY_Rebase, getNextOHMRebase } from "./Rebase";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  const dateString = getISO8601StringFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dateString);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dateString);
    protocolMetric.block = BigInt.fromString("-1");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.currentIndex = BigDecimal.fromString("0");
    protocolMetric.date = dateString;
    protocolMetric.gOhmPrice = BigDecimal.fromString("0");
    protocolMetric.gOhmTotalSupply = BigDecimal.fromString("0");
    protocolMetric.nextDistributedOhm = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.ohmPrice = BigDecimal.fromString("0");
    protocolMetric.ohmTotalSupply = BigDecimal.fromString("0");
    protocolMetric.sOhmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.timestamp = timestamp;
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");

    protocolMetric.save();
  }

  return protocolMetric as ProtocolMetric;
}

export function updateProtocolMetrics(block: ethereum.Block): void {
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

  pm.save();
}

export function handleMetrics(call: StakeCall): void {
  log.debug("handleMetrics: *** Indexing block {}", [call.block.number.toString()]);
  updateProtocolMetrics(call.block);

  // TokenRecord
  generateTokenRecords(call.block.timestamp, call.block.number);

  // TokenSupply
  generateTokenSupply(call.block.timestamp, call.block.number);
}
