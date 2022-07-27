import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import { CIRCULATING_SUPPLY_WALLETS, ERC20_GOHM, getContractName } from "./Constants";
import { getERC20, getERC20Balance } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import {
  addToMetricName,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";

/**
 * Returns the total supply of the gOHM token at the given block number.
 *
 * If the ERC20 contract cannot be loaded, 0 will be returned.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal presenting the total supply at {blockNumber}
 */
export function getGOhmTotalSupply(blockNumber: BigInt): BigDecimal {
  const contract = getERC20("gOHM", ERC20_GOHM, blockNumber);

  if (!contract) {
    log.error(
      "getTotalSupply: Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ERC20_GOHM, blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  return toDecimal(contract.totalSupply(), contract.decimals());
}

/**
 * Returns the circulating supply of the gOHM token
 * at the given block number.
 *
 * Circulating supply is defined as:
 * - gOHM total supply
 * - subtract: gOHM in {CIRCULATING_SUPPLY_WALLETS}
 *
 * WARNING: these numbers may not be accurate
 *
 * @param blockNumber the current block number
 * @param totalSupply the total supply of gOHM
 * @returns BigDecimal representing the circulating supply at the time of the block
 */
export function getGOhmCirculatingSupply(
  metricName: string,
  totalSupply: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, "gOHMCirculatingSupply"),
    blockNumber,
  );

  const gOhmAddress = ERC20_GOHM;
  const contract = getERC20("gOHM", gOhmAddress, blockNumber);
  if (!contract) {
    log.error(
      "getCirculatingSupply: Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [gOhmAddress, blockNumber.toString()],
    );
    return records;
  }

  // Total supply
  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
      getContractName(gOhmAddress),
      gOhmAddress,
      "gOHM Total Supply",
      "N/A",
      BigDecimal.fromString("1"),
      totalSupply,
      blockNumber,
    ),
  );

  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
    const balance = getERC20Balance(contract, currentWallet, blockNumber);
    if (balance.equals(BigInt.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(gOhmAddress),
        gOhmAddress,
        getContractName(currentWallet),
        currentWallet,
        BigDecimal.fromString("1"),
        toDecimal(balance, contract.decimals()),
        blockNumber,
        BigDecimal.fromString("-1"), // Subtract
      ),
    );
  }

  return records;
}
