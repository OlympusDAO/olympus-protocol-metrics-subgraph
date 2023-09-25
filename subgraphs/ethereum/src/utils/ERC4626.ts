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
 * @param vaultContract 
 * @param walletAddress 
 * @param rate 
 * @returns 
 */
function getERC4626TokenRecordFromWallets(
  timestamp: BigInt,
  blockNumber: BigInt,
  vaultContract: ERC4626,
  walletAddress: string,
  rate: BigDecimal,
): TokenRecord | null {
  const tokenContractAddress = vaultContract._address.toHexString();
  const balanceResult = vaultContract.try_balanceOf(Address.fromString(walletAddress));

  if (balanceResult.reverted) {
    log.info("getERC4626TokenRecordFromWallets: Skipping wallet {} that reverted for balanceOf {} at block {}", [getContractName(walletAddress), getContractName(tokenContractAddress), blockNumber.toString()]);
    return null;
  }

  const decimals = vaultContract.decimals();
  const balance = toDecimal(balanceResult.value, decimals);

  if (!balance || balance.equals(BigDecimal.zero())) {
    log.debug("getERC4626TokenRecordFromWallets: Skipping wallet {} that returned zero for balanceOf {} at block {}", [getContractName(walletAddress), getContractName(tokenContractAddress), blockNumber.toString()]);
    return null;
  }

  log.debug("getERC4626TokenRecordFromWallets: {} has balanceOf {} {} at block {}", [getContractName(walletAddress), balance.toString(), getContractName(tokenContractAddress), blockNumber.toString()]);
  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(tokenContractAddress),
    tokenContractAddress,
    getContractName(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
    getIsTokenLiquid(tokenContractAddress, ERC4626_TOKENS),
    ERC4626_TOKENS,
    BLOCKCHAIN,
  );
};

/**
 * Returns the balances of the ERC4626 token in all wallets.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @param vaultContract 
 * @param rate 
 * @returns 
 */
function getERC4626TokenRecordsFromWallets(
  timestamp: BigInt,
  blockNumber: BigInt,
  vaultContract: ERC4626,
  rate: BigDecimal,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const wallets = getWalletAddressesForContract(vaultContract._address.toHexString());

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const record = getERC4626TokenRecordFromWallets(
      timestamp,
      blockNumber,
      vaultContract,
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
 * @param vaultContract 
 * @returns 
 */
function getERC4626Rate(
  blockNumber: BigInt,
  vaultContract: ERC4626,
): BigDecimal | null {
  const underlyingToken = vaultContract.try_asset();
  if (underlyingToken.reverted) {
    log.debug(
      "getERC4626Rate: Skipping {} because the underlying token could not be determined at block {}",
      [getContractName(vaultContract._address.toHexString()), blockNumber.toString()]
    )
    return null;
  }

  const underlyingRate: BigDecimal = getUSDRate(underlyingToken.value.toHexString(), blockNumber);
  if (underlyingRate.equals(BigDecimal.zero())) {
    log.debug(
      "getERC4626Rate: Skipping {} because the underlying token {} has no price at block {}",
      [
        getContractName(vaultContract._address.toHexString()),
        getContractName(underlyingToken.value.toHexString()), blockNumber.toString()
      ]
    );
    return null;
  }
  log.info("getERC4626Rate: 1 {} is {} USD", [getContractName(underlyingToken.value.toHexString()), underlyingRate.toString()]);

  // Get 1 share in terms of the underlying token
  const decimals: u8 = u8(vaultContract.decimals());
  const sharesToUnderlying: BigDecimal = toDecimal(
    vaultContract.convertToAssets(
      BigInt.fromU32(10).pow(decimals)),
    decimals);
  log.info("getERC4626Rate: 1 share of {} is {} of the underlying", [getContractName(vaultContract._address.toHexString()), sharesToUnderlying.toString()]);

  const wrappedRate: BigDecimal = underlyingRate.times(sharesToUnderlying);
  log.info("getERC4626Rate: 1 share of {} is {} USD", [getContractName(vaultContract._address.toHexString()), wrappedRate.toString()]);

  return wrappedRate;
}

/**
 * Determines the balances of a specific ERC4626 token.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @param vaultContractAddress 
 * @returns 
 */
function getERC4626Balance(
  timestamp: BigInt,
  blockNumber: BigInt,
  vaultContractAddress: string,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const vaultContract = ERC4626.bind(Address.fromString(vaultContractAddress));

  const rate: BigDecimal | null = getERC4626Rate(blockNumber, vaultContract);
  if (rate === null) {
    log.info("getERC4626Balance: Skipping {} because the rate could not be determined at block {}", [getContractName(vaultContractAddress), blockNumber.toString()]);
    return records;
  }

  pushTokenRecordArray(
    records,
    getERC4626TokenRecordsFromWallets(
      timestamp,
      blockNumber,
      vaultContract,
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

  const vaultAddresses = ERC4626_TOKENS.keys();
  for (let i = 0; i < vaultAddresses.length; i++) {
    const vaultAddress = vaultAddresses[i];

    pushTokenRecordArray(
      records,
      getERC4626Balance(timestamp, blockNumber, vaultAddress),
    );
  }

  return records;
}