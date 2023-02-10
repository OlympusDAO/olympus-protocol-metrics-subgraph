import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";

import { TokenRecord } from "../../../shared/generated/schema";
import { TokenCategoryPOL, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createOrUpdateTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { CurvePool } from "../../generated/ProtocolMetrics/CurvePool";
import { CurvePoolV2 } from "../../generated/ProtocolMetrics/CurvePoolV2";
import { ERC20TokenSnapshot, PoolSnapshot, TokenSupply } from "../../generated/schema";
import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import {
  BLOCKCHAIN,
  CONVEX_STAKING_CONTRACTS,
  ERC20_OHM_V2,
  ERC20_TOKENS,
  FRAX_LOCKING_CONTRACTS,
  getContractName,
  getConvexStakedToken,
  getFraxStakedToken,
  getWalletAddressesForContract,
  liquidityPairHasToken,
} from "../utils/Constants";
import { getConvexStakedBalance, getERC20, getFraxLockedBalance } from "../utils/ContractHelper";
import { getUSDRate } from "../utils/Price";
import { createOrUpdateTokenSupply, TYPE_LIQUIDITY } from "../utils/TokenSupplyHelper";

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
  const tokenResult = pair.try_token();
  if (!tokenResult.reverted) {
    return tokenResult.value.toHexString();
  }

  // For some pools (e.g. FRAX-USDC), a different interface is used... not sure why.
  const pairV2 = CurvePoolV2.bind(Address.fromString(pairAddress));
  const tokenV2Result = pairV2.try_lp_token();
  if (!tokenV2Result.reverted) {
    return tokenV2Result.value.toHexString();
  }

  log.warning(
    "getCurvePairToken: ERC20 token for Curve pair {} could not be determined at block {} due to contract revert. Skipping",
    [getContractName(pairAddress), blockNumber.toString()],
  );
  return null;
}

/**
 * Returns a PoolSnapshot, which contains cached data about the UniswapV2 pool. This
 * significantly reduces the number of instances of eth_call, which speeds up indexing.
 * 
 * @param pairAddress 
 * @param blockNumber 
 * @returns snapshot, or null if there was a contract revert
 */
export function getOrCreateCurvePoolSnapshot(pairAddress: string, blockNumber: BigInt): PoolSnapshot | null {
  const snapshotId = `${pairAddress}/${blockNumber.toString()}`;
  let snapshot = PoolSnapshot.load(snapshotId);
  if (snapshot == null) {
    log.debug("getOrCreateCurvePoolSnapshot: Creating new snapshot for pool {} ({}) at block {}", [getContractName(pairAddress), pairAddress, blockNumber.toString()]);

    snapshot = new PoolSnapshot(snapshotId);
    snapshot.block = blockNumber;
    snapshot.pool = Bytes.fromHexString(pairAddress);

    const pairContract = CurvePool.bind(Address.fromString(pairAddress));
    const pairTokenAddress: string | null = getCurvePairToken(pairAddress, blockNumber);
    if (pairTokenAddress === null) {
      return null;
    }

    const snapshotTokens: Bytes[] = [];
    const snapshotBalances: BigDecimal[] = [];
    // Only two tokens in a Curve pair
    for (let i = 0; i < 2; i++) {
      const currentIndex = BigInt.fromI32(i);
      const currentToken = pairContract.coins(currentIndex);
      const currentBalance = pairContract.balances(currentIndex);
      const currentTokenSnapshot = getOrCreateERC20TokenSnapshot(currentToken.toHexString(), blockNumber);

      snapshotTokens.push(currentToken);
      snapshotBalances.push(toDecimal(currentBalance, currentTokenSnapshot.decimals));
    }

    snapshot.tokens = snapshotTokens;
    snapshot.balances = snapshotBalances;
    // No weights

    const pairToken: ERC20TokenSnapshot = getOrCreateERC20TokenSnapshot(pairTokenAddress, blockNumber);
    snapshot.poolToken = Bytes.fromHexString(pairTokenAddress);
    snapshot.decimals = pairToken.decimals;
    snapshot.totalSupply = pairToken.totalSupply;

    snapshot.save();
  }

  return snapshot;
}

