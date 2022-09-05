import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { CurvePool } from "../../generated/ProtocolMetrics/CurvePool";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { TokenRecord, TokenSupply } from "../../generated/schema";
import {
  CONVEX_STAKING_CONTRACTS,
  ERC20_OHM_V2,
  getContractName,
  getConvexStakedToken,
  getWalletAddressesForContract,
  liquidityPairHasToken,
} from "../utils/Constants";
import { getConvexStakedBalance, getERC20 } from "../utils/ContractHelper";
import { getUSDRate } from "../utils/Price";
import { TokenCategoryPOL } from "../utils/TokenDefinition";
import { createOrUpdateTokenRecord } from "../utils/TokenRecordHelper";
import { createOrUpdateTokenSupply, TYPE_LIQUIDITY } from "../utils/TokenSupplyHelper";

// ### Balances ###

/**
 * Returns the total value of the given Curve pair.
 *
 * Calculated as: token0 balance * token0 rate + token1 balance * token1 rate
 *
 * @param pairAddress
 * @param excludeOhmValue If true, the value will exclude OHM. This can be used to calculate backing
 * @param restrictToToken  If true, the value will be restricted to that of the specified token. This can be used to calculate the value of liquidity for a certain token.
 * @param tokenAddress The tokenAddress to restrict to (or null)
 * @param blockNumber
 * @returns
 */
export function getCurvePairTotalValue(
  pairAddress: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): BigDecimal {
  // Obtain both tokens
  const pair = CurvePool.bind(Address.fromString(pairAddress));
  let totalValue = BigDecimal.zero();
  log.info("getCurvePairTotalValue: Calculating value of pair {} with excludeOhmValue = {}", [
    getContractName(pairAddress),
    excludeOhmValue ? "true" : "false",
  ]);

  // token0 balance * token0 rate + token1 balance * token1 rate
  for (let i = 0; i < 2; i++) {
    const token: string = pair.coins(BigInt.fromI32(i)).toHexString();

    if (excludeOhmValue && token.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getCurvePairTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    const tokenContract = getERC20(token, blockNumber);
    if (!tokenContract) {
      throw new Error("Unable to fetch ERC20 at address " + token + " for Curve pool");
    }
    const tokenBalance = pair.balances(BigInt.fromI32(i));
    const tokenBalanceDecimal = toDecimal(tokenBalance, tokenContract.decimals());
    const rate = getUSDRate(token, blockNumber);
    const value = tokenBalanceDecimal.times(rate);
    log.debug("getCurvePairTotalValue: Token address: {}, balance: {}, rate: {}, value: {}", [
      token,
      tokenBalanceDecimal.toString(),
      rate.toString(),
      value.toString(),
    ]);

    totalValue = totalValue.plus(value);
  }

  return totalValue;
}

/**
 * Creates a token record for a staked Curve pair token.
 *
 * If the stakedTokenAddress is null or the balance is 0, null is returned.
 *
 * This looks up the balance of {stakedTokenAddress} on {stakingAddress}, instead
 * of using `balanceOf`, which doesn't work with the Convex contracts.
 *
 * @param metricName
 * @param pairTokenAddress
 * @param stakedTokenAddress
 * @param walletAddress
 * @param stakingAddress
 * @param pairRate
 * @param excludeOhmValue
 * @param blockNumber
 * @returns
 */
function getCurvePairStakedRecord(
  timestamp: BigInt,
  pairTokenAddress: string,
  stakedTokenAddress: string | null,
  walletAddress: string,
  stakingAddress: string,
  pairRate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  if (stakedTokenAddress === null) {
    log.debug(
      "getCurvePairStakedRecord: Curve pair balance for staked token {} ({}) in wallet {} ({}) was 0, and no staked token was found.",
      [
        getContractName(pairTokenAddress),
        pairTokenAddress,
        getContractName(walletAddress),
        walletAddress,
      ],
    );
    return null;
  }

  const balance = getConvexStakedBalance(
    stakedTokenAddress,
    walletAddress,
    stakingAddress,
    blockNumber,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(stakedTokenAddress),
    stakedTokenAddress,
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    balance,
    blockNumber,
    true,
    multiplier,
    TokenCategoryPOL,
  );
}

/**
 * Returns the TokenRecord for the Curve pair's token
 * at the given {walletAddress}.
 *
 * @param metricName
 * @param pairTokenAddress token address for the Curve pair
 * @param pairRate the unit rate of the pair
 * @param walletAddress the wallet to look up the balance
 * @param multiplier the multiplier to apply
 * @param blockNumber the current block number
 * @returns
 */
function getCurvePairRecord(
  timestamp: BigInt,
  pairTokenAddress: string,
  pairRate: BigDecimal,
  walletAddress: string,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const pairToken = getERC20(pairTokenAddress, blockNumber);
  if (!pairToken) {
    throw new Error("Unable to bind to ERC20 contract for Curve pair token " + pairTokenAddress);
  }

  // Get the balance of the pair's token in walletAddress
  const pairTokenBalance = pairToken.balanceOf(Address.fromString(walletAddress));
  if (pairTokenBalance.equals(BigInt.zero())) {
    log.debug("getCurvePairRecord: Curve pair balance for token {} ({}) in wallet {} ({}) was 0", [
      getContractName(pairTokenAddress),
      pairTokenAddress,
      getContractName(walletAddress),
      walletAddress,
    ]);
    return null;
  }

  const pairTokenBalanceDecimal = toDecimal(pairTokenBalance, pairToken.decimals());

  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(pairTokenAddress),
    pairTokenAddress,
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    pairTokenBalanceDecimal,
    blockNumber,
    true,
    multiplier,
    TokenCategoryPOL,
  );
}

