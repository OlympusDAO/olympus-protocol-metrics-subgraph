import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ERC4626 } from "../../generated/ProtocolMetrics/ERC4626";
import { BLOCKCHAIN, ERC4626_TOKENS, getContractName, getWalletAddressesForContract } from "./Constants";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createOrUpdateTokenRecord, getIsTokenLiquid } from "../../../shared/src/utils/TokenRecordHelper";
import { getUSDRate } from "./Price";
import { TokenRecord } from "../../../shared/generated/schema";

/**
 * Returns the balance of the ERC4626 token in the specified wallet.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @param contract 
 * @param walletAddress 
 * @param rate 
 * @returns 
 */
function getERC4626TokenRecordFromWallets(
  timestamp: BigInt,
  blockNumber: BigInt,
  contract: ERC4626,
  walletAddress: string,
  rate: BigDecimal,
): TokenRecord | null {
  const balanceResult = contract.try_balanceOf(Address.fromString(walletAddress));
  if (balanceResult.reverted) {
    log.info("getERC4626TokenRecordFromWallets: Skipping wallet {} that returned empty at block {}", [getContractName(contract._address.toHexString()), blockNumber.toString()]);
    return null;
  }

  const decimals = contract.decimals();
  const balance = toDecimal(balanceResult.value, decimals);

  if (!balance || balance.equals(BigDecimal.zero())) return null;

  const contractAddress = contract._address.toHexString();

  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(contractAddress),
    contractAddress,
    getContractName(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
    getIsTokenLiquid(contractAddress, ERC4626_TOKENS),
    ERC4626_TOKENS,
    BLOCKCHAIN,
  );
};

/**
 * Returns the balances of the ERC4626 token in all wallets.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @param contract 
 * @param rate 
 * @returns 
 */
function getERC4626TokenRecordsFromWallets(
  timestamp: BigInt,
  blockNumber: BigInt,
  contract: ERC4626,
  rate: BigDecimal,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const wallets = getWalletAddressesForContract(contract._address.toHexString());

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const record = getERC4626TokenRecordFromWallets(
      timestamp,
      blockNumber,
      contract,
      walletAddress,
      rate,
    );
    if (!record) continue;

    records.push(record);
  }

  return records;
};

/**
 * Returns the rate of 1 ERC4626 token in USD.
 * 
 * To determine the rate, we need to find:
 * - The ratio of the shares to the underlying asset
 * - The price of the underlying asset
 * 
 * @param contract 
 * @returns 
 */
function getERC4626Rate(
  blockNumber: BigInt,
  contract: ERC4626,
): BigDecimal | null {
  const underlyingToken = contract.try_asset();
  if (underlyingToken.reverted) {
    log.debug(
      "getERC4626Rate: Skipping {} because the underlying token could not be determined at block {}",
      [getContractName(contract._address.toHexString()), blockNumber.toString()]
    )
    return null;
  }

  const underlyingRate: BigDecimal = getUSDRate(underlyingToken.value.toHexString(), blockNumber);
  if (underlyingRate.equals(BigDecimal.zero())) {
    log.debug(
      "getERC4626Rate: Skipping {} because the underlying token {} has no price at block {}",
      [
        getContractName(contract._address.toHexString()),
        getContractName(underlyingToken.value.toHexString()), blockNumber.toString()
      ]
    );
    return null;
  }
  log.info("getERC4626Rate: 1 {} is {} USD", [getContractName(underlyingToken.value.toHexString()), underlyingRate.toString()]);

  // Get 1 share in terms of the underlying token
  const decimals: u8 = u8(contract.decimals());
  const sharesToUnderlying: BigDecimal = toDecimal(
    contract.convertToAssets(
      BigInt.fromU32(10).pow(decimals)),
    decimals);
  log.info("getERC4626Rate: 1 share of {} is {} of the underlying", [getContractName(contract._address.toHexString()), sharesToUnderlying.toString()]);

  const wrappedRate: BigDecimal = underlyingRate.times(sharesToUnderlying);
  log.info("getERC4626Rate: 1 share of {} is {} USD", [getContractName(contract._address.toHexString()), wrappedRate.toString()]);

  return wrappedRate;
}

/**
 * Determines the balances of a specific ERC4626 token.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @param contractAddress 
 * @returns 
 */
function getERC4626Balance(
  timestamp: BigInt,
  blockNumber: BigInt,
  contractAddress: string,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const contract = ERC4626.bind(Address.fromString(contractAddress));

  const rate: BigDecimal | null = getERC4626Rate(blockNumber, contract);
  if (rate === null) {
    log.info("getERC4626Balance: Skipping {} because the rate could not be determined at block {}", [getContractName(contractAddress), blockNumber.toString()]);
    return records;
  }

  pushTokenRecordArray(
    records,
    getERC4626TokenRecordsFromWallets(
      timestamp,
      blockNumber,
      contract,
      rate,
    ),
  );

  return records;
}

export function getAllERC4626Balances(
  timestamp: BigInt,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info("getERC4626Balances: Calculating ERC4626 balances at block number {}", [blockNumber.toString()]);
  const records: TokenRecord[] = [];

  const tokenKeys = ERC4626_TOKENS.keys();
  for (let i = 0; i < tokenKeys.length; i++) {
    const tokenAddress = tokenKeys[i];

    pushTokenRecordArray(
      records,
      getERC4626Balance(timestamp, blockNumber, tokenAddress),
    );
  }

  return records;
}