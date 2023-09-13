import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../../shared/generated/Price/ERC20";
import { TokenRecord } from "../../../shared/generated/schema";
import { getERC20TokenRecordFromWallet } from "../../../shared/src/contracts/ERC20";
import { DAO_WALLET, WALLET_ADDRESSES } from "../../../shared/src/Wallets";
import {
  BLOCKCHAIN,
  CONTRACT_ABBREVIATION_MAP,
  CONTRACT_NAME_MAP,
  ERC20_JONES,
  ERC20_TOKENS_ARBITRUM,
  ERC20_WETH,
  JONES_WRITE_OFF_BLOCK,
} from "./Constants";
import { getTokenRecordValue } from "../../../shared/src/utils/TokenRecordHelper";

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

const NON_TREASURY_ASSET_WHITELIST = new Map<string, string[]>();
NON_TREASURY_ASSET_WHITELIST.set(ERC20_WETH, [DAO_WALLET]);

/**
 * Some wallets (e.g. {DAO_WALLET}) have specific treasury assets mixed into them.
 * For this reason, the wallets to be used differ on a per-contract basis.
 *
 * This function returns the wallets that should be iterated over for the given
 * contract, {contractAddress}.
 *
 * @param contractAddress
 * @returns
 */
export const getWalletAddressesForContract = (contractAddress: string): string[] => {
  const nonTreasuryAddresses = NON_TREASURY_ASSET_WHITELIST.has(contractAddress.toLowerCase())
    ? NON_TREASURY_ASSET_WHITELIST.get(contractAddress.toLowerCase())
    : [];
  const newAddresses = WALLET_ADDRESSES.slice(0);

  // Add the values of nonTreasuryAddresses, but filter duplicates
  for (let i = 0; i < nonTreasuryAddresses.length; i++) {
    const currentValue = nonTreasuryAddresses[i];

    if (newAddresses.includes(currentValue)) {
      continue;
    }

    newAddresses.push(currentValue);
  }

  return newAddresses;
};

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
      ERC20_TOKENS_ARBITRUM,
      BLOCKCHAIN,
    );
    if (!record) continue;

    // If the token is JONES and the block number is greater than the write-off block, then apply a multiplier of 0 to exclude it from liquid backing
    if (contractAddress.toLowerCase() == ERC20_JONES.toLowerCase()
      &&
      blockNumber.ge(BigInt.fromString(JONES_WRITE_OFF_BLOCK))) {
      log.info("getERC20TokenRecordsFromWallets: Applying liquid backing multiplier of 0 to {} token record at block {}", [getContractName(ERC20_JONES), blockNumber.toString()]);
      record.multiplier = BigDecimal.zero();
      record.valueExcludingOhm = getTokenRecordValue(record, true);
      record.save();
    }

    records.push(record);
  }

  return records;
}
