import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenSupply } from "../../../shared/generated/schema";
import { TokenCategoryPOL } from "../../../shared/src/contracts/TokenDefinition";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createOrUpdateTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { FraxSwapPool } from "../../generated/ProtocolMetrics/FraxSwapPool";
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
import { createOrUpdateTokenSupply, TYPE_LIQUIDITY } from "../utils/TokenSupplyHelper";

/**
 * Returns a PoolSnapshot, which contains cached data about the Frax pool. This
 * significantly reduces the number of instances of eth_call, which speeds up indexing.
 * 
 * @param pairAddress 
 * @param blockNumber 
 * @returns snapshot, or null if there was a contract revert
 */
export function getOrCreateFraxPoolSnapshot(pairAddress: string, blockNumber: BigInt): PoolSnapshot | null {
  const snapshotId = `${pairAddress}/${blockNumber.toString()}`;
  let snapshot = PoolSnapshot.load(snapshotId);
  if (snapshot == null) {
    log.debug("getOrCreateFraxPoolSnapshot: Creating new snapshot for pool {} ({}) at block {}", [getContractName(pairAddress), pairAddress, blockNumber.toString()]);

    snapshot = new PoolSnapshot(snapshotId);
    snapshot.block = blockNumber;
    snapshot.pool = Bytes.fromHexString(pairAddress);

    const pairContract = FraxSwapPool.bind(Address.fromString(pairAddress));
    const pairReservesResult = pairContract.try_getReserves();
    if (pairReservesResult.reverted) {
      log.info(
        "getOrCreateFraxPoolSnapshot: Unable to bind to FraxSwapPool {} ({}) at block {}. Skipping",
        [getContractName(pairAddress), pairAddress, blockNumber.toString()],
      );
      return null;
    }

    const pairTokens = [pairContract.token0(), pairContract.token1()];
    const pairBalances = [pairContract.getReserves().value0, pairContract.getReserves().value1];
    const snapshotTokens: Bytes[] = [];
    const snapshotBalances: BigDecimal[] = [];

    for (let i = 0; i < pairTokens.length; i++) {
      const currentToken = pairTokens[i];
      const currentBalance = pairBalances[i];
      const currentTokenSnapshot = getOrCreateERC20TokenSnapshot(currentToken.toHexString(), blockNumber);

      snapshotTokens.push(currentToken);
      snapshotBalances.push(toDecimal(currentBalance, currentTokenSnapshot.decimals));
    }

    snapshot.tokens = snapshotTokens;
    snapshot.balances = snapshotBalances;
    // No weights

    snapshot.decimals = pairContract.decimals();
    snapshot.totalSupply = toDecimal(pairContract.totalSupply(), snapshot.decimals);

    snapshot.save();
  }

  return snapshot;
}

/**
 * Returns the total value of the given FraxSwap pair.
 *
 * Calculated as: token0 balance * token0 rate + token1 balance * token1 rate
 *
 * @param pairAddress
 * @param excludeOhmValue If true, the value will exclude OHM. This can be used to calculate backing
 * @param blockNumber
 * @returns
 */
export function getFraxSwapPairTotalValue(
  pairAddress: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    log.info(
      "getFraxSwapPairTotalValue: Unable to bind to FraxSwapPool {} ({}) at block {}. Skipping",
      [getContractName(pairAddress), pairAddress, blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  let totalValue = BigDecimal.zero();
  log.info("getFraxSwapPairTotalValue: Calculating value of pair {} with excludeOhmValue = {}", [
    getContractName(pairAddress),
    excludeOhmValue ? "true" : "false",
  ]);

  // token0 balance * token0 rate + token1 balance * token1 rate
  for (let i = 0; i < poolSnapshot.tokens.length; i++) {
    const token: string = poolSnapshot.tokens[i].toHexString();
    const balance: BigDecimal = poolSnapshot.balances[i];

    if (excludeOhmValue && token.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getFraxSwapPairTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    const rate = getUSDRate(token, blockNumber);
    const value = balance.times(rate);
    log.debug(
      "getFraxSwapPairTotalValue: Token address: {} ({}), balance: {}, rate: {}, value: {}",
      [
        getContractName(token),
        token,
        balance.toString(),
        rate.toString(),
        value.toString(),
      ],
    );

    totalValue = totalValue.plus(value);
  }

  return totalValue;
}

/**
 * Determines the unit rate of the given FraxSwap pool.
 *
 * Unit rate = total value / total supply
 *
 * @param poolTokenContract
 * @param totalValue
 * @param _blockNumber
 * @returns
 */
export function getFraxSwapPairUnitRate(
  pairAddress: string,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) {
    return BigDecimal.zero();
  }

  const unitRate = totalValue.div(poolSnapshot.totalSupply);
  log.info("getFraxSwapPairUnitRate: Unit rate of FraxSwap LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    poolSnapshot.totalSupply.toString(),
  ]);
  return unitRate;
}

/**
 * Helper method to simplify getting the balance from a FraxSwapPool contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound FraxSwapPool contract.
 * @param address The address of the holder.
 * @param blockNumber The current block number.
 * @returns BigDecimal
 */
function getFraxSwapPairTokenBalance(
  pairAddress: string,
  address: string,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot || poolSnapshot.totalSupply === null) {
    return BigDecimal.zero();
  }

  const pairContract = FraxSwapPool.bind(Address.fromString(pairAddress));
  return toDecimal(pairContract.balanceOf(Address.fromString(address)), poolSnapshot.decimals);
}

