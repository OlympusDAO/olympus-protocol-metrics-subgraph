import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { TokenRecord } from "../../../shared/generated/schema";
import { CoolerLoansClearinghouse } from "../../generated/ProtocolMetrics/CoolerLoansClearinghouse";
import { COOLER_LOANS_CLEARINGHOUSE } from "../../../shared/src/Wallets";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { BLOCKCHAIN, ERC20_DAI, ERC20_TOKENS, getContractName } from "../utils/Constants";
import { getUSDRate } from "../utils/Price";
import { toDecimal } from "../../../shared/src/utils/Decimals";

export function getClearinghouseBalance(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  // Grab the receivables from the clearinghouse
  const clearinghouseContract = CoolerLoansClearinghouse.bind(Address.fromString(COOLER_LOANS_CLEARINGHOUSE));
  const receivablesResult = clearinghouseContract.try_principalReceivables();

  if (receivablesResult.reverted) {
    return records;
  }

  const daiRate = getUSDRate(ERC20_DAI, blockNumber);
  const receivablesBalance = toDecimal(receivablesResult.value, 18);
  log.info(`Cooler Loans Clearinghouse receivables balance: {}`, [receivablesBalance.toString()]);

  records.push(
    createTokenRecord(
      timestamp,
      `${getContractName(ERC20_DAI)} - Borrowed Through Cooler Loans`,
      ERC20_DAI,
      getContractName(COOLER_LOANS_CLEARINGHOUSE),
      COOLER_LOANS_CLEARINGHOUSE,
      daiRate,
      receivablesBalance,
      blockNumber,
      true, // Considers DAI receivables as liquid
      ERC20_TOKENS,
      BLOCKCHAIN,
    ),
  );

  return records;
}