// ### Balances ###

/**
 * Returns the total value of the given Curve pair.
 *
 * Calculated as: token0 balance * token0 rate + token1 balance * token1 rate
 *
 * @param pairAddress
 * @param excludeOhmValue If true, the value will exclude OHM. This can be used to calculate backing
 * @param blockNumber
 * @returns
 */
export function getCurvePairTotalValue(
  pairAddress: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateCurvePoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    return BigDecimal.zero();
  }

  log.info("getCurvePairTotalValue: Calculating value of pair {} with excludeOhmValue = {}", [
    getContractName(pairAddress),
    excludeOhmValue ? "true" : "false",
  ]);

  // Obtain both tokens
  let totalValue = BigDecimal.zero();
  const poolTokens = poolSnapshot.tokens;

  // token0 balance * token0 rate + token1 balance * token1 rate
  for (let i = 0; i < poolTokens.length; i++) {
    const token: string = poolTokens[i].toHexString();
    const balance: BigDecimal = poolSnapshot.balances[i];

    if (excludeOhmValue && token.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getCurvePairTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    const rate = getUSDRate(token, blockNumber);
    const value = balance.times(rate);
    log.debug("getCurvePairTotalValue: Token address: {}, balance: {}, rate: {}, value: {}", [
      token,
      balance.toString(),
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
 * @param stakedTokenDefinition
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
  stakedTokenDefinition: TokenDefinition | null,
  walletAddress: string,
  stakingAddress: string,
  pairRate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  if (stakedTokenDefinition === null) {
    return null;
  }

  const balance = getConvexStakedBalance(
    stakedTokenDefinition.getAddress(),
    walletAddress,
    stakingAddress,
    blockNumber,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  log.debug(
    "getCurvePairStakedRecord: balance for staked token {} ({}) in wallet {} ({}) and staking contract {} ({}) was {}.",
    [
      getContractName(stakedTokenDefinition.getAddress()),
      stakedTokenDefinition.getAddress(),
      getContractName(walletAddress),
      walletAddress,
      getContractName(stakingAddress),
      stakingAddress,
      balance.toString(),
    ],
  );
  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(stakedTokenDefinition.getAddress()),
    stakedTokenDefinition.getAddress(),
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    balance,
    blockNumber,
    true,
    ERC20_TOKENS,
    BLOCKCHAIN,
    multiplier,
    stakedTokenDefinition.getCategory(),
  );
}

/**
 * Creates a token record for a Frax-locked Curve pair token.
 *
 * If the stakedTokenAddress is null or the balance is 0, null is returned.
 *
 * This looks up the balance of {stakedTokenAddress} on {stakingAddress}, instead
 * of using `balanceOf`, which doesn't work with the Convex contracts.
 *
 * @param metricName
 * @param pairTokenAddress
 * @param stakedTokenDefinition
 * @param walletAddress
 * @param stakingAddress
 * @param pairRate
 * @param excludeOhmValue
 * @param blockNumber
 * @returns
 */
function getCurvePairFraxLockedRecord(
  timestamp: BigInt,
  pairTokenAddress: string,
  stakedTokenDefinition: TokenDefinition | null,
  walletAddress: string,
  stakingAddress: string,
  pairRate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  if (stakedTokenDefinition === null) {
    return null;
  }

  const balance = getFraxLockedBalance(
    stakedTokenDefinition.getAddress(),
    walletAddress,
    stakingAddress,
    blockNumber,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  log.debug(
    "getCurvePairFraxLockedRecord: balance for locked token {} ({}) in wallet {} ({}) and locking contract {} ({}) was {}.",
    [
      getContractName(stakedTokenDefinition.getAddress()),
      stakedTokenDefinition.getAddress(),
      getContractName(walletAddress),
      walletAddress,
      getContractName(stakingAddress),
      stakingAddress,
      balance.toString(),
    ],
  );
  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(stakedTokenDefinition.getAddress()),
    stakedTokenDefinition.getAddress(),
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    balance,
    blockNumber,
    true,
    ERC20_TOKENS,
    BLOCKCHAIN,
    multiplier,
    stakedTokenDefinition.getCategory(),
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
    return null;
  }

  const pairTokenSnapshot = getOrCreateERC20TokenSnapshot(pairTokenAddress, blockNumber);
  const pairTokenBalanceDecimal = toDecimal(pairTokenBalance, pairTokenSnapshot.decimals);
  log.debug("getCurvePairRecord: Curve pair balance for token {} ({}) in wallet {} ({}) was {}", [
    getContractName(pairTokenAddress),
    pairTokenAddress,
    getContractName(walletAddress),
    walletAddress,
    pairTokenBalanceDecimal.toString(),
  ]);

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
    ERC20_TOKENS,
    BLOCKCHAIN,
    multiplier,
    TokenCategoryPOL,
  );
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
  const poolSnapshot = getOrCreateCurvePoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) return BigDecimal.zero();

  const unitRate = totalValue.div(poolSnapshot.totalSupply);
  log.info("getCurvePairUnitRate: Unit rate of Curve LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    poolSnapshot.totalSupply.toString(),
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
      "getCurvePairRecords: Skipping Curve pair {} ({}) that does not match specified token address {}", [
      getContractName(pairAddress),
      pairAddress,
      tokenAddress
    ],
    );
    return records;
  }

  const poolSnapshot = getOrCreateCurvePoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot || poolSnapshot.totalSupply.equals(BigDecimal.zero()) || !poolSnapshot.poolToken) {
    log.debug("getCurvePairRecords: Skipping Curve pair {} ({}) with total supply of 0 at block {}", [
      getContractName(pairAddress),
      pairAddress,
      blockNumber.toString(),
    ]);
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getCurvePairTotalValue(pairAddress, false, blockNumber);
  const includedValue = getCurvePairTotalValue(pairAddress, true, blockNumber);
  // Calculate multiplier
  const multiplier = includedValue.div(totalValue);

  // Calculate the unit rate of the LP
  const unitRate = getCurvePairUnitRate(pairAddress, totalValue, blockNumber);
  // Some Curve tokens are in the DAO wallet, so we add that
  const wallets = getWalletAddressesForContract(pairAddress);

  const pairToken = poolSnapshot.poolToken;
  const pairTokenAddress = pairToken === null ? "" : pairToken.toHexString();

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

    // Then token locked in Frax
    for (let k = 0; k < FRAX_LOCKING_CONTRACTS.length; k++) {
      const stakingAddress = FRAX_LOCKING_CONTRACTS[k];

      const stakedRecord = getCurvePairFraxLockedRecord(
        timestamp,
        pairTokenAddress,
        getFraxStakedToken(pairTokenAddress),
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
  const poolSnapshot = getOrCreateCurvePoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    return BigDecimal.zero();
  }

  for (let i = 0; i < poolSnapshot.balances.length; i++) {
    const currentToken = poolSnapshot.tokens[i];
    const currentBalance = poolSnapshot.balances[i];

    if (!currentToken.equals(Bytes.fromHexString(tokenAddress))) {
      continue;
    }

    return currentBalance;
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
  const poolSnapshot = getOrCreateCurvePoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) return records;
  const poolToken = poolSnapshot.poolToken;
  if (poolToken === null) return records;

  // Calculate the token quantity for the pool
  const totalQuantity = getCurvePairTotalTokenQuantity(pairAddress, tokenAddress, blockNumber);

  const poolTokenAddress = poolToken.toHexString();
  log.info("getCurvePairTokenQuantity: Curve pool {} has total quantity {} of token {}", [
    getContractName(poolTokenAddress),
    totalQuantity.toString(),
    getContractName(tokenAddress),
  ]);

  // Grab balances
  const poolTokenBalances = getCurvePairRecords(timestamp, pairAddress, tokenAddress, blockNumber);

  for (let i = 0; i < poolTokenBalances.length; i++) {
    const record = poolTokenBalances[i];

    const tokenBalance = totalQuantity.times(record.balance).div(poolSnapshot.totalSupply);
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
