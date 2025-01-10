import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { CoolerLoansClearinghouse } from "../../generated/ProtocolMetrics/CoolerLoansClearinghouse";
import { getClearinghouseAddresses } from "../utils/Bophades";
import { BLOCKCHAIN, ERC20_DAI, ERC20_TOKENS, getContractName } from "../utils/Constants";
import { getUSDRate } from "../utils/Price";

/**
 * Generates records for the DAI receivables in the Clearinghouses.
 *
 * @param timestamp
 * @param blockNumber
 * @returns
 */
export function getClearinghouseReceivables(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const FUNC = "getClearinghouseReceivables";
  const records: TokenRecord[] = [];

  const daiRate = getUSDRate(ERC20_DAI, blockNumber);
  const clearinghouses = getClearinghouseAddresses(blockNumber);

  for (let i = 0; i < clearinghouses.length; i++) {
    const clearinghouseAddress = clearinghouses[i];

    // Grab the receivables from the clearinghouse
    const clearinghouseContract = CoolerLoansClearinghouse.bind(clearinghouseAddress);
    const receivablesResult = clearinghouseContract.try_principalReceivables();

    if (receivablesResult.reverted) {
      continue;
    }

    const receivablesBalance = toDecimal(receivablesResult.value, 18);
    log.info(`{}: Cooler Loans Clearinghouse receivables balance: {}`, [FUNC, receivablesBalance.toString()]);

    records.push(
      createTokenRecord(
        timestamp,
        `${getContractName(ERC20_DAI)} - Borrowed Through Cooler Loans`,
        ERC20_DAI,
        getContractName(clearinghouseAddress.toHexString()),
        clearinghouseAddress.toHexString(),
        daiRate,
        receivablesBalance,
        blockNumber,
        true, // Considers DAI receivables as liquid
        ERC20_TOKENS,
        BLOCKCHAIN,
      ),
    );
  }

  return records;
}
