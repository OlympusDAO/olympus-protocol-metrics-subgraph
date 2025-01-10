import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../../shared/generated/Price/ERC20";
import { TokenRecord } from "../../../shared/generated/schema";
import { getERC20TokenRecordFromWallet } from "../../../shared/src/contracts/ERC20";
import { BLOCKCHAIN, CONTRACT_ABBREVIATION_MAP, CONTRACT_NAME_MAP, ERC20_TOKENS_BASE, getWalletAddressesForContract } from "./Constants";

export function getContractName(
  contractAddress: string,
  suffix: string | null = null,
  abbreviation: string | null = null,
): string {
  const contractAddressLower = contractAddress.toLowerCase();

  const contractName = CONTRACT_NAME_MAP.has(contractAddressLower)
    ? CONTRACT_NAME_MAP.get(contractAddressLower)
    : contractAddressLower;

  // Suffix
  const contractSuffix = suffix ? ` - ${suffix}` : "";

  // Abbreviation
  const contractAbbreviation = abbreviation
    ? ` (${abbreviation})`
    : CONTRACT_ABBREVIATION_MAP.has(contractAddressLower)
      ? ` (${CONTRACT_ABBREVIATION_MAP.get(contractAddressLower)})`
      : "";

  return `${contractName}${contractSuffix}${contractAbbreviation}`;
}

/**
* Fetches the balances of the given ERC20 token from
* the wallets defined in {getWalletAddressesForContract}.
*
* @param metricName The name of the current metric, which is used for entity ids
* @param contractAddress ERC20 contract address
* @param contract ERC20 contract
* @param rate the unit price/rate of the token
* @param blockNumber the current block number
* @returns TokenRecord array
*/
export function getERC20TokenRecordsFromWallets(
  timestamp: BigInt,
  contractAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const wallets = getWalletAddressesForContract(contractAddress);

  for (let i = 0; i < wallets.length; i++) {
    const record = getERC20TokenRecordFromWallet(
      timestamp,
      contractAddress,
      wallets[i],
      contract,
      rate,
      blockNumber,
      getContractName,
      ERC20_TOKENS_BASE,
      BLOCKCHAIN,
    );
    if (!record) continue;

    records.push(record);
  }

  return records;
}