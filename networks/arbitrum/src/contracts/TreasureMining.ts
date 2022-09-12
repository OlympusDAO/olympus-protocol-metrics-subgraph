import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { addressesEqual } from "../../../shared/src/utils/StringHelper";
import {
  createOrUpdateTokenRecord,
  getIsTokenLiquid,
} from "../../../shared/src/utils/TokenRecordHelper";
import { WALLET_ADDRESSES } from "../../../shared/src/Wallets";
import { TreasureMining } from "../../generated/TokenRecords-arbitrum/TreasureMining";
import { getPrice } from "../price/PriceLookup";
import {
  ERC20_MAGIC,
  ERC20_TOKENS_ARBITRUM,
  TREASUREDAO_MINING,
  TREASUREDAO_MINING_IDs,
} from "./Constants";
import { getContractName } from "./Contracts";

const getStakingContract = (_block: BigInt): TreasureMining => {
  const contract = TreasureMining.bind(Address.fromString(TREASUREDAO_MINING));

  return contract;
};

/**
 * Returns the staked balance of MAGIC belonging to {walletAddress}
 * in the TreasureDAO staking pool {poolId}.
 *
 * @param tokenAddress
 * @param walletAddress
 * @param poolId
 * @param block
 * @returns
 */
const getStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  poolId: u64,
  block: BigInt,
): BigDecimal => {
  if (!addressesEqual(tokenAddress, ERC20_MAGIC)) {
    return BigDecimal.zero();
  }

  const contract = getStakingContract(block);
  const poolIdBigInt = BigInt.fromU64(poolId);

  // Escape if the contract reverts
  if (contract.try_userInfo(Address.fromString(walletAddress), poolIdBigInt).reverted) {
    return BigDecimal.zero();
  }

  return toDecimal(
    contract.userInfo(Address.fromString(walletAddress), poolIdBigInt).getDepositAmount(),
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

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const walletAddress = WALLET_ADDRESSES[i];
    for (let j = 0; j < TREASUREDAO_MINING_IDs.length; j++) {
      const balance = getStakedBalance(
        tokenAddress,
        walletAddress,
        TREASUREDAO_MINING_IDs[j],
        block,
      );

      if (balance.equals(BigDecimal.zero())) {
        continue;
      }

      // This avoids doing price lookups until there is a wallet/token/poolId match
      if (!price) {
        price = getPrice(tokenAddress, block);
      }

      const record = createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Staked"),
        tokenAddress,
        getContractName(walletAddress),
        walletAddress,
        price,
        balance,
        block,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS_ARBITRUM),
        ERC20_TOKENS_ARBITRUM,
      );
      records.push(record);
    }
  }

  return records;
};
