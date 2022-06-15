import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { BalancerVault } from "../../generated/ProtocolMetrics/BalancerVault";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { TokenRecords } from "../../generated/schema";
import {
  ERC20_OHM_V2,
  getContractName,
  getLiquidityPairTokens,
  WALLET_ADDRESSES,
} from "./Constants";
import { getERC20, getERC20Balance } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import { newTokenRecord, newTokenRecords, pushTokenRecord } from "./TokenRecordHelper";

export function getBalancerVault(vaultAddress: string, _blockNumber: BigInt): BalancerVault {
  return BalancerVault.bind(Address.fromString(vaultAddress));
}

function getBalancerPoolTotalValue(
  vaultAddress: string,
  poolId: string,
  nonOhmValueOnly: boolean,
  blockNumber: BigInt,
): BigDecimal {
  const vault = getBalancerVault(vaultAddress, blockNumber);
  const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(poolId));
  const addresses: Array<Address> = poolTokenWrapper.getTokens();
  const balances: Array<BigInt> = poolTokenWrapper.getBalances();

  // Total value is sum of (rate * balance) for all tokens
  let totalValue = BigDecimal.zero();
  // Non-OHM value of the pool
  let nonOhmValue = BigDecimal.zero();

  for (let i = 0; i < addresses.length; i++) {
    const currentAddress = addresses[i].toHexString();

    const currentContract = getERC20(getContractName(currentAddress), currentAddress, blockNumber);
    if (!currentContract) {
      throw new Error("Unable to bind to ERC20 contract for address " + currentAddress.toString());
    }

    // Add to the value: rate * balance
    const currentBalanceDecimal = toDecimal(balances[i], currentContract.decimals());
    const rate = getUSDRate(currentAddress, blockNumber);
    const value = currentBalanceDecimal.times(rate);
    log.debug("Token address: {}, balance: {}, rate: {}, value: {}", [
      currentAddress,
      currentBalanceDecimal.toString(),
      rate.toString(),
      value.toString(),
    ]);

    totalValue = totalValue.plus(value);

    // Calculate the non-OHM value
    if (currentAddress != ERC20_OHM_V2) {
      nonOhmValue = nonOhmValue.plus(value);
    }
  }

  return nonOhmValueOnly ? nonOhmValue : totalValue;
}

function getBalancerPoolUnitRate(
  poolTokenContract: ERC20,
  totalValue: BigDecimal,
  _blockNumber: BigInt,
): BigDecimal {
  const totalSupply = poolTokenContract.totalSupply();
  const totalSupplyDecimals = toDecimal(totalSupply, poolTokenContract.decimals());

  return totalValue.div(totalSupplyDecimals);
}

function getBalancerPoolToken(vaultAddress: string, poolId: string, blockNumber: BigInt): ERC20 {
  const vault = getBalancerVault(vaultAddress, blockNumber);
  const poolInfo = vault.getPool(Bytes.fromHexString(poolId));
  const poolToken = poolInfo.getValue0().toHexString();
  const poolTokenContract = getERC20(getContractName(poolToken), poolToken, blockNumber);
  if (!poolTokenContract) {
    throw new Error("Unable to bind with ERC20 contractn " + poolToken);
  }

  return poolTokenContract;
}

export function getBalancerRecords(
  vaultAddress: string,
  poolId: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
  tokenAddress: string | null = null,
): TokenRecords {
  log.info("Calculating value of Balancer Pool {} for id {}", [vaultAddress, poolId]);
  const records = newTokenRecords("Balancer Pool", blockNumber);
  if (tokenAddress && !getLiquidityPairTokens(poolId).includes(tokenAddress)) {
    log.debug("tokenAddress specified and not found in balancer pool. Skipping.", []);
    return records;
  }

  const poolTokenContract = getBalancerPoolToken(vaultAddress, poolId, blockNumber);

  // Calculate the value of the pool
  const totalValue = getBalancerPoolTotalValue(vaultAddress, poolId, false, blockNumber);
  const nonOhmValue = getBalancerPoolTotalValue(vaultAddress, poolId, true, blockNumber);

  // Calculate the unit rate
  const unitRate = getBalancerPoolUnitRate(poolTokenContract, totalValue, blockNumber);

  // Calculate multiplier
  const multiplier = excludeOhmValue ? nonOhmValue.div(totalValue) : BigDecimal.fromString("1");
  const poolTokenAddress = poolTokenContract._address.toHexString();
  log.info("Balancer pool {} ({}) has total value of {}, non-OHM value of {} and unit rate of {}", [
    getContractName(poolTokenAddress),
    poolTokenAddress,
    totalValue.toString(),
    nonOhmValue.toString(),
    unitRate.toString(),
  ]);

  const tokenDecimals = poolTokenContract.decimals();

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const walletAddress = WALLET_ADDRESSES[i];
    const balance = toDecimal(
      getERC20Balance(poolTokenContract, walletAddress, blockNumber),
      tokenDecimals,
    );
    log.info("Balancer pool {} has balance of {} in wallet {}", [
      getContractName(poolTokenAddress),
      balance.toString(),
      getContractName(walletAddress),
    ]);
    if (balance.equals(BigDecimal.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        getContractName(poolId),
        poolId,
        getContractName(walletAddress),
        walletAddress,
        unitRate,
        balance,
        blockNumber,
        multiplier,
      ),
    );
  }

  return records;
}
