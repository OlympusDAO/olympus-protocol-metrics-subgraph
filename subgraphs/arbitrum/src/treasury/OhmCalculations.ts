import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { getERC20DecimalBalance } from "../../../shared/src/contracts/ERC20";
import { createOrUpdateTokenSupply, TYPE_TREASURY } from "../../../shared/src/utils/TokenSupplyHelper";
import { CIRCULATING_SUPPLY_WALLETS, ERC20_GOHM_SYNAPSE } from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";

/**
 * The start block for accounting of protocol-owned gOHM on Arbitrum.
 */
const START_BLOCK = "84000000";

/**
 * Returns the supply of protocol- and DAO-owned gOHM at the given block number.
 *
 * Unlike on Ethereum mainnet, the raw gOHM value is added to the TokenSupply records.
 * This will be converted later into a quantity of OHM.
 * 
 * OHM and sOHM do not exist natively on Arbitrum at this time, so are not included
 *
 * @param timestmap the current timestamp
 * @param blockNumber the current block number
 * @returns TokenSupply records
 */
export function getTreasuryOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports.
  if (blockNumber.lt(BigInt.fromString(START_BLOCK))) {
    return records;
  }

  /**
   * Make a copy of the circulating wallets array
   * 
   * NOTE: this deliberately does not use the `getWalletAddressesForContract` function, 
   * as that blacklists all OHM variants in treasury wallets, so that they are not added
   * to the market value
   */
  const wallets = new Array<string>();
  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    wallets.push(CIRCULATING_SUPPLY_WALLETS[i]);
  }

  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getERC20DecimalBalance(ERC20_GOHM_SYNAPSE, currentWallet, blockNumber, getContractName);
    if (balance.equals(BigDecimal.zero())) continue;

    /**
     * Traditionally, the index is used to convert gOHM to OHM. However,
     * the OHM index is not available on the gOHM Synapse contract on Arbitrum.
     * 
     * Instead, we create a TokenSupply record for the gOHM Synapse contract,
     * and the frontend will use the index to convert gOHM to OHM.
     */
    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_GOHM_SYNAPSE),
        ERC20_GOHM_SYNAPSE,
        null,
        null,
        getContractName(currentWallet),
        currentWallet,
        TYPE_TREASURY,
        balance,
        blockNumber,
        -1, // Subtract
      ),
    );
  }

  return records;
}
