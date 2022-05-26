import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { WBTC_ERC20_CONTRACT, WETH_ERC20_CONTRACT } from "./Constants";
import { getERC20 } from "./ContractHelper";
import { TokenRecord, TokenRecords, TokensRecords } from "./TokenRecord";
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
): TokensRecords {
  log.debug("Starting to calculate treasury volatile backing", []);
  const records = getVolatileValue(blockNumber, liquidOnly);

  records.addToken(
    "wETH",
    getWETHBalance(getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  log.debug("After wETH: {}", [records.getValue().toString()]);
  records.addToken(
    "wBTC",
    getWBTCBalance(getERC20("wBTC", WBTC_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  log.debug("After wBTC: {}", [records.getValue().toString()]);

  log.info("Treasury volatile backing: {}", [records.toString()]);
  return records;
}

/**
 * Returns the value of the stable backing
 * - getStableValue
 *
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getTreasuryStableBacking(blockNumber: BigInt): TokensRecords {
  log.debug("Starting to calculate treasury stable backing", []);
  const records = getStableValue(blockNumber);

  log.info("Treasury stable backing: {}", [records.toString()]);
  return records;
}

/**
 * Returns the value of the total (liquid) backing
 * - add: getTreasuryStableBacking
 * - add: getTreasuryVolatileBacking (liquid only)
 * - add: LP value
 * - subtract: OHM circulating supply
 *
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getTreasuryTotalBacking(
  blockNumber: BigInt,
  lpValue: BigDecimal,
  ohmCirculatingSupply: BigDecimal,
): TokensRecords {
  log.debug("Starting to calculate treasury total backing", []);
  const records = new TokensRecords();

  records.combine(getTreasuryStableBacking(blockNumber));
  log.debug("After stable backing: {}", [records.getValue().toString()]);
  records.combine(getTreasuryVolatileBacking(blockNumber, true));
  log.debug("After volatile backing: {}", [records.getValue().toString()]);
  records.addToken(
    "LP Placeholder",
    new TokenRecords([
      new TokenRecord("LP Placeholder", "N/A", "0x0", BigDecimal.fromString("1"), lpValue),
    ]),
  );
  log.debug("After LP: {}", [records.getValue().toString()]);
  // TODO previous implementation was the number of OHM, not the value. Keep as-is?
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
  log.debug("After circulating supply: {}", [records.getValue().toString()]);

  log.info("Treasury total backing: {}", [records.toString()]);
  return records;
}
