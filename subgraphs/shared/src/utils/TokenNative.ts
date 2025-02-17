import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { getContractName } from "../../../ethereum/src/utils/Constants";
import { getUSDRate } from "../../../ethereum/src/utils/Price";
import { getWalletAddressesForContract } from "../../../ethereum/src/utils/ProtocolAddresses";
import { TokenRecord } from "../../generated/schema";
import { toDecimal } from "./Decimals";
import { createTokenRecord } from "./TokenRecordHelper";
import { getTokensForChain } from "./TokensForChain";

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
): TokenRecord[] {
  const zeroAddress = Address.zero().toHexString().toLowerCase();

  const wallets = getWalletAddressesForContract(zeroAddress, blockNumber);
  const rate = getUSDRate(zeroAddress, blockNumber);
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
