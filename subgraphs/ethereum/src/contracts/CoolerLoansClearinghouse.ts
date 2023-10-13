import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { TokenRecord } from "../../../shared/generated/schema";
import { CoolerLoansClearinghouse } from "../../generated/ProtocolMetrics/CoolerLoansClearinghouse";
import { COOLER_LOANS_CLEARINGHOUSES } from "../../../shared/src/Wallets";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { BLOCKCHAIN, ERC20_DAI, ERC20_TOKENS, ERC4626_SDAI, getContractName } from "../utils/Constants";
import { getUSDRate } from "../utils/Price";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";

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

  for (let i = 0; i < COOLER_LOANS_CLEARINGHOUSES.length; i++) {
    const clearinghouseAddress = COOLER_LOANS_CLEARINGHOUSES[i];

    // Grab the receivables from the clearinghouse
    const clearinghouseContract = CoolerLoansClearinghouse.bind(Address.fromString(clearinghouseAddress));
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
        getContractName(clearinghouseAddress),
        clearinghouseAddress,
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

/**
 * Generates records for the DAI and sDAI balances in the Clearinghouses.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @returns 
 */
export function getClearinghouseTokenBalances(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const FUNC = "getClearinghouseTokenBalances";
  const records: TokenRecord[] = [];

  const tokenAddresses = [ERC20_DAI, ERC4626_SDAI];
  for (let i = 0; i < tokenAddresses.length; i++) {
    const tokenAddress = tokenAddresses[i];
    const tokenRate = getUSDRate(tokenAddress, blockNumber);
    const tokenContract = ERC20.bind(Address.fromString(tokenAddress));

    for (let i = 0; i < COOLER_LOANS_CLEARINGHOUSES.length; i++) {
      const clearinghouseAddress = COOLER_LOANS_CLEARINGHOUSES[i];

      // Get the balance
      const balanceResult = tokenContract.try_balanceOf(Address.fromString(clearinghouseAddress));
      if (balanceResult.reverted) {
        continue;
      }

      const balance = toDecimal(balanceResult.value, 18);
      log.info(`{}: Balance of token {} at block {}: {}`, [FUNC, getContractName(tokenAddress), blockNumber.toString(), balance.toString()]);

      records.push(
        createTokenRecord(
          timestamp,
          getContractName(tokenAddress),
          tokenAddress,
          getContractName(clearinghouseAddress),
          clearinghouseAddress,
          tokenRate,
          balance,
          blockNumber,
          true, // Considers DAI receivables as liquid
          ERC20_TOKENS,
          BLOCKCHAIN,
        ),
      );
    }
  }

  return records;
}