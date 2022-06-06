import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { OlympusStakingV1 } from "../../generated/ProtocolMetrics/OlympusStakingV1";
import { OlympusStakingV2 } from "../../generated/ProtocolMetrics/OlympusStakingV2";
import { OlympusStakingV3, StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { ProtocolMetric } from "../../generated/schema";
import { Distributor } from "../../generated/sOlympusERC20V1/Distributor";
import { updateBondDiscounts } from "./BondDiscounts";
import {
  DISTRIBUTOR_CONTRACT,
  DISTRIBUTOR_CONTRACT_BLOCK,
  DISTRIBUTOR_CONTRACT_BLOCK_V2,
  DISTRIBUTOR_CONTRACT_V2,
  STAKING_CONTRACT_V1,
  STAKING_CONTRACT_V2,
  STAKING_CONTRACT_V2_BLOCK,
  STAKING_CONTRACT_V3,
  STAKING_CONTRACT_V3_BLOCK,
} from "./Constants";
import { dayFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
import {
  getLiquidityPoolValue,
  getOhmDaiProtocolOwnedLiquidity,
  getOhmEthProtocolOwnedLiquidity,
  getOhmFraxProtocolOwnedLiquidity,
  getOhmLusdProtocolOwnedLiquidity,
} from "./LiquidityCalculations";
import {
  getCirculatingSupply,
  getOhmMarketcap,
  getSOhmCirculatingSupply,
  getTotalSupply,
  getTotalValueLocked,
} from "./OhmCalculations";
import { getBaseOhmUsdRate } from "./Price";
import {
  getDaiMarketValue,
  getFeiMarketValue,
  getFraxMarketValue,
  getLusdMarketValue,
  getUSTBalance,
} from "./TokenStablecoins";
import {
  getCVXTotalBalance,
  getEthMarketValue,
  getFXSTotalBalance,
  getVolatileValue,
  getWBTCBalance,
  getXSushiBalance,
} from "./TokenVolatile";
import {
  getMarketValue,
  getRiskFreeValue,
  getTreasuryStableBacking,
  getTreasuryTotalBacking,
  getTreasuryVolatileBacking,
} from "./TreasuryCalculations";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  const dayTimestamp = dayFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dayTimestamp);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dayTimestamp);
    protocolMetric.timestamp = timestamp;
    protocolMetric.ohmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.sOhmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.totalSupply = BigDecimal.fromString("0");
    protocolMetric.ohmPrice = BigDecimal.fromString("0");
    protocolMetric.marketCap = BigDecimal.fromString("0");
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");
    protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryMarketValueComponents = new Array<string>();
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.nextDistributedOhm = BigDecimal.fromString("0");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryFraxRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryLusdRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryFeiRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFeiRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiMarketValueComponents = new Array<string>();
    protocolMetric.treasuryFraxMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxMarketValueComponents = new Array<string>();
    protocolMetric.treasuryLusdMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdMarketValueComponents = new Array<string>();
    protocolMetric.treasuryFeiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFeiMarketValueComponents = new Array<string>();
    protocolMetric.treasuryUstMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryUstMarketValueComponents = new Array<string>();
    protocolMetric.treasuryXsushiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryXsushiMarketValueComponents = new Array<string>();
    protocolMetric.treasuryWETHRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHRiskFreeValueComponents = new Array<string>();
    protocolMetric.treasuryWETHMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHMarketValueComponents = new Array<string>();
    protocolMetric.treasuryWBTCMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWBTCMarketValueComponents = new Array<string>();
    protocolMetric.treasuryCVXMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryCVXMarketValueComponents = new Array<string>();
    protocolMetric.treasuryFXSMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFXSMarketValueComponents = new Array<string>();
    protocolMetric.treasuryOtherMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryOtherMarketValueComponents = new Array<string>();
    protocolMetric.treasuryOhmDaiPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmFraxPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmLusdPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmEthPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryStableBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryStableBackingComponents = new Array<string>();
    protocolMetric.treasuryLPValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLPValueComponents = new Array<string>();
    protocolMetric.treasuryVolatileBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryVolatileBackingComponents = new Array<string>();
    protocolMetric.treasuryTotalBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryTotalBackingComponents = new Array<string>();

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

