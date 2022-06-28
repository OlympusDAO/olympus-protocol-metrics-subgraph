import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { BalancerPoolToken } from "../../generated/ProtocolMetrics/BalancerPoolToken";
import { BalancerVault } from "../../generated/ProtocolMetrics/BalancerVault";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  ERC20_OHM_V2,
  getContractName,
  liquidityPairHasToken,
  WALLET_ADDRESSES,
} from "./Constants";
import { getERC20, getERC20Balance } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import {
  addToMetricName,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";

export function getBalancerVault(vaultAddress: string, _blockNumber: BigInt): BalancerVault {
  return BalancerVault.bind(Address.fromString(vaultAddress));
}

// ### Balances for liquidity ###

/**
 * Determines the total value of the specified Balancer pool, specified by {poolId}.
 *
 * The value is the sum of rate * balance for all tokens.
 *
 * @param vaultAddress The address of the Balancer vault
 * @param poolId The pool id, as returned by `getPool()` on the allocator contract
 * @param excludeOhmValue If true, the value will exclude OHM. This can be used to calculate backing
 * @param restrictToToken If true, the value will be restricted to that of the specified token. This can be used to calculate the value of liquidity for a certain token.
 * @param tokenAddress The tokenAddress to restrict to (or null)
 * @param blockNumber the current block number
 * @returns BigDecimal
 */
export function getBalancerPoolTotalValue(
  vaultAddress: string,
  poolId: string,
  excludeOhmValue: boolean,
  restrictToToken: boolean,
  tokenAddress: string | null,
  blockNumber: BigInt,
): BigDecimal {
  const vault = getBalancerVault(vaultAddress, blockNumber);
  const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(poolId));
  const addresses: Array<Address> = poolTokenWrapper.getTokens();
  const balances: Array<BigInt> = poolTokenWrapper.getBalances();

  // Total value is sum of (rate * balance)
  let totalValue = BigDecimal.zero();

  for (let i = 0; i < addresses.length; i++) {
    const currentAddress = addresses[i].toHexString();

    const currentContract = getERC20(getContractName(currentAddress), currentAddress, blockNumber);
    if (!currentContract) {
      throw new Error("Unable to bind to ERC20 contract for address " + currentAddress.toString());
    }

    if (excludeOhmValue && currentAddress.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getBalancerPoolTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    // Skip if the tokens to include is restricted
    if (
      tokenAddress &&
      restrictToToken &&
      tokenAddress.toLowerCase() != currentAddress.toLowerCase()
    ) {
      log.debug("getBalancerPoolTotalValue: Skipping token {} as restrictToToken is true", [
        currentAddress,
      ]);
      continue;
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

  return totalValue;
}

/**
 * Determines the unit rate of the given Balancer pool.
 *
 * Unit rate = total value / total supply
 *
 * @param poolTokenContract
 * @param totalValue
 * @param _blockNumber
 * @returns
 */
function getBalancerPoolUnitRate(
  poolTokenContract: BalancerPoolToken,
  totalValue: BigDecimal,
  _blockNumber: BigInt,
): BigDecimal {
  const totalSupply = poolTokenContract.totalSupply();
  const totalSupplyDecimals = toDecimal(totalSupply, poolTokenContract.decimals());

  return totalValue.div(totalSupplyDecimals);
}

export function getBalancerPoolToken(
  vaultAddress: string,
  poolId: string,
  blockNumber: BigInt,
): BalancerPoolToken {
  const vault = getBalancerVault(vaultAddress, blockNumber);
  const poolInfo = vault.getPool(Bytes.fromHexString(poolId));
  const poolToken = poolInfo.getValue0().toHexString();

  return BalancerPoolToken.bind(Address.fromString(poolToken));
}

/**
 * Helper method to simplify getting the balance from a BalancerPoolToken contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound BalancerPoolToken contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @returns BigDecimal
 */
export function getBalancerPoolTokenBalance(
  contract: BalancerPoolToken | null,
  address: string,
  currentBlockNumber: BigInt,
): BigDecimal {
  if (contract === null) {
    log.debug(
      "getBalancerPoolTokenBalance: Contract for address {} ({}) does not exist at block {}",
      [getContractName(address), address, currentBlockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  const balance = contract.balanceOf(Address.fromString(address));
  const balanceDecimals = toDecimal(balance, contract.decimals());
  log.debug(
    "getBalancerPoolTokenBalance: Found balance {} in ERC20 contract {} ({}) for wallet {} ({}) at block number {}",
    [
      balanceDecimals.toString(),
      getContractName(contract._address.toHexString()),
      contract._address.toHexString(),
      getContractName(address),
      address,
      currentBlockNumber.toString(),
    ],
  );
  return balanceDecimals;
}

/**
 * Provides TokenRecords representing the Balancer pool identified by {poolId}.
 *
 * @param metricName
 * @param vaultAddress The address of the Balancer Vault
 * @param poolId The id of the Balancer pool
 * @param excludeOhmValue If true, the value will exclude that of OHM
 * @param restrictToTokenValue If true, the value will reflect the portion of the pool made up by {tokenAddress}. Overrides {excludeOhmValue}.
 * @param blockNumber The current block number
 * @param tokenAddress If specified, this function will exit if the token is not in the liquidity pool
 * @returns
 */
export function getBalancerRecords(
  metricName: string,
  vaultAddress: string,
  poolId: string,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
  tokenAddress: string | null = null,
): TokenRecords {
  log.info("Calculating value of Balancer vault {} for pool id {}", [vaultAddress, poolId]);
  const records = newTokenRecords(addToMetricName(metricName, "BalancerPool"), blockNumber);
  if (tokenAddress && !liquidityPairHasToken(poolId, tokenAddress)) {
    log.debug("tokenAddress specified and not found in balancer pool. Skipping.", []);
    return records;
  }

  const poolTokenContract = getBalancerPoolToken(vaultAddress, poolId, blockNumber);
  if (poolTokenContract.totalSupply().equals(BigInt.zero())) {
    log.debug("Skipping Balancer pair {} with total supply of 0 at block {}", [
      getContractName(poolTokenContract._address.toHexString()),
      blockNumber.toString(),
    ]);
    return records;
  }

  // Calculate the value of the pool
  const totalValue = getBalancerPoolTotalValue(
    vaultAddress,
    poolId,
    false,
    false,
    null,
    blockNumber,
  );
  const includedValue = getBalancerPoolTotalValue(
    vaultAddress,
    poolId,
    excludeOhmValue,
    restrictToTokenValue,
    tokenAddress,
    blockNumber,
  );

  // Calculate the unit rate
  const unitRate = getBalancerPoolUnitRate(poolTokenContract, totalValue, blockNumber);

  // Calculate multiplier
  const multiplier =
    excludeOhmValue || restrictToTokenValue
      ? includedValue.div(totalValue)
      : BigDecimal.fromString("1");
  log.info(
    "getBalancerRecords: applying multiplier of {} based on excludeOhmValue = {} and restrictToTokenValue = {}",
    [
      multiplier.toString(),
      excludeOhmValue ? "true" : "false",
      restrictToTokenValue ? "true" : "false",
    ],
  );

  const poolTokenAddress = poolTokenContract._address.toHexString();
  log.info(
    "Balancer pool {} ({}) has total value of {}, included value of {} and unit rate of {}",
    [
      getContractName(poolTokenAddress),
      poolTokenAddress,
      totalValue.toString(),
      includedValue.toString(),
      unitRate.toString(),
    ],
  );

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const walletAddress = WALLET_ADDRESSES[i];
    const balance = getBalancerPoolTokenBalance(poolTokenContract, walletAddress, blockNumber);
    log.info("Balancer pool {} has balance of {} in wallet {}", [
      getContractName(poolTokenAddress),
      balance.toString(),
      getContractName(walletAddress),
    ]);
    if (balance.equals(BigDecimal.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(poolTokenAddress),
        poolTokenAddress,
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

// ### Token quantity for floating supply ###

/**
 * Returns the total quantity of the token {tokenAddress}
 * in the specified Balancer pool.
 *
 * @param vaultAddress Balancer Vault address
 * @param poolId Balancer Pool ID
 * @param tokenAddress The ERC20 token to determine the quantity of
 * @param blockNumber current block number
 * @returns BigDecimal representing the total quantity of the token
 */
export function getBalancerPoolTotalTokenQuantity(
  vaultAddress: string,
  poolId: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const vault = getBalancerVault(vaultAddress, blockNumber);
  const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(poolId));
  const addresses: Array<Address> = poolTokenWrapper.getTokens();
  const balances: Array<BigInt> = poolTokenWrapper.getBalances();

  let tokenQuantity = BigDecimal.zero();

  for (let i = 0; i < addresses.length; i++) {
    const currentAddress = addresses[i].toHexString();
    if (!Address.fromString(currentAddress).equals(Address.fromString(tokenAddress))) continue;

    const currentContract = getERC20(getContractName(currentAddress), currentAddress, blockNumber);
    if (!currentContract) {
      throw new Error("Unable to bind to ERC20 contract for address " + currentAddress.toString());
    }

    // Add to the value: rate * balance
    const currentBalanceDecimal = toDecimal(balances[i], currentContract.decimals());
    tokenQuantity = tokenQuantity.plus(currentBalanceDecimal);
  }

  return tokenQuantity;
}

/**
 * Returns token records reflecting the quantity of the token {tokenAddress}
 * in the specified Balancer pool across wallets ({WALLET_ADDRESSES}).
 *
 * @param metricName
 * @param vaultAddress
 * @param poolId
 * @param tokenAddress
 * @param blockNumber
 * @returns
 */
export function getBalancerPoolTokenQuantity(
  metricName: string,
  vaultAddress: string,
  poolId: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating quantity of token {} in Balancer vault {} for id {}", [
    getContractName(tokenAddress),
    vaultAddress,
    poolId,
  ]);
  const records = newTokenRecords(
    addToMetricName(metricName, "BalancerPoolTokenQuantity"),
    blockNumber,
  );
  const poolTokenContract = getBalancerPoolToken(vaultAddress, poolId, blockNumber);

  // Calculate the token quantity for the pool
  const totalQuantity = getBalancerPoolTotalTokenQuantity(
    vaultAddress,
    poolId,
    tokenAddress,
    blockNumber,
  );

  const poolTokenAddress = poolTokenContract._address.toHexString();
  const tokenDecimals = poolTokenContract.decimals();
  log.info("Balancer pool {} has total quantity of {}", [
    getContractName(poolTokenAddress),
    totalQuantity.toString(),
  ]);
  const poolTokenTotalSupply = toDecimal(poolTokenContract.totalSupply(), tokenDecimals);

  // Grab balances
  const poolTokenBalances = getBalancerRecords(
    metricName,
    vaultAddress,
    poolId,
    false,
    false,
    blockNumber,
    tokenAddress,
  );

  for (let i = 0; i < poolTokenBalances.records.length; i++) {
    const recordId = poolTokenBalances.records[i];
    const record = TokenRecord.load(recordId);
    if (!record) {
      throw new Error("Unable to load TokenRecord with id " + recordId);
    }

    const tokenBalance = totalQuantity.times(record.balance).div(poolTokenTotalSupply);
    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(tokenAddress) + " in " + getContractName(poolTokenAddress),
        poolTokenAddress,
        record.source,
        record.sourceAddress,
        BigDecimal.fromString("1"), // Rate of 1, since we're reporting quantity, not value
        tokenBalance,
        blockNumber,
      ),
    );
  }

  return records;
}
