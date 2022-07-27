import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { Distributor } from "../../generated/ProtocolMetrics/Distributor";
import { OlympusStakingV1 } from "../../generated/ProtocolMetrics/OlympusStakingV1";
import { OlympusStakingV2 } from "../../generated/ProtocolMetrics/OlympusStakingV2";
import { OlympusStakingV3, StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { ProtocolMetric } from "../../generated/schema";
import { updateBondDiscounts } from "../bonds/BondDiscounts";
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
import { getGOhmCirculatingSupply, getGOhmTotalSupply } from "./GOhmCalculations";
import {
  getOhmDaiProtocolOwnedLiquidity,
  getOhmEthProtocolOwnedLiquidity,
  getOhmFraxProtocolOwnedLiquidity,
  getOhmLusdProtocolOwnedLiquidity,
  getOwnedLiquidityPoolValue,
} from "./LiquidityCalculations";
import {
  getCirculatingSupply,
  getCurrentIndex,
  getFloatingSupply,
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
  getStableValue,
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
  getTreasuryBacking,
  getTreasuryLiquidBackingPerGOhm,
  getTreasuryLiquidBackingPerOhmCirculating,
  getTreasuryLiquidBackingPerOhmFloating,
  getTreasuryProtocolOwnedLiquidityBacking,
  getTreasuryStableBacking,
  getTreasuryVolatileBacking,
} from "./TreasuryCalculations";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  const dayTimestamp = dayFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dayTimestamp);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dayTimestamp);
    protocolMetric.block = BigInt.fromString("-1");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.currentIndex = BigDecimal.fromString("0");
    protocolMetric.gOhmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.gOhmCirculatingSupplyBreakdown = "-1";
    protocolMetric.gOhmPrice = BigDecimal.fromString("0");
    protocolMetric.gOhmTotalSupply = BigDecimal.fromString("0");
    protocolMetric.marketCap = BigDecimal.fromString("0");
    protocolMetric.nextDistributedOhm = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.ohmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.ohmCirculatingSupplyBreakdown = "-1";
    protocolMetric.ohmFloatingSupply = BigDecimal.fromString("0");
    protocolMetric.ohmFloatingSupplyBreakdown = "-1";
    protocolMetric.ohmPrice = BigDecimal.fromString("0");
    protocolMetric.sOhmCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.timestamp = timestamp;
    protocolMetric.timestampISO8901 = "";
    protocolMetric.totalSupply = BigDecimal.fromString("0");
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");
    protocolMetric.treasuryCVXMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryCVXMarketValueComponents = "-1";
    protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiMarketValueComponents = "-1";
    protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiRiskFreeValueComponents = "-1";
    protocolMetric.treasuryFeiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFeiMarketValueComponents = "-1";
    protocolMetric.treasuryFeiRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFeiRiskFreeValueComponents = "-1";
    protocolMetric.treasuryFraxMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxMarketValueComponents = "-1";
    protocolMetric.treasuryFraxRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxRiskFreeValueComponents = "-1";
    protocolMetric.treasuryFXSMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFXSMarketValueComponents = "-1";
    protocolMetric.treasuryLiquidBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingComponents = "-1";
    protocolMetric.treasuryLiquidBackingPerGOhm = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingPerGOhmCirculating = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingPerOhmCirculating = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingPerOhmFloating = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingProtocolOwnedLiquidity = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingProtocolOwnedLiquidityComponents = "-1";
    protocolMetric.treasuryLiquidBackingStable = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingStableComponents = "-1";
    protocolMetric.treasuryLiquidBackingVolatile = BigDecimal.fromString("0");
    protocolMetric.treasuryLiquidBackingVolatileComponents = "-1";
    protocolMetric.treasuryLPValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLPValueComponents = "-1";
    protocolMetric.treasuryLusdMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdMarketValueComponents = "-1";
    protocolMetric.treasuryLusdRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdRiskFreeValueComponents = "-1";
    protocolMetric.treasuryMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryMarketValueComponents = "-1";
    protocolMetric.treasuryOhmDaiPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmEthPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmFraxPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmLusdPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOtherMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryOtherMarketValueComponents = "-1";
    protocolMetric.treasuryProtocolOwnedLiquidityBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryProtocolOwnedLiquidityBackingComponents = "-1";
    protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryRiskFreeValueComponents = "-1";
    protocolMetric.treasuryStableBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryStableBackingComponents = "-1";
    protocolMetric.treasuryStableValue = BigDecimal.zero();
    protocolMetric.treasuryStableValueComponents = "-1";
    protocolMetric.treasuryTotalBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryTotalBackingComponents = "-1";
    protocolMetric.treasuryUstMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryUstMarketValueComponents = "-1";
    protocolMetric.treasuryVolatileBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryVolatileBackingComponents = "-1";
    protocolMetric.treasuryVolatileValue = BigDecimal.zero();
    protocolMetric.treasuryVolatileValueComponents = "-1";
    protocolMetric.treasuryWBTCMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWBTCMarketValueComponents = "-1";
    protocolMetric.treasuryWETHMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHMarketValueComponents = "-1";
    protocolMetric.treasuryWETHRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHRiskFreeValueComponents = "-1";
    protocolMetric.treasuryXsushiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryXsushiMarketValueComponents = "-1";

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

  pm.block = blockNumber;
  pm.timestampISO8901 = new Date(block.timestamp.toI64() * 1000).toISOString();

  // OHM Total Supply
  pm.totalSupply = getTotalSupply(blockNumber);

  // OHM Circ Supply
  const ohmCirculatingSupply = getCirculatingSupply(
    "OhmCirculatingSupply",
    blockNumber,
    pm.totalSupply,
  );
  pm.ohmCirculatingSupply = ohmCirculatingSupply.value;
  pm.ohmCirculatingSupplyBreakdown = ohmCirculatingSupply.id;

  // OHM Floating supply
  const ohmFloatingSupply = getFloatingSupply("OhmFloatingSupply", pm.totalSupply, blockNumber);
  pm.ohmFloatingSupply = ohmFloatingSupply.value;
  pm.ohmFloatingSupplyBreakdown = ohmFloatingSupply.id;

  // sOhm Supply
  pm.sOhmCirculatingSupply = getSOhmCirculatingSupply(blockNumber);

  // gOHM supply
  const gOhmTotalSupply = getGOhmTotalSupply(blockNumber);
  pm.gOhmTotalSupply = gOhmTotalSupply;

  const gOhmCirculatingSupply = getGOhmCirculatingSupply(
    "gOhmCirculatingSupply",
    gOhmTotalSupply,
    blockNumber,
  );
  pm.gOhmCirculatingSupply = gOhmCirculatingSupply.value;
  pm.gOhmCirculatingSupplyBreakdown = gOhmCirculatingSupply.id;

  // OHM Price
  pm.ohmPrice = getBaseOhmUsdRate(block.number);

  pm.currentIndex = getCurrentIndex(block.number);

  pm.gOhmPrice = pm.ohmPrice.times(pm.currentIndex);

  // OHM Market Cap
  pm.marketCap = getOhmMarketcap("OhmMarketCap", block.number);

  // Total Value Locked
  pm.totalValueLocked = getTotalValueLocked(block.number);

  const stableValue = getStableValue("StableValue", blockNumber);
  pm.treasuryStableValue = stableValue.value;
  pm.treasuryStableValueComponents = stableValue.id;

  const volatileValue = getVolatileValue("VolatileValue", blockNumber, false, true, false);
  pm.treasuryVolatileValue = volatileValue.value;
  pm.treasuryVolatileValueComponents = volatileValue.id;

  const liquidityPoolValue = getOwnedLiquidityPoolValue(
    "LiquidityPoolValue",
    false,
    false,
    blockNumber,
  );
  pm.treasuryLPValue = liquidityPoolValue.value;
  pm.treasuryLPValueComponents = liquidityPoolValue.id;

  const liquidityPoolBacking = getTreasuryProtocolOwnedLiquidityBacking(
    "LiquidityPoolBacking",
    blockNumber,
  );
  pm.treasuryProtocolOwnedLiquidityBacking = liquidityPoolBacking.value;
  pm.treasuryProtocolOwnedLiquidityBackingComponents = liquidityPoolBacking.id;

  // stableValue + volatileValue + liquidityPoolValue = marketValue

  // Treasury RFV and MV
  const marketValue = getMarketValue("MarketValue", blockNumber);
  pm.treasuryMarketValue = marketValue.value;
  pm.treasuryMarketValueComponents = marketValue.id;

  const riskFreeValue = getRiskFreeValue("RiskFreeValue", blockNumber);
  pm.treasuryRiskFreeValue = riskFreeValue.value;
  pm.treasuryRiskFreeValueComponents = riskFreeValue.id;

  const treasuryDaiRiskFree = getDaiMarketValue("DaiRiskFreeValue", blockNumber, true);
  pm.treasuryDaiRiskFreeValue = treasuryDaiRiskFree.value;
  pm.treasuryDaiRiskFreeValueComponents = treasuryDaiRiskFree.id;

  const fraxRiskFreeValue = getFraxMarketValue("FraxMarketValue", blockNumber, true);
  pm.treasuryFraxRiskFreeValue = fraxRiskFreeValue.value;
  pm.treasuryFraxRiskFreeValueComponents = fraxRiskFreeValue.id;

  const daiMarketValue = getDaiMarketValue("DaiMarketValue", blockNumber);
  pm.treasuryDaiMarketValue = daiMarketValue.value;
  pm.treasuryDaiMarketValueComponents = daiMarketValue.id;

  const fraxMarketValue = getFraxMarketValue("FraxMarketValue", blockNumber);
  pm.treasuryFraxMarketValue = fraxMarketValue.value;
  pm.treasuryFraxMarketValueComponents = fraxMarketValue.id;

  const feiMarketValue = getFeiMarketValue("FeiMarketValue", blockNumber);
  pm.treasuryFeiMarketValue = feiMarketValue.value;
  pm.treasuryFeiMarketValueComponents = feiMarketValue.id;

  const feiRiskFreeValue = getFeiMarketValue("FeiRiskFreeValue", blockNumber, true);
  pm.treasuryFeiRiskFreeValue = feiRiskFreeValue.value;
  pm.treasuryFeiRiskFreeValueComponents = feiRiskFreeValue.id;

  const xSushiValue = getXSushiBalance("XSushiMarketValue", blockNumber);
  pm.treasuryXsushiMarketValue = xSushiValue.value;
  pm.treasuryXsushiMarketValueComponents = xSushiValue.id;

  const ethRiskFreeValue = getEthMarketValue("wETHRiskFreeValue", blockNumber, true);
  pm.treasuryWETHRiskFreeValue = ethRiskFreeValue.value;
  pm.treasuryWETHRiskFreeValueComponents = ethRiskFreeValue.id;

  const ethMarketValue = getEthMarketValue("wETHMarketValue", blockNumber);
  pm.treasuryWETHMarketValue = ethMarketValue.value;
  pm.treasuryWETHMarketValueComponents = ethMarketValue.id;

  const lusdRiskFreeValue = getLusdMarketValue("LUSDRiskFreeValue", blockNumber, true);
  pm.treasuryLusdRiskFreeValue = lusdRiskFreeValue.value;
  pm.treasuryLusdRiskFreeValueComponents = lusdRiskFreeValue.id;

  const lusdMarketValue = getLusdMarketValue("LUSDMarketValue", blockNumber);
  pm.treasuryLusdMarketValue = lusdMarketValue.value;
  pm.treasuryLusdMarketValueComponents = lusdMarketValue.id;

  const cvxValue = getCVXTotalBalance("CVXMarketValue", blockNumber);
  pm.treasuryCVXMarketValue = cvxValue.value;
  pm.treasuryCVXMarketValueComponents = cvxValue.id;

  pm.treasuryOhmDaiPOL = getOhmDaiProtocolOwnedLiquidity("OHM-DAI-POL", blockNumber);
  pm.treasuryOhmFraxPOL = getOhmFraxProtocolOwnedLiquidity("OHM-FRAX-POL", blockNumber);
  pm.treasuryOhmLusdPOL = getOhmLusdProtocolOwnedLiquidity("OHM-LUSD-POL", blockNumber);
  pm.treasuryOhmEthPOL = getOhmEthProtocolOwnedLiquidity("OHM-ETH-POL", blockNumber);

  const fxsValue = getFXSTotalBalance("FXSMarketValue", blockNumber);
  pm.treasuryFXSMarketValue = fxsValue.value;
  pm.treasuryFXSMarketValueComponents = fxsValue.id;

  // TODO This probably has some double-counting when combined with the *marketvalue metrics
  const treasuryOtherMarketValue = getVolatileValue(
    "OtherMarketValue",
    blockNumber,
    false,
    false,
    true,
  );
  pm.treasuryOtherMarketValue = treasuryOtherMarketValue.value;
  pm.treasuryOtherMarketValueComponents = treasuryOtherMarketValue.id;

  const wbtcMarketValue = getWBTCBalance("wBTCMarketValue", blockNumber);
  pm.treasuryWBTCMarketValue = wbtcMarketValue.value;
  pm.treasuryWBTCMarketValueComponents = wbtcMarketValue.id;

  const ustValue = getUSTBalance("USTMarketValue", blockNumber);
  pm.treasuryUstMarketValue = ustValue.value;
  pm.treasuryUstMarketValueComponents = ustValue.id;

  const stableBacking = getTreasuryStableBacking("StableBacking", blockNumber);
  pm.treasuryStableBacking = stableBacking.value;
  pm.treasuryStableBackingComponents = stableBacking.id;

  const volatileBacking = getTreasuryVolatileBacking("VolatileBacking", blockNumber, false);
  pm.treasuryVolatileBacking = volatileBacking.value;
  pm.treasuryVolatileBackingComponents = volatileBacking.id;

  const totalBacking = getTreasuryBacking("TotalBacking", false, blockNumber);
  pm.treasuryTotalBacking = totalBacking.value;
  pm.treasuryTotalBackingComponents = totalBacking.id;

  // Liquid Backing
  const liquidBacking = getTreasuryBacking("LiquidBacking", true, blockNumber);
  pm.treasuryLiquidBacking = liquidBacking.value;
  pm.treasuryLiquidBackingComponents = liquidBacking.id;

  const liquidBackingStable = getTreasuryStableBacking("LiquidStableBacking", blockNumber);
  pm.treasuryLiquidBackingStable = liquidBackingStable.value;
  pm.treasuryLiquidBackingStableComponents = liquidBackingStable.id;

  const liquidBackingVolatile = getTreasuryVolatileBacking(
    "LiquidVolatileBacking",
    blockNumber,
    true,
  );
  pm.treasuryLiquidBackingVolatile = liquidBackingVolatile.value;
  pm.treasuryLiquidBackingVolatileComponents = liquidBackingVolatile.id;

  const liquidBackingPOL = getTreasuryProtocolOwnedLiquidityBacking(
    "LiquidVolatilePOL",
    blockNumber,
  );
  pm.treasuryLiquidBackingProtocolOwnedLiquidity = liquidBackingPOL.value;
  pm.treasuryLiquidBackingProtocolOwnedLiquidityComponents = liquidBackingPOL.id;

  const liquidBackingPerGOhm = getTreasuryLiquidBackingPerGOhm("LiquidBackingPerGOhm", blockNumber);
  pm.treasuryLiquidBackingPerGOhm = liquidBackingPerGOhm;
  pm.treasuryLiquidBackingPerGOhmCirculating = liquidBackingPerGOhm; // Backwards-compatibility

  pm.treasuryLiquidBackingPerOhmCirculating = getTreasuryLiquidBackingPerOhmCirculating(
    "LiquidBackingPerOhmCirculating",
    blockNumber,
  );

  pm.treasuryLiquidBackingPerOhmFloating = getTreasuryLiquidBackingPerOhmFloating(
    "LiquidBackingPerOhmFloating",
    blockNumber,
  );

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

  // TODO look at whether this can be split into a different metric
  updateBondDiscounts(blockNumber);
}

export function handleMetrics(call: StakeCall): void {
  updateProtocolMetrics(call.block);
}