function getRunway(
  totalSupply: BigDecimal,
  rfv: BigDecimal,
  rebase: BigDecimal,
  block: ethereum.Block,
): BigDecimal[] {
  let runway2dot5k = BigDecimal.fromString("0");
  let runway5k = BigDecimal.fromString("0");
  let runway7dot5k = BigDecimal.fromString("0");
  let runway10k = BigDecimal.fromString("0");
  let runway20k = BigDecimal.fromString("0");
  let runway50k = BigDecimal.fromString("0");
  let runway70k = BigDecimal.fromString("0");
  let runway100k = BigDecimal.fromString("0");
  let runwayCurrent = BigDecimal.fromString("0");

  if (
    totalSupply.gt(BigDecimal.fromString("0")) &&
    rfv.gt(BigDecimal.fromString("0")) &&
    rebase.gt(BigDecimal.fromString("0"))
  ) {
    log.debug("Runway RFV", [rfv.toString()]);
    log.debug("Runway totalSupply", [totalSupply.toString()]);

    const treasury_runway = parseFloat(rfv.div(totalSupply).toString());

    const runway2dot5k_num = Math.log(treasury_runway) / Math.log(1 + 0.0029438) / 3;
    const runway5k_num = Math.log(treasury_runway) / Math.log(1 + 0.003579) / 3;
    const runway7dot5k_num = Math.log(treasury_runway) / Math.log(1 + 0.0039507) / 3;
    const runway10k_num = Math.log(treasury_runway) / Math.log(1 + 0.00421449) / 3;
    const runway20k_num = Math.log(treasury_runway) / Math.log(1 + 0.00485037) / 3;
    const runway50k_num = Math.log(treasury_runway) / Math.log(1 + 0.00569158) / 3;
    const runway70k_num = Math.log(treasury_runway) / Math.log(1 + 0.00600065) / 3;
    const runway100k_num = Math.log(treasury_runway) / Math.log(1 + 0.00632839) / 3;
    let nextEpochRebase_number = parseFloat(rebase.toString()) / 100;
    if (block.number.toI32() > DISTRIBUTOR_CONTRACT_BLOCK) {
      const distributorContract = Distributor.bind(Address.fromString(DISTRIBUTOR_CONTRACT));
      nextEpochRebase_number = parseFloat(
        toDecimal(distributorContract.info(BigInt.fromI32(4)).value0, 6).toString(),
      );
    }
    if (block.number.toI32() > DISTRIBUTOR_CONTRACT_BLOCK_V2) {
      const distributorContract_v2 = Distributor.bind(Address.fromString(DISTRIBUTOR_CONTRACT_V2));
      nextEpochRebase_number = parseFloat(
        toDecimal(distributorContract_v2.info(BigInt.fromI32(0)).value0, 6).toString(),
      );
    }
    log.debug("Runway rebase", [nextEpochRebase_number.toString()]);

    const runwayCurrent_num = Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number) / 3;

    runway2dot5k = BigDecimal.fromString(runway2dot5k_num.toString());
    runway5k = BigDecimal.fromString(runway5k_num.toString());
    runway7dot5k = BigDecimal.fromString(runway7dot5k_num.toString());
    runway10k = BigDecimal.fromString(runway10k_num.toString());
    runway20k = BigDecimal.fromString(runway20k_num.toString());
    runway50k = BigDecimal.fromString(runway50k_num.toString());
    runway70k = BigDecimal.fromString(runway70k_num.toString());
    runway100k = BigDecimal.fromString(runway100k_num.toString());
    runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString());
  }

  return [
    runway2dot5k,
    runway5k,
    runway7dot5k,
    runway10k,
    runway20k,
    runway50k,
    runway70k,
    runway100k,
    runwayCurrent,
  ];
}

