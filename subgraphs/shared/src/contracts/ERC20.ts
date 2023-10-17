import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../generated/Price/ERC20";
import { TokenRecord } from "../../generated/schema";
import { toDecimal } from "../utils/Decimals";
import { createTokenRecord, getIsTokenLiquid } from "../utils/TokenRecordHelper";
import { ContractNameLookup } from "./ContractLookup";
import { TokenDefinition } from "./TokenDefinition";

export function getERC20(tokenAddress: string, _block: BigInt): ERC20 {
  return ERC20.bind(Address.fromString(tokenAddress));
}

export function getDecimals(tokenAddress: string, block: BigInt): number {
  const contract = getERC20(tokenAddress, block);
  return contract.decimals();
}

/**
 * Helper method to simplify getting the balance from an ERC20 contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound ERC20 contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @returns BigInt
 */
export function getBalance(
  contract: ERC20 | null,
  address: string,
  currentBlockNumber: BigInt,
  contractLookup: ContractNameLookup,
): BigInt {
  if (!contract) {
    log.debug("Contract for address {} ({}) does not exist at block {}", [
      contractLookup(address),
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  const balanceResult = contract.try_balanceOf(Address.fromString(address));
  if (balanceResult.reverted) {
    return BigInt.zero();
  }

  const balance = balanceResult.value;
  log.debug(
    "getERC20Balance: Found balance {} in ERC20 contract {} ({}) for wallet {} ({}) at block number {}",
    [
      balance.toString(),
      contractLookup(contract._address.toHexString()),
      contract._address.toHexString(),
      contractLookup(address),
      address,
      currentBlockNumber.toString(),
    ],
  );
  return balance;
}

export function getERC20DecimalBalance(tokenAddress: string, sourceAddress: string, blockNumber: BigInt, contractLookup: ContractNameLookup): BigDecimal {
  const contract = ERC20.bind(Address.fromString(tokenAddress));
  const balanceResult = contract.try_balanceOf(Address.fromString(sourceAddress));
  if (balanceResult.reverted) {
    return BigDecimal.zero();
  }

  return toDecimal(balanceResult.value, contract.decimals());
}

/**
 * Fetches the balance of the given ERC20 token from the
 * specified wallet.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param contractAddress ERC20 contract address
 * @param walletAddress The wallet address to determine the balance from
 * @param contract ERC20 contract
 * @param rate the unit price/rate of the token
 * @param blockNumber the current block number
 * @returns TokenRecord object or null
 */
export function getERC20TokenRecordFromWallet(
  timestamp: BigInt,
  contractAddress: string,
  walletAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
  contractLookup: ContractNameLookup,
  tokenDefinitions: Map<string, TokenDefinition>,
  blockchain: string,
): TokenRecord | null {
  const callResult = contract.try_balanceOf(Address.fromString(walletAddress));
  if (callResult.reverted) {
    log.warning(
      "getERC20TokenRecordFromWallet: Contract {} reverted while trying to obtain balance at block {}",
      [contractLookup(contract._address.toHexString()), blockNumber.toString()],
    );
    return null;
  }

  const decimals = getDecimals(contractAddress, blockNumber);

  const balance = toDecimal(
    getBalance(contract, walletAddress, blockNumber, contractLookup),
    decimals,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  return createTokenRecord(
    timestamp,
    contractLookup(contractAddress),
    contractAddress,
    contractLookup(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
    getIsTokenLiquid(contractAddress, tokenDefinitions),
    tokenDefinitions,
    blockchain,
  );
}
