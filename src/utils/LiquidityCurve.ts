import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";

import { CurvePool } from "../../generated/ProtocolMetrics/CurvePool";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  CONVEX_STAKING_CONTRACTS,
  DAO_WALLET,
  ERC20_OHM_V2,
  getContractName,
  getConvexStakedToken,
  liquidityPairHasToken,
  WALLET_ADDRESSES,
} from "./Constants";
import { getConvexStakedBalance, getERC20 } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import {
  addToMetricName,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";

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
  restrictToToken: boolean,
  tokenAddress: string | null,
  blockNumber: BigInt,
): BigDecimal {
  // Obtain both tokens
  const pair = CurvePool.bind(Address.fromString(pairAddress));
  let totalValue = BigDecimal.zero();
  log.info(
    "Calculating value of pair {} with excludeOhmValue = {}, restrictToToken = {}, token = {}",
    [
      getContractName(pairAddress),
      excludeOhmValue ? "true" : "false",
      restrictToToken ? "true" : "false",
      tokenAddress ? getContractName(tokenAddress) : "null",
    ],
  );

  // token0 balance * token0 rate + token1 balance * token1 rate
  for (let i = 0; i < 2; i++) {
    const token: string = pair.coins(BigInt.fromI32(i)).toHexString();

    if (excludeOhmValue && token.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getCurvePairTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    if (tokenAddress && restrictToToken && tokenAddress.toLowerCase() != token.toLowerCase()) {
      log.debug("getCurvePairTotalValue: Skipping token {} as restrictToToken is true", [token]);
      continue;
    }

    const tokenContract = getERC20(getContractName(token), token, blockNumber);
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
  metricName: string,
  pairTokenAddress: string,
  stakedTokenAddress: string | null,
  walletAddress: string,
  stakingAddress: string,
  pairRate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  if (!stakedTokenAddress) {
    log.debug(
      "Curve pair balance for staked token {} ({}) in wallet {} ({}) was 0, and no staked token was found.",
      [
        getContractName(pairTokenAddress),
        pairTokenAddress,
        getContractName(walletAddress),
        walletAddress,
      ],
    );
    return null;
  }

  const stakedTokenAddressNotNull = stakedTokenAddress ? stakedTokenAddress : "";
  const balance = getConvexStakedBalance(
    stakedTokenAddressNotNull,
    walletAddress,
    stakingAddress,
    blockNumber,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  return newTokenRecord(
    metricName,
    getContractName(stakedTokenAddressNotNull),
    stakedTokenAddressNotNull,
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    balance,
    blockNumber,
    multiplier,
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
  metricName: string,
  pairTokenAddress: string,
  pairRate: BigDecimal,
  walletAddress: string,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const pairToken = getERC20(getContractName(pairTokenAddress), pairTokenAddress, blockNumber);
  if (!pairToken) {
    throw new Error("Unable to bind to ERC20 contract for Curve pair token " + pairTokenAddress);
  }

  // Get the balance of the pair's token in walletAddress
  const pairTokenBalance = pairToken.balanceOf(Address.fromString(walletAddress));
  if (pairTokenBalance.equals(BigInt.zero())) {
    log.debug("Curve pair balance for token {} ({}) in wallet {} ({}) was 0", [
      getContractName(pairTokenAddress),
      pairTokenAddress,
      getContractName(walletAddress),
      walletAddress,
    ]);
    return null;
  }

  const pairTokenBalanceDecimal = toDecimal(pairTokenBalance, pairToken.decimals());

  return newTokenRecord(
    metricName,
    getContractName(pairTokenAddress),
    pairTokenAddress,
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    pairTokenBalanceDecimal,
    blockNumber,
    multiplier,
  );
}

function getCurvePairToken(pairAddress: string): string {
  const pair = CurvePool.bind(Address.fromString(pairAddress));

  return pair.token().toHexString();
}

function getCurvePairTokenContract(pairAddress: string, blockNumber: BigInt): ERC20 {
  const pairTokenAddress = getCurvePairToken(pairAddress);
  const pairTokenContract = getERC20(
    getContractName(pairTokenAddress),
    pairTokenAddress,
    blockNumber,
  );
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
  log.info("Calculating unit rate for Curve pair {}", [getContractName(pairAddress)]);
  const pairTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);

  const totalSupply = toDecimal(pairTokenContract.totalSupply(), pairTokenContract.decimals());
  log.debug("Curve pair {} has total supply of {}", [
    getContractName(pairAddress),
    totalSupply.toString(),
  ]);
  const unitRate = totalValue.div(totalSupply);
  log.info("Unit rate of Curve LP {} is {} for total supply {}", [
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
 * - Iterates through {WALLET_ADDRESSES} and adds records for the balance of the LP's normal token and staked token
 *
 * If
 *
 * @param metricName
 * @param pairAddress the address of the Curve pair
 * @param tokenAddress restrict pairs to match the specified token (or null)
 * @param excludeOhmValue true if the value of OHM in the LP should be excluded. This can be used to calculate backing.
 * @param restrictToTokenValue true if the value should reflect that of {tokenAddress}. This can be used to calculate the value of liquidity for a certain token.
 * @param blockNumber the current block number
 * @returns
 */
export function getCurvePairRecords(
  metricName: string,
  pairAddress: string,
  tokenAddress: string | null,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, "CurvePairRecords-" + getContractName(pairAddress)),
    blockNumber,
  );
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug("Skipping Curve pair that does not match specified token address {}", [tokenAddress]);
    return records;
  }

  const pairTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);
  if (pairTokenContract.totalSupply().equals(BigInt.zero())) {
    log.debug("Skipping Curve pair {} with total supply of 0 at block {}", [
      getContractName(pairAddress),
      blockNumber.toString(),
    ]);
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getCurvePairTotalValue(pairAddress, false, false, null, blockNumber);
  const includedValue = getCurvePairTotalValue(
    pairAddress,
    excludeOhmValue,
    restrictToTokenValue,
    tokenAddress,
    blockNumber,
  );
  // Calculate multiplier
  const multiplier =
    excludeOhmValue || (tokenAddress && restrictToTokenValue)
      ? includedValue.div(totalValue)
      : BigDecimal.fromString("1");
  log.info(
    "getCurvePairRecords: applying multiplier of {} based on excludeOhmValue = {} and restrictToTokenValue = {}",
    [multiplier.toString(), excludeOhmValue ? "true" : "false", "false"],
  );

  // Calculate the unit rate of the LP
  const unitRate = getCurvePairUnitRate(pairAddress, totalValue, blockNumber);
  // Some Curve tokens are in the DAO wallet, so we add that
  const wallets = WALLET_ADDRESSES.concat([DAO_WALLET]);

  const pair = CurvePool.bind(Address.fromString(pairAddress));
  const pairTokenAddress = pair.token().toHexString();

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    // Normal token first
    const record = getCurvePairRecord(
      metricName,
      pairTokenAddress,
      unitRate,
      walletAddress,
      multiplier,
      blockNumber,
    );
    if (record) {
      pushTokenRecord(records, record);
    }

    // Then staked token
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      const stakingAddress = CONVEX_STAKING_CONTRACTS[j];

      const stakedRecord = getCurvePairStakedRecord(
        metricName,
        pairTokenAddress,
        getConvexStakedToken(pairTokenAddress),
        walletAddress,
        stakingAddress,
        unitRate,
        multiplier,
        blockNumber,
      );

      if (stakedRecord) {
        pushTokenRecord(records, stakedRecord);
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
  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
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

  log.warning("Attempted to obtain quantity of token {} from Curve pair {}, but it was not found", [
    getContractName(tokenAddress),
    getContractName(pairAddress),
  ]);
  return BigDecimal.zero();
}

/**
 * Returns records for the quantity of {tokenAddress}
 * across {WALLET_ADDRESSES}.
 *
 * @param metricName
 * @param pairAddress
 * @param tokenAddress
 * @param blockNumber
 * @returns
 */
export function getCurvePairTokenQuantity(
  metricName: string,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating quantity of token {} in Curve pool {}", [
    getContractName(tokenAddress),
    getContractName(pairAddress),
  ]);
  const records = newTokenRecords(
    addToMetricName(metricName, "CurvePoolTokenQuantity-" + getContractName(tokenAddress)),
    blockNumber,
  );
  const poolTokenContract = getCurvePairTokenContract(pairAddress, blockNumber);

  // Calculate the token quantity for the pool
  const totalQuantity = getCurvePairTotalTokenQuantity(pairAddress, tokenAddress, blockNumber);

  const poolTokenAddress = poolTokenContract._address.toHexString();
  const tokenDecimals = poolTokenContract.decimals();
  log.info("Curve pool {} has total quantity {} of token {}", [
    getContractName(poolTokenAddress),
    totalQuantity.toString(),
    getContractName(tokenAddress),
  ]);
  const poolTokenTotalSupply = toDecimal(poolTokenContract.totalSupply(), tokenDecimals);

  // Grab balances
  const poolTokenBalances = getCurvePairRecords(
    metricName,
    pairAddress,
    tokenAddress,
    false,
    false,
    blockNumber,
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
        BigDecimal.fromString("1"),
        tokenBalance,
        blockNumber,
      ),
    );
  }

  return records;
}