/**
 * Determines the address of the ERC20 token for a Curve liquidity pair.
 *
 * If the token cannot be determined (e.g. because it is before the starting block,
 * causing a revert), null will be returned.
 *
 * @param pairAddress address of the Curve pair
 * @param blockNumber the current block number
 * @returns address as a string, or null
 */
function getCurvePairToken(pairAddress: string, blockNumber: BigInt): string | null {
  const pair = CurvePool.bind(Address.fromString(pairAddress));

  // If the token does not exist at the current block, it will revert
  if (pair.try_token().reverted) {
    log.debug(
      "getCurvePairToken: ERC20 token for Curve pair {} could not be determined at block {} due to contract revert. Skipping",
      [getContractName(pairAddress), blockNumber.toString()],
    );
    return null;
  }

  return pair.token().toHexString();
}

function getCurvePairTokenContract(pairAddress: string, blockNumber: BigInt): ERC20 | null {
  const pairTokenAddress = getCurvePairToken(pairAddress, blockNumber);
  if (pairTokenAddress === null) return null;

  const pairTokenContract = getERC20(pairTokenAddress, blockNumber);
  if (!pairTokenContract) {
    throw new Error("Unable to bind to ERC20 contract for Curve pair token " + pairTokenAddress);
  }

  return pairTokenContract;
}

/**
 * Calculates the unit rate of the given Curve pair.
 *
 * Each Curve pair has an associated token. The total supply
 * of that token is determined and divides the value to
 * give the unit rate.
 *
 * @param pairAddress Curve pair address
 * @param totalValue total value of the Curve pair
 * @param blockNumber current block
 * @returns
 */
function getCurvePairUnitRate(
  pairAddress: string,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  log.info("getCurvePairUnitRate: Calculating unit rate for Curve pair {}", [
    getContractName(pairAddress),
  ]);
  const pairTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);
  if (!pairTokenContract) return BigDecimal.zero();

  const totalSupply = toDecimal(pairTokenContract.totalSupply(), pairTokenContract.decimals());
  log.debug("getCurvePairUnitRate: Curve pair {} has total supply of {}", [
    getContractName(pairAddress),
    totalSupply.toString(),
  ]);
  const unitRate = totalValue.div(totalSupply);
  log.info("getCurvePairUnitRate: Unit rate of Curve LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    totalSupply.toString(),
  ]);
  return unitRate;
}

/**
 * Returns the records for the specified Curve LP.
 *
 * This function does the following:
 * - Calculates the total value of the LP
 * - Calculates the unit rate of the LP
 * - Iterates through {getWalletAddressesForContract} and adds records for the balance of the LP's normal token and staked token
 *
 * @param metricName
 * @param pairAddress the address of the Curve pair
 * @param tokenAddress restrict pairs to match the specified token (or null)
 * @param blockNumber the current block number
 * @returns
 */
