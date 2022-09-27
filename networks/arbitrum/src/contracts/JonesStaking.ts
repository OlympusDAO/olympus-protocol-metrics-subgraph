import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { getDecimals } from "../../../shared/src/contracts/ERC20";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { addressesEqual } from "../../../shared/src/utils/StringHelper";
import {
  createOrUpdateTokenRecord,
  getIsTokenLiquid,
} from "../../../shared/src/utils/TokenRecordHelper";
import { WALLET_ADDRESSES } from "../../../shared/src/Wallets";
import { JONESStaking } from "../../generated/TokenRecords-arbitrum/JONESStaking";
import { getPrice } from "../price/PriceLookup";
import {
  BLOCKCHAIN,
  ERC20_TOKENS_ARBITRUM,
  JONES_STAKING,
  JONES_STAKING_POOL_IDS,
} from "./Constants";
import { getContractName } from "./Contracts";

const getStakingContract = (_block: BigInt): JONESStaking => {
  const contract = JONESStaking.bind(Address.fromString(JONES_STAKING));

  return contract;
};

/**
 * Returns the staked balance of {tokenAddress} belonging to {walletAddress}
 * in the JonesDAO staking pool {poolId}.
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
  const contract = getStakingContract(block);
  const poolIdBigInt = BigInt.fromU64(poolId);

  // Escape if the contract reverts
  if (contract.try_poolInfo(poolIdBigInt).reverted) {
    return BigDecimal.zero();
  }

  // Check tokens match
  const poolInfo = contract.poolInfo(poolIdBigInt);
  if (!addressesEqual(poolInfo.getLpToken().toHexString(), tokenAddress)) {
    return BigDecimal.zero();
  }

  const lpTokenDecimals = getDecimals(poolInfo.getLpToken().toHexString(), block);

  // We don't return unclaimed rewards
  return toDecimal(
    contract.deposited(poolIdBigInt, Address.fromString(walletAddress)),
    lpTokenDecimals,
  );
};

/**
 * Returns the balances of {tokenAddress} across all wallets
 * staked with JonesDAO.
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
    for (let j = 0; j < JONES_STAKING_POOL_IDS.length; j++) {
      const balance = getStakedBalance(
        tokenAddress,
        walletAddress,
        JONES_STAKING_POOL_IDS[j],
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
        BLOCKCHAIN,
      );
      records.push(record);
    }
  }

  return records;
};
