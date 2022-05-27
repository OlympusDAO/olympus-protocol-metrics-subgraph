import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";

import { OlympusStakingV1 } from "../../generated/ProtocolMetrics/OlympusStakingV1";
import { OlympusStakingV2 } from "../../generated/ProtocolMetrics/OlympusStakingV2";
import { OlympusStakingV3, StakeCall } from "../../generated/ProtocolMetrics/OlympusStakingV3";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
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
  SUSHI_OHMETH_PAIR,
  SUSHI_OHMETH_PAIR_BLOCK,
  SUSHI_OHMETH_PAIR_BLOCKV2,
  SUSHI_OHMETH_PAIRV2,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V2_BLOCK,
  TREASURY_ADDRESS_V3,
  UST_ERC20_CONTRACT,
  WBTC_ERC20_CONTRACT,
  WETH_ERC20_CONTRACT,
  XSUSI_ERC20_CONTRACT,
} from "./Constants";
import { getERC20 } from "./ContractHelper";
import { dayFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
import {
  getOhmDaiProtocolOwnedLiquidity,
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
import { clearPriceCache, getDiscountedPairUSD, getOHMUSDRate, getPairWETH } from "./Price";
import {
  getDaiMarketValue,
  getDaiRiskFreeValue,
  getFraxMarketValue,
  getFraxRiskFreeValue,
  getLusdMarketValue,
  getLusdRiskFreeValue,
  getStableValue,
  getUSTBalance,
} from "./TokenStablecoins";
import {
  getCVXVlCVXBalance,
  getVolatileValue,
  getWBTCBalance,
  getWETHBalance,
  getXSushiBalance,
} from "./TokenVolatile";
import {
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
    protocolMetric.treasuryMarketValue = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.nextDistributedOhm = BigDecimal.fromString("0");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryFraxMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryLusdMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryUstMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryXsushiMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWETHMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryWBTCMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryCVXMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryOtherMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmDaiPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmFraxPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmLusdPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryOhmEthPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryStableBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryLPValue = BigDecimal.fromString("0");
    protocolMetric.treasuryVolatileBacking = BigDecimal.fromString("0");
    protocolMetric.treasuryTotalBacking = BigDecimal.fromString("0");

    protocolMetric.save();
  }
  return protocolMetric as ProtocolMetric;
}

function getMV_RFV(blockNumber: BigInt): BigDecimal[] {
  const ohmethPair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMETH_PAIR));
  const ohmethPairv2 = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMETH_PAIRV2));

  let treasury_address = TREASURY_ADDRESS;
  if (blockNumber.gt(BigInt.fromString(TREASURY_ADDRESS_V2_BLOCK))) {
    treasury_address = TREASURY_ADDRESS_V2;
  }

  const ustTokens = getUSTBalance(getERC20("UST", UST_ERC20_CONTRACT, blockNumber), blockNumber);
  const ustBalance = ustTokens.getValue();

  // TODO add balancer
  // TODO add uniswap v3

  const volatile_records = getVolatileValue(blockNumber, false);
  const volatile_value = volatile_records.getValue();

  const wethBalance = getWETHBalance(
    getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  const weth_value = wethBalance.getValue();

  const wbtcBalance = getWBTCBalance(
    getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  const wbtc_value = wbtcBalance.getValue();

  // OHM-DAI Liquidity
  const ohmDaiPOL = getOhmDaiProtocolOwnedLiquidity(blockNumber);
  const ohmDaiMarket = getDaiMarketValue(blockNumber);
  const ohmDaiRiskFreeValue = getDaiRiskFreeValue(blockNumber);

  // OHM-FRAX Liquidity
  const ohmFraxPOL = getOhmFraxProtocolOwnedLiquidity(blockNumber);
  const ohmFraxMarket = getFraxMarketValue(blockNumber);
  const ohmFraxRiskFreeValue = getFraxRiskFreeValue(blockNumber);

  // OHM-LUSD Liquidity
  const ohmLusdPOL = getOhmLusdProtocolOwnedLiquidity(blockNumber);
  const ohmLusdMarket = getLusdMarketValue(blockNumber);
  const ohmLusdRiskFreeValue = getLusdRiskFreeValue(blockNumber);

  // OHMETH
  let ohmethBalance = BigInt.fromI32(0);
  let ohmeth_value = BigDecimal.fromString("0");
  let ohmeth_rfv = BigDecimal.fromString("0");
  let ohmethTotalLP = BigDecimal.fromString("0");
  let ohmethPOL = BigDecimal.fromString("0");
  if (blockNumber.gt(BigInt.fromString(SUSHI_OHMETH_PAIR_BLOCK))) {
    ohmethBalance = ohmethPair
      .balanceOf(Address.fromString(treasury_address))
      .plus(ohmethPair.balanceOf(Address.fromString(TREASURY_ADDRESS_V3)));
    log.debug("ohmethBalance {}", [ohmethBalance.toString()]);

    ohmeth_value = getPairWETH(ohmethBalance, SUSHI_OHMETH_PAIR, blockNumber);
    log.debug("ohmeth_value {}", [ohmeth_value.toString()]);

    ohmeth_rfv = getDiscountedPairUSD(ohmethBalance, SUSHI_OHMETH_PAIR);
    ohmethTotalLP = toDecimal(ohmethPair.totalSupply(), 18);
    if (ohmethTotalLP.gt(BigDecimal.fromString("0")) && ohmethBalance.gt(BigInt.fromI32(0))) {
      ohmethPOL = toDecimal(ohmethBalance, 18)
        .div(ohmethTotalLP)
        .times(BigDecimal.fromString("100"));
    }
  }

  if (blockNumber.gt(BigInt.fromString(SUSHI_OHMETH_PAIR_BLOCKV2))) {
    ohmethBalance = ohmethPairv2.balanceOf(Address.fromString(TREASURY_ADDRESS_V3));
    log.debug("ohmethBalance {}", [ohmethBalance.toString()]);

    ohmeth_value = getPairWETH(ohmethBalance, SUSHI_OHMETH_PAIRV2, blockNumber);
    log.debug("ohmeth_value {}", [ohmeth_value.toString()]);

    ohmeth_rfv = getDiscountedPairUSD(ohmethBalance, SUSHI_OHMETH_PAIRV2);
    ohmethTotalLP = toDecimal(ohmethPairv2.totalSupply(), 18);
    if (ohmethTotalLP.gt(BigDecimal.fromString("0")) && ohmethBalance.gt(BigInt.fromI32(0))) {
      ohmethPOL = toDecimal(ohmethBalance, 18)
        .div(ohmethTotalLP)
        .times(BigDecimal.fromString("100"));
    }
  }

  const stableValueRecords = getStableValue(blockNumber);
  const stableValueDecimal = stableValueRecords.getValue();

  const treasuryVolatileBackingRecords = getTreasuryVolatileBacking(blockNumber, false);
  const treasuryVolatileBacking = treasuryVolatileBackingRecords.getValue();

  const lpValue = ohmDaiMarket
    .getValue()
    .plus(ohmFraxMarket.getValue())
    .plus(ohmLusdMarket.getValue())
    .plus(ohmeth_value);
  const rfvLpValue = ohmDaiRiskFreeValue
    .getValue()
    .plus(ohmFraxRiskFreeValue.getValue())
    .plus(ohmLusdRiskFreeValue.getValue())
    .plus(ohmeth_rfv);

  const mv = stableValueDecimal
    .plus(lpValue)
    .plus(weth_value)
    .plus(wbtc_value)
    .plus(volatile_value);
  const rfv = stableValueDecimal.plus(rfvLpValue);

  const cvxVlCvxValue = getCVXVlCVXBalance(blockNumber).getValue();
  const xSushiBalance = getXSushiBalance(
    getERC20("xSUSHI", XSUSI_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  const xSushiValue = xSushiBalance.getValue();

  const treasuryStableBackingRecords = getTreasuryStableBacking(blockNumber);
  const treasuryStableBacking = treasuryStableBackingRecords.getValue();
  const treasuryTotalBackingRecords = getTreasuryTotalBacking(
    blockNumber,
    lpValue.div(BigDecimal.fromString("2")),
    getCirculatingSupply(blockNumber, getTotalSupply(blockNumber)),
  );
  const treasuryTotalBacking = treasuryTotalBackingRecords.getValue();
  const treasuryLPValue = lpValue;

  log.debug("Treasury Market Value {}", [mv.toString()]);
  log.debug("Treasury RFV {}", [rfv.toString()]);
  log.debug("Treasury xSushi value {}", [xSushiValue.toString()]);
  log.debug("Treasury WETH value {}", [weth_value.toString()]);
  log.debug("Treasury OHM-DAI RFV {}", [ohmDaiRiskFreeValue.getValue().toString()]);
  log.debug("Treasury OHM-FRAX RFV {}", [ohmFraxRiskFreeValue.getValue().toString()]);
  return [
    mv,
    rfv,
    ohmDaiRiskFreeValue.getValue(),
    ohmFraxRiskFreeValue.getValue(),
    ohmDaiMarket.getValue(),
    ohmFraxMarket.getValue(),
    xSushiValue,
    ohmeth_rfv.plus(weth_value),
    ohmeth_value.plus(weth_value),
    ohmLusdRiskFreeValue.getValue(),
    ohmLusdMarket.getValue(),
    cvxVlCvxValue,
    // POL
    ohmDaiPOL,
    ohmFraxPOL,
    ohmLusdPOL,
    ohmethPOL,
    volatile_value,
    wbtc_value,
    ustBalance,
    treasuryStableBacking,
    treasuryVolatileBacking,
    treasuryTotalBacking,
    treasuryLPValue,
  ];
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

  const nextEpochRebase_number = Number.parseFloat(nextEpochRebase.toString());
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

    const treasury_runway = Number.parseFloat(rfv.div(totalSupply).toString());

    const runway2dot5k_num = Math.log(treasury_runway) / Math.log(1 + 0.0029438) / 3;
    const runway5k_num = Math.log(treasury_runway) / Math.log(1 + 0.003579) / 3;
    const runway7dot5k_num = Math.log(treasury_runway) / Math.log(1 + 0.0039507) / 3;
    const runway10k_num = Math.log(treasury_runway) / Math.log(1 + 0.00421449) / 3;
    const runway20k_num = Math.log(treasury_runway) / Math.log(1 + 0.00485037) / 3;
    const runway50k_num = Math.log(treasury_runway) / Math.log(1 + 0.00569158) / 3;
    const runway70k_num = Math.log(treasury_runway) / Math.log(1 + 0.00600065) / 3;
    const runway100k_num = Math.log(treasury_runway) / Math.log(1 + 0.00632839) / 3;
    let nextEpochRebase_number = Number.parseFloat(rebase.toString()) / 100;
    if (block.number.toI32() > DISTRIBUTOR_CONTRACT_BLOCK) {
      const distributorContract = Distributor.bind(Address.fromString(DISTRIBUTOR_CONTRACT));
      nextEpochRebase_number = Number.parseFloat(
        toDecimal(distributorContract.info(BigInt.fromI32(4)).value0, 6).toString(),
      );
    }
    if (block.number.toI32() > DISTRIBUTOR_CONTRACT_BLOCK_V2) {
      const distributorContract_v2 = Distributor.bind(Address.fromString(DISTRIBUTOR_CONTRACT_V2));
      nextEpochRebase_number = Number.parseFloat(
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
  // Clear the prices for the new block
  // TODO this should be cleaner
  clearPriceCache();
  log.info("Starting protocol metrics for block {}", [blockNumber.toString()]);

  const pm = loadOrCreateProtocolMetric(block.timestamp);

  // Total Supply
  pm.totalSupply = getTotalSupply(blockNumber);

  // Circ Supply
  pm.ohmCirculatingSupply = getCirculatingSupply(blockNumber, pm.totalSupply);

  // sOhm Supply
  pm.sOhmCirculatingSupply = getSOhmCirculatingSupply(blockNumber);

  // OHM Price
  pm.ohmPrice = getOHMUSDRate(block.number);

  // OHM Market Cap
  pm.marketCap = getOhmMarketcap(block.number);

  // Total Value Locked
  pm.totalValueLocked = getTotalValueLocked(block.number);

  // Treasury RFV and MV
  const mv_rfv = getMV_RFV(blockNumber);
  pm.treasuryMarketValue = mv_rfv[0];
  pm.treasuryRiskFreeValue = mv_rfv[1];
  pm.treasuryDaiRiskFreeValue = mv_rfv[2];
  pm.treasuryFraxRiskFreeValue = mv_rfv[3];
  pm.treasuryDaiMarketValue = mv_rfv[4];
  pm.treasuryFraxMarketValue = mv_rfv[5];
  pm.treasuryXsushiMarketValue = mv_rfv[6];
  pm.treasuryWETHRiskFreeValue = mv_rfv[7];
  pm.treasuryWETHMarketValue = mv_rfv[8];
  pm.treasuryLusdRiskFreeValue = mv_rfv[9];
  pm.treasuryLusdMarketValue = mv_rfv[10];
  pm.treasuryCVXMarketValue = mv_rfv[11];
  pm.treasuryOhmDaiPOL = mv_rfv[12];
  pm.treasuryOhmFraxPOL = mv_rfv[13];
  pm.treasuryOhmLusdPOL = mv_rfv[14];
  pm.treasuryOhmEthPOL = mv_rfv[15];
  pm.treasuryOtherMarketValue = mv_rfv[16];
  pm.treasuryWBTCMarketValue = mv_rfv[17];
  pm.treasuryUstMarketValue = mv_rfv[18];
  pm.treasuryStableBacking = mv_rfv[19];
  pm.treasuryVolatileBacking = mv_rfv[20];
  pm.treasuryTotalBacking = mv_rfv[21];
  pm.treasuryLPValue = mv_rfv[22];

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