export function getCurvePairRecords(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string | null,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug(
      "getCurvePairRecords: Skipping Curve pair that does not match specified token address {}",
      [tokenAddress],
    );
    return records;
  }

  const pairTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);
  if (!pairTokenContract || pairTokenContract.totalSupply().equals(BigInt.zero())) {
    log.debug("getCurvePairRecords: Skipping Curve pair {} with total supply of 0 at block {}", [
      getContractName(pairAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getCurvePairTotalValue(pairAddress, false, blockNumber);
  const includedValue = getCurvePairTotalValue(pairAddress, true, blockNumber);
  // Calculate multiplier
  const multiplier = includedValue.div(totalValue);
  log.info("getCurvePairRecords: applying multiplier of {}", [multiplier.toString()]);

  // Calculate the unit rate of the LP
  const unitRate = getCurvePairUnitRate(pairAddress, totalValue, blockNumber);
  // Some Curve tokens are in the DAO wallet, so we add that
  const wallets = getWalletAddressesForContract(pairAddress);

  const pair = CurvePool.bind(Address.fromString(pairAddress));
  const pairTokenAddress = pair.token().toHexString();

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    // Normal token first
    const record = getCurvePairRecord(
      timestamp,
      pairTokenAddress,
      unitRate,
      walletAddress,
      multiplier,
      blockNumber,
    );

    if (record && !record.balance.equals(BigDecimal.zero())) {
      records.push(record);
    }

    // Then staked token
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      const stakingAddress = CONVEX_STAKING_CONTRACTS[j];

      const stakedRecord = getCurvePairStakedRecord(
        timestamp,
        pairTokenAddress,
        getConvexStakedToken(pairTokenAddress),
        walletAddress,
        stakingAddress,
        unitRate,
        multiplier,
        blockNumber,
      );

      if (stakedRecord && !stakedRecord.balance.equals(BigDecimal.zero())) {
        records.push(stakedRecord);
      }
    }
  }

  return records;
}

// ### Token Quantity ###
function getBigDecimalFromBalance(
  tokenAddress: string,
  balance: BigInt,
  blockNumber: BigInt,
): BigDecimal {
  const tokenContract = getERC20(tokenAddress, blockNumber);
  if (!tokenContract) {
    throw new Error("Unable to fetch ERC20 at address " + tokenAddress + " for Curve pool");
  }

  return toDecimal(balance, tokenContract.decimals());
}

/**
 * Calculates the quantity of {tokenAddress}
 * contained within the pair at {pairAddress}.
 *
 * If {tokenAddress} is not present within the pair,
 * 0 will be returned.
 *
 * @param pairAddress address of a Curve pair
 * @param tokenAddress address of the token to look for
 * @param blockNumber current block number
 * @returns BigDecimal representing the quantity, or 0
 */
export function getCurvePairTotalTokenQuantity(
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  // Obtain both tokens
  const pair = CurvePool.bind(Address.fromString(pairAddress));
  const token0 = pair.coins(BigInt.fromI32(0));
  const token1 = pair.coins(BigInt.fromI32(1));

  if (token0.equals(Address.fromString(tokenAddress))) {
    const token0Balance = pair.balances(BigInt.fromI32(0));
    return getBigDecimalFromBalance(tokenAddress, token0Balance, blockNumber);
  } else if (token1.equals(Address.fromString(tokenAddress))) {
    const token1Balance = pair.balances(BigInt.fromI32(1));
    return getBigDecimalFromBalance(tokenAddress, token1Balance, blockNumber);
  }

  log.warning(
    "getCurvePairTotalTokenQuantity: Attempted to obtain quantity of token {} from Curve pair {}, but it was not found",
    [getContractName(tokenAddress), getContractName(pairAddress)],
  );
  return BigDecimal.zero();
}

/**
 * Returns records for the quantity of {tokenAddress}
 * across {getWalletAddressesForContract}.
 *
 * @param metricName
 * @param pairAddress
 * @param tokenAddress
 * @param blockNumber
 * @returns
 */
export function getCurvePairTokenQuantity(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenSupply[] {
  log.info("getCurvePairTokenQuantity: Calculating quantity of token {} in Curve pool {}", [
    getContractName(tokenAddress),
    getContractName(pairAddress),
  ]);
  const records: TokenSupply[] = [];
  const poolTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);
  if (!poolTokenContract) return records;

  // Calculate the token quantity for the pool
  const totalQuantity = getCurvePairTotalTokenQuantity(pairAddress, tokenAddress, blockNumber);

  const poolTokenAddress = poolTokenContract._address.toHexString();
  const tokenDecimals = poolTokenContract.decimals();
  log.info("getCurvePairTokenQuantity: Curve pool {} has total quantity {} of token {}", [
    getContractName(poolTokenAddress),
    totalQuantity.toString(),
    getContractName(tokenAddress),
  ]);
  const poolTokenTotalSupply = toDecimal(poolTokenContract.totalSupply(), tokenDecimals);

  // Grab balances
  const poolTokenBalances = getCurvePairRecords(timestamp, pairAddress, tokenAddress, blockNumber);

  for (let i = 0; i < poolTokenBalances.length; i++) {
    const record = poolTokenBalances[i];

    const tokenBalance = totalQuantity.times(record.balance).div(poolTokenTotalSupply);
    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(poolTokenAddress),
        poolTokenAddress,
        record.source,
        record.sourceAddress,
        TYPE_LIQUIDITY,
        tokenBalance,
        blockNumber,
        -1,
      ),
    );
  }

  return records;
}