export function updateProtocolMetrics(block: ethereum.Block): void {
  const blockNumber = block.number;
  log.info("Starting protocol metrics for block {}", [blockNumber.toString()]);

  const pm = loadOrCreateProtocolMetric(block.timestamp);

  // Total Supply
  pm.totalSupply = getTotalSupply(blockNumber);

  // Circ Supply
  pm.ohmCirculatingSupply = getCirculatingSupply(blockNumber, pm.totalSupply);

  // sOhm Supply
  pm.sOhmCirculatingSupply = getSOhmCirculatingSupply(blockNumber);

  // OHM Price
  pm.ohmPrice = getBaseOhmUsdRate(block.number);

  // OHM Market Cap
  pm.marketCap = getOhmMarketcap(block.number);

  // Total Value Locked
  pm.totalValueLocked = getTotalValueLocked(block.number);

  // Treasury RFV and MV
  const marketValue = getMarketValue(blockNumber);
  pm.treasuryMarketValue = marketValue.getValue();
  pm.treasuryMarketValueComponents = marketValue.toStringArray(true);

  const riskFreeValue = getRiskFreeValue(blockNumber);
  pm.treasuryRiskFreeValue = riskFreeValue.getValue();
  pm.treasuryRiskFreeValueComponents = riskFreeValue.toStringArray(true);

  const treasuryDaiRiskFree = getDaiMarketValue(blockNumber, true);
  pm.treasuryDaiRiskFreeValue = treasuryDaiRiskFree.getValue();
  pm.treasuryDaiRiskFreeValueComponents = treasuryDaiRiskFree.toStringArray(true);

  const fraxRiskFreeValue = getFraxMarketValue(blockNumber, true);
  pm.treasuryFraxRiskFreeValue = fraxRiskFreeValue.getValue();
  pm.treasuryFraxRiskFreeValueComponents = fraxRiskFreeValue.toStringArray(true);

  const daiMarketValue = getDaiMarketValue(blockNumber);
  pm.treasuryDaiMarketValue = daiMarketValue.getValue();
  pm.treasuryDaiMarketValueComponents = daiMarketValue.toStringArray(true);

  const fraxMarketValue = getFraxMarketValue(blockNumber);
  pm.treasuryFraxMarketValue = fraxMarketValue.getValue();
  pm.treasuryFraxMarketValueComponents = fraxMarketValue.toStringArray(true);

  const feiMarketValue = getFeiMarketValue(blockNumber);
  pm.treasuryFeiMarketValue = feiMarketValue.getValue();
  pm.treasuryFeiMarketValueComponents = feiMarketValue.toStringArray(true);

  const feiRiskFreeValue = getFeiMarketValue(blockNumber, true);
  pm.treasuryFeiRiskFreeValue = feiRiskFreeValue.getValue();
  pm.treasuryFeiRiskFreeValueComponents = feiRiskFreeValue.toStringArray(true);

  const xSushiValue = getXSushiBalance(blockNumber);
  pm.treasuryXsushiMarketValue = xSushiValue.getValue();
  pm.treasuryXsushiMarketValueComponents = xSushiValue.toStringArray(true);

  const ethRiskFreeValue = getEthMarketValue(blockNumber, true);
  pm.treasuryWETHRiskFreeValue = ethRiskFreeValue.getValue();
  pm.treasuryWETHRiskFreeValueComponents = ethRiskFreeValue.toStringArray(true);

  const ethMarketValue = getEthMarketValue(blockNumber);
  pm.treasuryWETHMarketValue = ethMarketValue.getValue();
  pm.treasuryWETHMarketValueComponents = ethMarketValue.toStringArray(true);

  const lusdRiskFreeValue = getLusdMarketValue(blockNumber, true);
  pm.treasuryLusdRiskFreeValue = lusdRiskFreeValue.getValue();
  pm.treasuryLusdRiskFreeValueComponents = lusdRiskFreeValue.toStringArray(true);

  const lusdMarketValue = getLusdMarketValue(blockNumber);
  pm.treasuryLusdMarketValue = lusdMarketValue.getValue();
  pm.treasuryLusdMarketValueComponents = lusdMarketValue.toStringArray(true);

  const cvxValue = getCVXTotalBalance(blockNumber);
  pm.treasuryCVXMarketValue = cvxValue.getValue();
  pm.treasuryCVXMarketValueComponents = cvxValue.toStringArray(true);

  pm.treasuryOhmDaiPOL = getOhmDaiProtocolOwnedLiquidity(blockNumber);
  pm.treasuryOhmFraxPOL = getOhmFraxProtocolOwnedLiquidity(blockNumber);
  pm.treasuryOhmLusdPOL = getOhmLusdProtocolOwnedLiquidity(blockNumber);
  pm.treasuryOhmEthPOL = getOhmEthProtocolOwnedLiquidity(blockNumber);

  const fxsValue = getFXSTotalBalance(blockNumber);
  pm.treasuryFXSMarketValue = fxsValue.getValue();
  pm.treasuryFXSMarketValueComponents = fxsValue.toStringArray(true);

  const treasuryOtherMarketValue = getVolatileValue(blockNumber, false, false);
  pm.treasuryOtherMarketValue = treasuryOtherMarketValue.getValue();
  pm.treasuryOtherMarketValueComponents = treasuryOtherMarketValue.toStringArray(true);

  const wbtcMarketValue = getWBTCBalance(blockNumber);
  pm.treasuryWBTCMarketValue = wbtcMarketValue.getValue();
  pm.treasuryWBTCMarketValueComponents = wbtcMarketValue.toStringArray(true);

  const ustValue = getUSTBalance(blockNumber);
  pm.treasuryUstMarketValue = ustValue.getValue();
  pm.treasuryUstMarketValueComponents = ustValue.toStringArray(true);

  const stableBacking = getTreasuryStableBacking(blockNumber);
  pm.treasuryStableBacking = stableBacking.getValue();
  pm.treasuryStableBackingComponents = stableBacking.toStringArray(true);

  const volatileBacking = getTreasuryVolatileBacking(blockNumber, false);
  pm.treasuryVolatileBacking = volatileBacking.getValue();
  pm.treasuryVolatileBackingComponents = volatileBacking.toStringArray(true);

  const totalBacking = getTreasuryTotalBacking(blockNumber);
  pm.treasuryTotalBacking = totalBacking.getValue();
  pm.treasuryTotalBackingComponents = totalBacking.toStringArray(true);

  const liquidityPoolValue = getLiquidityPoolValue(false, true, blockNumber);
  pm.treasuryLPValue = liquidityPoolValue.getValue();
  pm.treasuryLPValueComponents = liquidityPoolValue.toStringArray(true);

  // Rebase rewards, APY, rebase
  pm.nextDistributedOhm = getNextOHMRebase(blockNumber);
  const apy_rebase = getAPY_Rebase(pm.sOhmCirculatingSupply, pm.nextDistributedOhm);
  pm.currentAPY = apy_rebase[0];
  pm.nextEpochRebase = apy_rebase[1];

  // Runway
  const runways = getRunway(pm.totalSupply, pm.treasuryRiskFreeValue, pm.nextEpochRebase, block);
  pm.runway2dot5k = runways[0];
  pm.runway5k = runways[1];
  pm.runway7dot5k = runways[2];
  pm.runway10k = runways[3];
  pm.runway20k = runways[4];
  pm.runway50k = runways[5];
  pm.runway70k = runways[6];
  pm.runway100k = runways[7];
  pm.runwayCurrent = runways[8];

  pm.save();

  updateBondDiscounts(blockNumber);
}

export function handleMetrics(call: StakeCall): void {
  updateProtocolMetrics(call.block);
}
