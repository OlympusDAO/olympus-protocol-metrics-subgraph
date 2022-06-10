import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { BalancerVault } from "../../generated/ProtocolMetrics/BalancerVault";
import { TokenRecords } from "../../generated/schema";
import { ERC20_OHM_V2, getContractName, getLiquidityPairTokens } from "./Constants";
import { getERC20 } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import { newTokenRecord, newTokenRecords, pushTokenRecord } from "./TokenRecordHelper";

export function getBalancerVault(vaultAddress: string, _blockNumber: BigInt): BalancerVault {
  return BalancerVault.bind(Address.fromString(vaultAddress));
}

export function getBalancerRecords(
  vaultAddress: string,
  poolId: string,
  singleSidedValue: boolean,
  blockNumber: BigInt,
  tokenAddress: string | null = null,
): TokenRecords {
  log.debug("Calculating value of Balancer Pool {} for id {}", [vaultAddress, poolId]);
  const records = newTokenRecords("Balancer Pool");
  if (tokenAddress && !getLiquidityPairTokens(poolId).includes(tokenAddress)) {
    log.debug("tokenAddress specified and not found in balancer pool. Skipping.", []);
    return records;
  }

  const vault = getBalancerVault(vaultAddress, blockNumber);
  // Fetch the token balances for the specified pool
  const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(poolId));
  const addresses: Array<Address> = poolTokenWrapper.getTokens();
  const balances: Array<BigInt> = poolTokenWrapper.getBalances();

  // Total value is sum of (rate * balance) for all tokens
  let totalValue = BigDecimal.zero();

  for (let i = 0; i < addresses.length; i++) {
    const currentAddress = addresses[i].toHexString();
    // If singleSidedValue is true and the currentAddress is OHM, skip
    if (singleSidedValue && currentAddress == ERC20_OHM_V2) continue;

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
  }

  // We don't know the overall supply of the balancer pool, so fudge a balance of 1
  pushTokenRecord(
    records,
    newTokenRecord(
      getContractName(poolId),
      getContractName(vaultAddress),
      vaultAddress,
      totalValue,
      BigDecimal.fromString("1"),
    ),
  );

  return records;
}
