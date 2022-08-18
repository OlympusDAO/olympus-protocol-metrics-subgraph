import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { OlympusStakingV1 } from "../../generated/ProtocolMetrics/OlympusStakingV1";
import { OlympusStakingV2 } from "../../generated/ProtocolMetrics/OlympusStakingV2";
import { OlympusStakingV3, StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { ProtocolMetric } from "../../generated/schema";
import { updateBondDiscounts } from "../bonds/BondDiscounts";
import { getISO8601StringFromTimestamp } from "../helpers/DateHelper";
import {
  STAKING_CONTRACT_V1,
  STAKING_CONTRACT_V2,
  STAKING_CONTRACT_V2_BLOCK,
  STAKING_CONTRACT_V3,
  STAKING_CONTRACT_V3_BLOCK,
} from "./Constants";
import { toDecimal } from "./Decimals";
import { getGOhmTotalSupply } from "./GOhmCalculations";
import {
  getCurrentIndex,
  getSOhmCirculatingSupply,
  getTotalSupply,
  getTotalValueLocked,
} from "./OhmCalculations";
import { getBaseOhmUsdRate } from "./Price";
import { generateTokenRecords } from "./TreasuryCalculations";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  const dateString = getISO8601StringFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dateString);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dateString);
    protocolMetric.block = BigInt.fromString("-1");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.currentIndex = BigDecimal.fromString("0");
    protocolMetric.gOhmPrice = BigDecimal.fromString("0");
    protocolMetric.gOhmTotalSupply = BigDecimal.fromString("0");
    protocolMetric.nextDistributedOhm = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.ohmPrice = BigDecimal.fromString("0");
    protocolMetric.sOhmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.timestamp = timestamp;
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");

    protocolMetric.save();
  }

  return protocolMetric as ProtocolMetric;
}

function getNextOHMRebase(blockNumber: BigInt): BigDecimal {
  let next_distribution = BigDecimal.fromString("0");

  const staking_contract_v1 = OlympusStakingV1.bind(Address.fromString(STAKING_CONTRACT_V1));
  const response = staking_contract_v1.try_ohmToDistributeNextEpoch();
  if (response.reverted == false) {
    next_distribution = toDecimal(response.value, 9);
    log.debug("next_distribution v1 {}", [next_distribution.toString()]);
  } else {
    log.debug("reverted staking_contract_v1", []);
  }

  if (blockNumber.gt(BigInt.fromString(STAKING_CONTRACT_V2_BLOCK))) {
    const staking_contract_v2 = OlympusStakingV2.bind(Address.fromString(STAKING_CONTRACT_V2));
    const distribution_v2 = toDecimal(staking_contract_v2.epoch().value3, 9);
    log.debug("next_distribution v2 {}", [distribution_v2.toString()]);
    next_distribution = next_distribution.plus(distribution_v2);
  }

  if (blockNumber.gt(BigInt.fromString(STAKING_CONTRACT_V3_BLOCK))) {
    const staking_contract_v3 = OlympusStakingV3.bind(Address.fromString(STAKING_CONTRACT_V3));
    const distribution_v3 = toDecimal(staking_contract_v3.epoch().value3, 9);
    log.debug("next_distribution v3 {}", [distribution_v3.toString()]);
    next_distribution = next_distribution.plus(distribution_v3);
  }

  log.debug("next_distribution total {}", [next_distribution.toString()]);

  return next_distribution;
}

function getAPY_Rebase(sOHM: BigDecimal, distributedOHM: BigDecimal): BigDecimal[] {
  const nextEpochRebase = distributedOHM.div(sOHM).times(BigDecimal.fromString("100"));

  const nextEpochRebase_number = parseFloat(nextEpochRebase.toString());
  const currentAPY = (Math.pow(nextEpochRebase_number / 100 + 1, 365 * 3) - 1) * 100;

  const currentAPYdecimal = BigDecimal.fromString(currentAPY.toString());

  log.debug("next_rebase {}", [nextEpochRebase.toString()]);
  log.debug("current_apy total {}", [currentAPYdecimal.toString()]);

  return [currentAPYdecimal, nextEpochRebase];
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

  // TODO look at whether this can be split into a different metric
  updateBondDiscounts(blockNumber);
}

export function handleMetrics(call: StakeCall): void {
  updateProtocolMetrics(call.block);

  // TokenRecord
  generateTokenRecords(call.block.timestamp, call.block.number);

  // TokenSupply
}
