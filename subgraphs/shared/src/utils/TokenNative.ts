import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { toDecimal } from "./Decimals";
import { createTokenRecord } from "./TokenRecordHelper";
import { getTokensForChain } from "./TokensForChain";

export type GetPrice = (tokenAddress: string, blockNumber: BigInt) => BigDecimal;

/**
 * Get the native network curren balances for a given timestamp and block number
 * @param timestamp - The timestamp of the block
 * @param blockNumber - The block number
 * @param blockchain - The blockchain to get the native balances for
 * @returns An array of TokenRecord objects representing the native balances
 */
export function getNativeTokenBalances(
  timestamp: BigInt,
  blockNumber: BigInt,
  blockchain: string,
  wallets: string[],
  priceLookup: GetPrice,
  getContractName: ContractNameLookup,
): TokenRecord[] {
  const zeroAddress = Address.zero().toHexString().toLowerCase();

  const rate = priceLookup(zeroAddress, blockNumber);
  const records: TokenRecord[] = [];

  const tokensForChain = getTokensForChain(blockchain);

  for (let i = 0; i < wallets.length; i++) {
    const balance = ethereum.getBalance(Address.fromString(wallets[i]));

    // skip if balance is 0
    if (balance.equals(BigInt.fromString("0"))) {
      continue;
    }

    const decimalBalance = toDecimal(balance);

    const record = createTokenRecord(
      timestamp,
      getContractName(zeroAddress),
      zeroAddress,
      getContractName(wallets[i]),
      wallets[i],
      rate,
      decimalBalance,
      blockNumber,
      true,
      tokensForChain,
      blockchain,
    );
    log.info(`getNativeTokenBalances was created: ${wallets[i]}, record: ${record.id}`, []);
    if (!record) {
      log.info(`getNativeTokenBalances was not created: ${wallets[i]}`, []);
      continue;
    }
    records.push(record);
  }

  return records;
}
