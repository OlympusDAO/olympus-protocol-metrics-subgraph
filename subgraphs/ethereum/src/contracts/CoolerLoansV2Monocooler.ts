import { Address, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { COOLER_LOANS_V2_MONOCOOLER } from "../../../shared/src/Wallets";
import { CoolerLoansMonoCooler } from "../../generated/ProtocolMetrics/CoolerLoansMonoCooler";
import {
  BLOCKCHAIN,
  COOLER_LOANS_V2_MONOCOOLER_START_BLOCK,
  ERC20_DAI,
  ERC20_TOKENS,
  ERC20_USDS,
  getContractName,
} from "../utils/Constants";
import { getUSDRate } from "../utils/Price";

/**
 * Generates records for the USDS receivables in the Cooler Loans V2 MonoCooler.
 *
 * @param timestamp
 * @param blockNumber
 * @returns
 */
export function getCoolerV2Receivables(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const FUNC = "getCoolerV2Receivables";
  const records: TokenRecord[] = [];

  // If before the start block, return an empty array
  if (blockNumber.lt(BigInt.fromString(COOLER_LOANS_V2_MONOCOOLER_START_BLOCK))) {
    return records;
  }

  const daiRate = getUSDRate(ERC20_DAI, blockNumber);
  const coolerV2Monocooler = COOLER_LOANS_V2_MONOCOOLER;

  // Grab the receivables from the clearinghouse
  const coolerV2MonocoolerContract = CoolerLoansMonoCooler.bind(Address.fromString(coolerV2Monocooler));
  const receivablesResult = coolerV2MonocoolerContract.totalDebt();

  const receivablesBalance = toDecimal(receivablesResult, 18);
  log.info(`{}: Cooler Loans V2 MonoCooler receivables balance: {}`, [
    FUNC,
    receivablesBalance.toString(),
  ]);

  records.push(
    createTokenRecord(
      timestamp,
      `${getContractName(ERC20_USDS)} - Borrowed Through Cooler Loans V2`,
      ERC20_USDS,
      getContractName(COOLER_LOANS_V2_MONOCOOLER),
      COOLER_LOANS_V2_MONOCOOLER,
      daiRate,
      receivablesBalance,
      blockNumber,
      true, // Considers USDS receivables as liquid
      ERC20_TOKENS,
      BLOCKCHAIN,
    ),
  );

  return records;
}