function getFraxSwapPairTokenRecord(
  timestamp: BigInt,
  pairAddress: string,
  unitRate: BigDecimal,
  walletAddress: string,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const tokenBalance = getFraxSwapPairTokenBalance(pairAddress, walletAddress, blockNumber);
  if (tokenBalance.equals(BigDecimal.zero())) {
    log.debug(
      "getFraxSwapPairTokenRecord: FraxSwap pair balance for token {} ({}) in wallet {} ({}) was 0 at block {}",
      [
        getContractName(pairAddress),
        pairAddress,
        getContractName(walletAddress),
        walletAddress,
        blockNumber.toString(),
      ],
    );
    return null;
  }

  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(pairAddress),
    pairAddress,
    getContractName(walletAddress),
    walletAddress,
    unitRate,
    tokenBalance,
    blockNumber,
    true,
    ERC20_TOKENS,
    BLOCKCHAIN,
    multiplier,
    TokenCategoryPOL,
  );
}

/**
 * Provides TokenRecord objects representing the FraxSwap pair identified by {pairAddress}.
 *
 * @param metricName
 * @param pairAddress The address of the pool
 * @param excludeOhmValue If true, the value will exclude that of OHM
 * @param restrictToTokenValue If true, the value will reflect the portion of the pool made up by {tokenAddress}. Overrides {excludeOhmValue}.
 * @param blockNumber The current block number
 * @param tokenAddress If specified, this function will exit if the token is not in the liquidity pool
 * @returns
 */
export function getFraxSwapPairRecords(
  timestamp: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
  tokenAddress: string | null = null,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug(
      "getFraxSwapPairRecords: Skipping FraxSwap pair that does not match specified token address {} ({})",
      [getContractName(tokenAddress), tokenAddress],
    );
    return records;
  }

  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot || poolSnapshot.totalSupply.equals(BigDecimal.zero())) {
    log.debug(
      "getFraxSwapPairRecords: Skipping FraxSwap pair {} with total supply of 0 at block {}",
      [getContractName(pairAddress), blockNumber.toString()],
    );
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getFraxSwapPairTotalValue(pairAddress, false, blockNumber);
  const includedValue = getFraxSwapPairTotalValue(pairAddress, true, blockNumber);
  // Calculate multiplier
  const multiplier = includedValue.div(totalValue);
  log.info("getFraxSwapPairRecords: applying multiplier of {}", [multiplier.toString()]);

  // Calculate the unit rate of the LP
  const unitRate = getFraxSwapPairUnitRate(pairAddress, totalValue, blockNumber);

  const wallets = getWalletAddressesForContract(pairAddress);
  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const record = getFraxSwapPairTokenRecord(
      timestamp,
      pairAddress,
      unitRate,
      walletAddress,
      multiplier,
      blockNumber,
    );

    if (record && !record.balance.equals(BigDecimal.zero())) {
      records.push(record);
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
 * @param pairAddress address of a FraxSwap pair
 * @param tokenAddress address of the token to look for
 * @param blockNumber current block number
 * @returns BigDecimal representing the quantity, or 0
 */
export function getFraxSwapPairTokenQuantity(
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
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
    "getFraxSwapPairTokenQuantity: Attempted to obtain quantity of token {} from FraxSwap pair {}, but it was not found",
    [getContractName(tokenAddress), getContractName(pairAddress)],
  );
  return BigDecimal.zero();
}

export function getFraxSwapPairTokenQuantityRecords(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenSupply[] {
  log.info(
    "getFraxSwapPairTokenQuantityRecords: Calculating quantity of token {} in FraxSwap pool {}",
    [getContractName(tokenAddress), getContractName(pairAddress)],
  );
  const records: TokenSupply[] = [];
  const poolSnapshot = getOrCreateFraxPoolSnapshot(pairAddress, blockNumber);
  if (!poolSnapshot) return records;

  // Calculate the token quantity for the pool
  const totalQuantity = getFraxSwapPairTokenQuantity(pairAddress, tokenAddress, blockNumber);

  log.info(
    "getFraxSwapPairTokenQuantityRecords: FraxSwap pool {} has total quantity {} of token {}",
    [getContractName(pairAddress), totalQuantity.toString(), getContractName(tokenAddress)],
  );

  // Grab balances
  const pairBalanceRecords = getFraxSwapPairRecords(
    timestamp,
    pairAddress,
    blockNumber,
    tokenAddress,
  );

  for (let i = 0; i < pairBalanceRecords.length; i++) {
    const record = pairBalanceRecords[i];

    const tokenBalance = totalQuantity.times(record.balance).div(poolSnapshot.totalSupply);
    records.push(
      createOrUpdateTokenSupply(
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
