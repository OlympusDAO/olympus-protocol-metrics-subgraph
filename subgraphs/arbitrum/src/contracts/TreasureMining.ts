import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../../common/generated/schema";
import { toDecimal } from "../../../../common/src/utils/Decimals";
import { addressesEqual } from "../../../../common/src/utils/StringHelper";
import { createOrUpdateTokenRecord } from "../../../../common/src/utils/TokenRecordHelper";
import { WALLET_ADDRESSES } from "../../../../common/src/Wallets";
import { TreasureMining } from "../../generated/TokenRecords-arbitrum/TreasureMining";
import { getPrice } from "../price/PriceLookup";
import { BLOCKCHAIN, ERC20_MAGIC, ERC20_TOKENS_ARBITRUM, TREASURE_ATLAS_MINE } from "./Constants";
import { getContractName } from "./Contracts";

/**
 * Convenience method to get the staking contract
 *
 * @param _block
 * @returns
 */
const getStakingContract = (_block: BigInt): TreasureMining => {
  const contract = TreasureMining.bind(Address.fromString(TREASURE_ATLAS_MINE));

  return contract;
};

/**
 * Determines the deposit IDs for the given {walletAddress}
 *
 * @param walletAddress
 * @param contract
 * @param _block
 * @returns
 */
const getUserDepositIds = (
  walletAddress: string,
  contract: TreasureMining,
  _block: BigInt,
): BigInt[] => {
  const result = contract.try_getAllUserDepositIds(Address.fromString(walletAddress));
  if (result.reverted) {
    return [];
  }

  return result.value;
};

/**
 * Returns the staked balance of MAGIC belonging to {walletAddress}
 * in the TreasureDAO staking pool {poolId}.
 *
 * @param tokenAddress
 * @param walletAddress
 * @param poolId
 * @param _block
 * @returns
 */
const getStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  poolId: BigInt,
  contract: TreasureMining,
  _block: BigInt,
): BigDecimal => {
  if (!addressesEqual(tokenAddress, ERC20_MAGIC)) {
    return BigDecimal.zero();
  }

  return toDecimal(
    contract.userInfo(Address.fromString(walletAddress), poolId).getDepositAmount(),
    18,
  );
};

/**
 * Returns the balances of {tokenAddress} across all wallets
 * staked with TreasureDAO.
 *
 * @param timestamp
 * @param tokenAddress
 * @param block
 * @returns
 */
export const getStakedBalances = (
  timestamp: BigInt,
  tokenAddress: string,
  block: BigInt,
): TokenRecord[] => {
  const records: TokenRecord[] = [];
  let price: BigDecimal | null = null;

  const contract = getStakingContract(block);

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const walletAddress = WALLET_ADDRESSES[i];
    const depositIds = getUserDepositIds(walletAddress, contract, block);

    for (let j = 0; j < depositIds.length; j++) {
      const balance = getStakedBalance(tokenAddress, walletAddress, depositIds[j], contract, block);

      if (balance.equals(BigDecimal.zero())) {
        continue;
      }

      // This avoids doing price lookups until there is a wallet/token/poolId match
      if (!price) {
        price = getPrice(tokenAddress, block);
      }

      const record = createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Staked", "veMAGIC"),
        tokenAddress,
        getContractName(walletAddress),
        walletAddress,
        price,
        balance,
        block,
        false, // Locked
        ERC20_TOKENS_ARBITRUM,
        BLOCKCHAIN,
      );
      records.push(record);
    }
  }

  return records;
};
