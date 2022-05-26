import { BigInt } from "@graphprotocol/graph-ts";

import { WBTC_ERC20_CONTRACT, WETH_ERC20_CONTRACT } from "./Constants";
import { getERC20 } from "./ContractHelper";
import { TokensRecords } from "./TokenRecord";
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
export function getTreasuryVolatileBacking(blockNumber: BigInt): TokensRecords {
  const records = getVolatileValue(blockNumber);

  records.addToken("wETH", getWETHBalance(getERC20(WETH_ERC20_CONTRACT, blockNumber), blockNumber));
  records.addToken("wBTC", getWBTCBalance(getERC20(WBTC_ERC20_CONTRACT, blockNumber), blockNumber));

  return records;
}
