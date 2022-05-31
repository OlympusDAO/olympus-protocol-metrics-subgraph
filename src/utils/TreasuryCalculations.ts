import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { WBTC_ERC20_CONTRACT, WETH_ERC20_CONTRACT } from "./Constants";
import { getERC20 } from "./ContractHelper";
import { getLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getTotalSupply } from "./OhmCalculations";
import { TokenRecord, TokenRecords } from "./TokenRecord";
import { getStableValue } from "./TokenStablecoins";
import { getVolatileValue, getWBTCBalance, getWETHBalance } from "./TokenVolatile";

/**
 * Returns the value of the volatile backing
 * - getVolatileValue
 * - wETH
 * - wBTC
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryVolatileBacking(blockNumber: BigInt, liquidOnly: boolean): TokenRecords {
  const records = getVolatileValue(blockNumber, liquidOnly);

  records.combine(getWETHBalance(getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber), blockNumber));
  records.combine(getWBTCBalance(getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber), blockNumber));

  return records;
}

/**
 * Returns the value of the stable backing
 * - getStableValue
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryStableBacking(blockNumber: BigInt): TokenRecords {
  const records = getStableValue(blockNumber);

  return records;
}

/**
 * Returns the value of the total (liquid) backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking (liquid only)
 * - add: getLiquidityPoolValue / 2 (as half of the LP is OHM)
 * - subtract: quantity of OHM circulating supply (not value)
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTreasuryTotalBacking(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getTreasuryStableBacking(blockNumber));
  records.combine(getTreasuryVolatileBacking(blockNumber, true));

  const liquidityPoolValue = getLiquidityPoolValue(blockNumber, false);
  liquidityPoolValue.setMultiplier(BigDecimal.fromString("0.5"));
  records.combine(liquidityPoolValue);

  // TODO previous implementation was the number of OHM, not the value. Keep as-is?
  const ohmCirculatingSupply = getCirculatingSupply(blockNumber, getTotalSupply(blockNumber));
  records.push(
    new TokenRecord(
      "OHM Circulating Supply",
      "N/A",
      "0x0",
      BigDecimal.fromString("1"),
      ohmCirculatingSupply,
      BigDecimal.fromString("-1"), // Subtracted
    ),
  );

  return records;
}

/**
 * Returns the market value, which is composed of:
 * - stable value (getStableValue)
 * - liquidity pool value (getLiquidityPoolValue)
 * - volatile value (getVolatileValue)
 * - wETH value
 * - wBTC value
 *
 * @param blockNumber
 * @returns
 */
export function getMarketValue(blockNumber: BigInt): TokenRecords {
  // TODO check that ETH and stables aren't being double-counted
  const records = new TokenRecords();

  records.combine(getStableValue(blockNumber));
  records.combine(getLiquidityPoolValue(blockNumber, false));
  records.combine(getVolatileValue(blockNumber, false));

  const wethBalance = getWETHBalance(
    getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  records.combine(wethBalance);

  const wbtcBalance = getWBTCBalance(
    getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  records.combine(wbtcBalance);

  return records;
}

/**
 * Returns the risk-free value, which is composed of:
 * - stable value (getStableValue)
 * - risk-free value of liquidity pools (getLiquidityPoolValue)
 *
 * @param blockNumber
 * @returns
 */
export function getRiskFreeValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getStableValue(blockNumber));
  records.combine(getLiquidityPoolValue(blockNumber, true));

  return records;
}
