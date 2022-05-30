import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { WBTC_ERC20_CONTRACT, WETH_ERC20_CONTRACT } from "./Constants";
import { getERC20 } from "./ContractHelper";
import { getLiquidityPoolValue } from "./LiquidityCalculations";
import { getCirculatingSupply, getTotalSupply } from "./OhmCalculations";
import { TokenRecord, TokenRecords, TokenRecordsWrapper } from "./TokenRecord";
import { getStableValue } from "./TokenStablecoins";
import { getVolatileValue, getWBTCBalance, getWETHBalance } from "./TokenVolatile";

/**
 * Returns the value of the volatile backing
 * - getVolatileValue
 * - wETH
 * - wBTC
 *
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getTreasuryVolatileBacking(
  blockNumber: BigInt,
  liquidOnly: boolean,
): TokenRecordsWrapper {
  const records = getVolatileValue(blockNumber, liquidOnly);

  records.addToken(
    "wETH",
    getWETHBalance(getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  records.addToken(
    "wBTC",
    getWBTCBalance(getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber), blockNumber),
  );

  log.info("Treasury volatile backing at block {}: {}", [
    blockNumber.toString(),
    records.toString(),
  ]);
  return records;
}

/**
 * Returns the value of the stable backing
 * - getStableValue
 *
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getTreasuryStableBacking(blockNumber: BigInt): TokenRecordsWrapper {
  const records = getStableValue(blockNumber);

  log.info("Treasury stable backing at block {}: {}", [blockNumber.toString(), records.toString()]);
  return records;
}

/**
 * Returns the value of the total (liquid) backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking (liquid only)
 * - add: getLiquidityPoolValue / 2
 * - subtract: quantity of OHM circulating supply (not value)
 *
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getTreasuryTotalBacking(blockNumber: BigInt): TokenRecordsWrapper {
  const records = new TokenRecordsWrapper();

  records.combine(getTreasuryStableBacking(blockNumber));
  records.combine(getTreasuryVolatileBacking(blockNumber, true));

  const liquidityPoolValue = getLiquidityPoolValue(blockNumber, false);
  records.addToken(
    "LP Placeholder",
    new TokenRecords([
      new TokenRecord(
        "LP Placeholder",
        "N/A",
        "0x0",
        BigDecimal.fromString("0.5"),
        liquidityPoolValue.getValue(),
      ),
    ]),
  );
  // TODO previous implementation was the number of OHM, not the value. Keep as-is?
  const ohmCirculatingSupply = getCirculatingSupply(blockNumber, getTotalSupply(blockNumber));
  records.addToken(
    "OHM Circulating Supply",
    new TokenRecords([
      new TokenRecord(
        "OHM",
        "N/A",
        "0x0",
        BigDecimal.fromString("-1"),
        ohmCirculatingSupply, // Subtracted
      ),
    ]),
  );

  log.info("Treasury total backing at block {}: {}", [blockNumber.toString(), records.toString()]);
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
export function getMarketValue(blockNumber: BigInt): TokenRecordsWrapper {
  // TODO check that ETH and stables aren't being double-counted
  const records = new TokenRecordsWrapper();

  records.combine(getStableValue(blockNumber));
  records.combine(getLiquidityPoolValue(blockNumber, false));
  records.combine(getVolatileValue(blockNumber, false));

  const wethBalance = getWETHBalance(
    getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  records.addToken("wETH", wethBalance);

  const wbtcBalance = getWBTCBalance(
    getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber),
    blockNumber,
  );
  records.addToken("wBTC", wbtcBalance);

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
export function getRiskFreeValue(blockNumber: BigInt): TokenRecordsWrapper {
  const records = new TokenRecordsWrapper();

  records.combine(getStableValue(blockNumber));
  records.combine(getLiquidityPoolValue(blockNumber, true));

  return records;
}
