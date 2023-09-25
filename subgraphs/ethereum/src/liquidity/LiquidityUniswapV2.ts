import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenSupply } from "../../../shared/generated/schema";
import { TokenCategoryPOL } from "../../../shared/src/contracts/TokenDefinition";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { createTokenSupply, TYPE_LIQUIDITY } from "../../../shared/src/utils/TokenSupplyHelper";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { PoolSnapshot } from "../../generated/schema";
import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import {
  BLOCKCHAIN,
  ERC20_OHM_V2,
  ERC20_TOKENS,
  getContractName,
  getWalletAddressesForContract,
  liquidityPairHasToken,
} from "../utils/Constants";
import { getUSDRate } from "../utils/Price";


/**
 * Binds with a UniswapV2Pair contract.
 *
 * If the contract cannot be bound, or it does not exist at the current block number,
 * null will be returned.
 *
 * @param contractAddress contract address
 */
function getUniswapV2Pair(
  contractAddress: string,
): UniswapV2Pair {
  return UniswapV2Pair.bind(Address.fromString(contractAddress));
}

/**
 * Returns a PoolSnapshot, which contains cached data about the UniswapV2 pool. This
 * significantly reduces the number of instances of eth_call, which speeds up indexing.
 * 
 * @param pairAddress 
 * @param blockNumber 
 * @returns snapshot, or null if there was a contract revert
 */
export function getOrCreateUniswapV2PoolSnapshot(pairAddress: string, blockNumber: BigInt): PoolSnapshot | null {
  const snapshotId = `${pairAddress}/${blockNumber.toString()}`;
  let snapshot = PoolSnapshot.load(snapshotId);
  if (snapshot == null) {
    log.debug("getOrCreateUniswapV2PoolSnapshot: Creating new snapshot for pool {} ({}) at block {}", [getContractName(pairAddress), pairAddress, blockNumber.toString()]);

    snapshot = new PoolSnapshot(snapshotId);
    snapshot.block = blockNumber;
    snapshot.pool = Bytes.fromHexString(pairAddress);

    const pairContract = getUniswapV2Pair(pairAddress);
    const pairTotalSupplyResult = pairContract.try_totalSupply();
    const pairReservesResult = pairContract.try_getReserves();
    if (pairTotalSupplyResult.reverted || pairReservesResult.reverted) {
      return null;
    }

    const pairTokens: Address[] = [pairContract.token0(), pairContract.token1()];
    const pairReserves: BigInt[] = [pairReservesResult.value.get_reserve0(), pairReservesResult.value.get_reserve1()];
    const snapshotTokens: Bytes[] = [];
    const snapshotBalances: BigDecimal[] = [];

    for (let i = 0; i < pairTokens.length; i++) {
      const currentToken = pairTokens[i];
      const currentReserves = pairReserves[i];

      // Get the ERC20 snapshot
      const currentTokenSnapshot = getOrCreateERC20TokenSnapshot(currentToken.toHexString(), blockNumber);

      snapshotTokens.push(currentToken);
      snapshotBalances.push(toDecimal(currentReserves, currentTokenSnapshot.decimals));
    }

    snapshot.tokens = snapshotTokens;
    snapshot.balances = snapshotBalances;
    // No weights

    snapshot.decimals = pairContract.decimals();
    snapshot.totalSupply = toDecimal(pairTotalSupplyResult.value, snapshot.decimals);

    snapshot.save();
  }

  return snapshot;
}

export function getUniswapV2PairTotalValue(
  pairAddress: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): BigDecimal {
  log.info("getUniswapV2PairTotalValue: Calculating total value of pair {} ({}). excludeOhmValue? {}", [getContractName(pairAddress), pairAddress, excludeOhmValue.toString()]);

  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getUniswapV2PairTotalValue: Cannot determine total value as the UniswapV2 pool {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const poolTokens = poolSnapshot.tokens;
  const poolBalances = poolSnapshot.balances;
  let totalValue = BigDecimal.zero();

  for (let i = 0; i < poolTokens.length; i++) {
    const currentToken = poolTokens[i];
    const currentBalance = poolBalances[i];
    log.debug("getUniswapV2PairTotalValue: Checking token {}", [getContractName(currentToken.toHexString())]);

    // Skip if OHM is excluded
    if (excludeOhmValue && currentToken.toHexString().toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getUniswapV2PairTotalValue: Skipping OHM value for pair {}, as excludeOhmValue is true", [getContractName(pairAddress)]);
      continue;
    }

    log.debug("getUniswapV2PairTotalValue: balance of token {} is {}", [getContractName(currentToken.toHexString()), currentBalance.toString()]); const currentRate = getUSDRate(currentToken.toHexString(), blockNumber);
    const currentValue = currentBalance.times(currentRate);
    log.debug("getUniswapV2PairTotalValue: value of token {} in pair is {}", [getContractName(currentToken.toHexString()), currentValue.toString()]);
    totalValue = totalValue.plus(currentValue);
  }

  log.info("getUniswapV2PairTotalValue: Total value of pair {} is {}. excludeOhmValue? {}", [
    getContractName(pairAddress),
    totalValue.toString(),
    excludeOhmValue.toString(),
  ]);
  return totalValue;
}

/**
 * Determines the value of the given balance
 * of a liquidity pool.
 *
 * @deprecated
 * @param lpBalance
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
export function getUniswapV2PairValue(
  lpBalance: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getUniswapV2PairValue: Cannot determine value as the contract {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const lpValue = getUniswapV2PairTotalValue(pairAddress, false, blockNumber);
  const poolPercentageOwned = toDecimal(lpBalance, 18).div(poolSnapshot.totalSupply);
  const balanceValue = poolPercentageOwned.times(lpValue);
  log.info("getUniswapV2PairValue: Value for pair {} and balance {} is {}", [
    pairAddress,
    lpBalance.toString(),
    balanceValue.toString(),
  ]);
  return balanceValue;
}

/**
 * Determines the value of the given balance
 * of a liquidity pool between OHM and a USD
 * stablecoin.
 *
 * @param lpBalance
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
export function getOhmUSDPairValue(
  lpBalance: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getOhmUSDPairValue: Cannot determine value as the contract {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const poolTotalSupply = poolSnapshot.totalSupply;
  const poolPercentageOwned = toDecimal(lpBalance, 18).div(poolTotalSupply);
  const totalValue = getUniswapV2PairTotalValue(pairAddress, false, blockNumber);

  return poolPercentageOwned.times(totalValue);
}

/**
 * Calculates the unit rate of the given UniswapV2 pair.
 *
 * The total supply of the pair is determined and
 * divides the value to give the unit rate.
 *
 * @param pairAddress UniswapV2 pair address
 * @param totalValue total value of the UniswapV2 pair
 * @param blockNumber current block
 * @returns
 */
function getUniswapV2PairUnitRate(
  pairAddress: string,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getUniswapV2PairUnitRate: Cannot determine value as the contract {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const unitRate = totalValue.div(poolSnapshot.totalSupply);
  log.info("getUniswapV2PairUnitRate: Unit rate of UniswapV2 LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    poolSnapshot.totalSupply.toString(),
  ]);
  return unitRate;
}

/**
 * Returns the TokenRecord for the UniswapV2 pair's token
 * at the given {walletAddress}.
 *
 * @param metricName
 * @param pairAddress token address for the UniswapV2 pair
 * @param pairRate the unit rate of the pair
 * @param walletAddress the wallet to look up the balance
 * @param multiplier
 * @param blockNumber the current block number
 * @returns
 */
function getUniswapV2PairRecord(
  timestamp: BigInt,
  pairAddress: string,
  pairRate: BigDecimal,
  walletAddress: string,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const pairToken = getUniswapV2Pair(pairAddress);

  // Get the balance of the pair's token in walletAddress
  const pairTokenBalance = pairToken.balanceOf(Address.fromString(walletAddress));
  if (pairTokenBalance.equals(BigInt.zero())) {
    return null;
  }

  const pairTokenBalanceDecimal = toDecimal(pairTokenBalance, pairToken.decimals());

  return createTokenRecord(
    timestamp,
    getContractName(pairAddress),
    pairAddress,
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
 * Returns the records for the specified UniswapV2 LP.
 *
 * This function does the following:
 * - Calculates the total value of the LP
 * - Calculates the unit rate of the LP
 * - Iterates through {getWalletAddressesForContract} and adds records
 * for the balance of the LP's token
 *
 * @param metricName
 * @param pairAddress the address of the UniswapV2 pair
 * @param tokenAddress restrict results to match the specified tokenbe excluded
 * @param blockNumber the current block number
 * @returns
 */
export function getUniswapV2PairRecords(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string | null,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug(
      "getUniswapV2PairRecords: Skipping UniswapV2 pair that does not match specified token address {}",
      [tokenAddress],
    );
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getUniswapV2PairTotalValue(pairAddress, false, blockNumber);
  if (totalValue.equals(BigDecimal.zero())) {
    return records;
  }

  const includedValue = getUniswapV2PairTotalValue(pairAddress, true, blockNumber);
  // Calculate multiplier
  const multiplier = includedValue.div(totalValue);
  log.info("getUniswapV2PairRecords: applying multiplier of {}", [multiplier.toString()]);

  // Calculate the unit rate of the LP
  const unitRate = getUniswapV2PairUnitRate(pairAddress, totalValue, blockNumber);
  const wallets = getWalletAddressesForContract(pairAddress);

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const record = getUniswapV2PairRecord(
      timestamp,
      pairAddress,
      unitRate,
      walletAddress,
      multiplier,
      blockNumber,
    );
    if (record) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Calculates the quantity of {tokenAddress}
 * contained within the pair at {pairAddress}.
 *
 * If {tokenAddress} is not present within the pair,
 * 0 will be returned.
 *
 * @param pairAddress address of a UniswapV2 pair
 * @param tokenAddress address of the token to look for
 * @param blockNumber current block number
 * @returns BigDecimal representing the quantity, or 0
 */
export function getUniswapV2PairTotalTokenQuantity(
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getUniswapV2PairTotalTokenQuantity: Cannot determine total quantity the contract {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  for (let i = 0; i < poolSnapshot.tokens.length; i++) {
    const currentToken = poolSnapshot.tokens[i];
    const currentBalance = poolSnapshot.balances[i];

    if (currentToken.toHexString().toLowerCase() != tokenAddress.toLowerCase()) {
      continue;
    }

    return currentBalance;
  }

  log.warning(
    "getUniswapV2PairTotalTokenQuantity: Attempted to obtain quantity of token {} from UniswapV2 pair {}, but it was not found",
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
export function getUniswapV2PairTokenQuantity(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenSupply[] {
  log.info("getUniswapV2PairTokenQuantity: Calculating quantity of token {} in UniswapV2 pool {}", [
    getContractName(tokenAddress),
    getContractName(pairAddress),
  ]);
  const records: TokenSupply[] = [];
  const poolSnapshot = getOrCreateUniswapV2PoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.warning(
      "getUniswapV2PairTokenQuantity: UniswapV2 contract at {} likely doesn't exist at block {}",
      [pairAddress, blockNumber.toString()],
    );
    return records;
  }

  // Calculate the token quantity for the pool
  const totalQuantity = getUniswapV2PairTotalTokenQuantity(pairAddress, tokenAddress, blockNumber);
  log.info("getUniswapV2PairTokenQuantity: UniswapV2 pool {} has total quantity of {}", [
    getContractName(pairAddress),
    totalQuantity.toString(),
  ]);
  const poolTokenTotalSupply = poolSnapshot.totalSupply;
  if (poolTokenTotalSupply.equals(BigDecimal.zero())) {
    log.debug(
      "getUniswapV2PairTokenQuantity: Skipping UniswapV2 pair {} with total supply of 0 at block {}",
      [getContractName(pairAddress), blockNumber.toString()],
    );
    return records;
  }

  log.info("getUniswapV2PairTokenQuantity: UniswapV2 pool {} has total supply of {}", [
    getContractName(pairAddress),
    poolTokenTotalSupply.toString(),
  ]);

  // Grab balances
  const poolTokenBalances = getUniswapV2PairRecords(
    timestamp,
    pairAddress,
    tokenAddress,
    blockNumber,
  );

  for (let i = 0; i < poolTokenBalances.length; i++) {
    const record = poolTokenBalances[i];

    const tokenBalance = totalQuantity.times(record.balance).div(poolTokenTotalSupply);
    records.push(
      createTokenSupply(
        timestamp,
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(pairAddress),
        pairAddress,
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
