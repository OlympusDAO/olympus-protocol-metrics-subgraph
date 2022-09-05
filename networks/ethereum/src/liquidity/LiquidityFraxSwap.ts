import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { FraxSwapPool } from "../../generated/ProtocolMetrics/FraxSwapPool";
import { TokenRecord, TokenSupply } from "../../generated/schema";
import {
  ERC20_OHM_V2,
  getContractName,
  getWalletAddressesForContract,
  liquidityPairHasToken,
} from "../utils/Constants";
import { getERC20 } from "../utils/ContractHelper";
import { getUSDRate } from "../utils/Price";
import { TokenCategoryPOL } from "../utils/TokenDefinition";
import { createOrUpdateTokenRecord } from "../utils/TokenRecordHelper";
import { createOrUpdateTokenSupply, TYPE_LIQUIDITY } from "../utils/TokenSupplyHelper";

function getFraxSwapPair(pairAddress: string, blockNumber: BigInt): FraxSwapPool | null {
  const pair = FraxSwapPool.bind(Address.fromString(pairAddress));

  // If the token does not exist at the current block, it will revert
  if (pair.try_token0().reverted) {
    log.debug(
      "getFraxSwapPair: ERC20 token for FraxSwap pair {} could not be determined at block {} due to contract revert. Skipping",
      [getContractName(pairAddress), blockNumber.toString()],
    );
    return null;
  }

  return pair;
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
  const pair = getFraxSwapPair(pairAddress, blockNumber);
  if (!pair) {
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

  const tokens: Address[] = [];
  tokens.push(pair.token0());
  tokens.push(pair.token1());

  const reserves: BigInt[] = [];
  reserves.push(pair.getReserves().value0);
  reserves.push(pair.getReserves().value1);

  // token0 balance * token0 rate + token1 balance * token1 rate
  for (let i = 0; i < tokens.length; i++) {
    const token: string = tokens[i].toHexString();

    if (excludeOhmValue && token.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getFraxSwapPairTotalValue: Skipping OHM as excludeOhmValue is true", []);
      continue;
    }

    const tokenContract = getERC20(token, blockNumber);
    if (!tokenContract) {
      throw new Error("Unable to fetch ERC20 at address " + token + " for FraxSwap pool");
    }

    const tokenBalance = reserves[i];
    const tokenBalanceDecimal = toDecimal(tokenBalance, tokenContract.decimals());
    const rate = getUSDRate(token, blockNumber);
    const value = tokenBalanceDecimal.times(rate);
    log.debug(
      "getFraxSwapPairTotalValue: Token address: {} ({}), balance: {}, rate: {}, value: {}",
      [
        getContractName(token),
        token,
        tokenBalanceDecimal.toString(),
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
  pairContract: FraxSwapPool,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  const pairAddress = pairContract._address.toHexString().toLowerCase();
  log.info(
    "getFraxSwapPairUnitRate: Calculating unit rate for FraxSwap pair {} at block number {}",
    [getContractName(pairAddress), blockNumber.toString()],
  );

  const totalSupply = toDecimal(pairContract.totalSupply(), pairContract.decimals());
  log.debug("getFraxSwapPairUnitRate: FraxSwap pair {} has total supply of {}", [
    getContractName(pairAddress),
    totalSupply.toString(),
  ]);
  const unitRate = totalValue.div(totalSupply);
  log.info("getFraxSwapPairUnitRate: Unit rate of FraxSwap LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    totalSupply.toString(),
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
  contract: FraxSwapPool | null,
  address: string,
  _blockNumber: BigInt,
): BigDecimal {
  if (!contract) {
    return BigDecimal.zero();
  }

  return toDecimal(contract.balanceOf(Address.fromString(address)), contract.decimals());
}

function getFraxSwapPairTokenRecord(
  timestamp: BigInt,
  pairContract: FraxSwapPool,
  unitRate: BigDecimal,
  walletAddress: string,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const pairAddress = pairContract._address.toHexString().toLowerCase();
  const tokenBalance = getFraxSwapPairTokenBalance(pairContract, walletAddress, blockNumber);
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

  const pairContract = getFraxSwapPair(pairAddress, blockNumber);
  if (!pairContract || pairContract.totalSupply().equals(BigInt.zero())) {
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
  const unitRate = getFraxSwapPairUnitRate(pairContract, totalValue, blockNumber);

  const wallets = getWalletAddressesForContract(pairAddress);
  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const record = getFraxSwapPairTokenRecord(
      timestamp,
      pairContract,
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
function getBigDecimalFromBalance(
  tokenAddress: string,
  balance: BigInt,
  blockNumber: BigInt,
): BigDecimal {
  const tokenContract = getERC20(tokenAddress, blockNumber);
  if (!tokenContract) {
    throw new Error("Unable to fetch ERC20 at address " + tokenAddress + " for FraxSwap pool");
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
  const pair = getFraxSwapPair(pairAddress, blockNumber);
  if (!pair) {
    return BigDecimal.zero();
  }

  const token0 = pair.token0();
  const token1 = pair.token1();

  if (token0.equals(Address.fromString(tokenAddress))) {
    const token0Balance = pair.getReserves().value0;
    return getBigDecimalFromBalance(tokenAddress, token0Balance, blockNumber);
  } else if (token1.equals(Address.fromString(tokenAddress))) {
    const token1Balance = pair.getReserves().value1;
    return getBigDecimalFromBalance(tokenAddress, token1Balance, blockNumber);
  }

  log.warning(
    "getFraxSwapPairTokenQuantity: Attempted to obtain quantity of token {} from FraxSwap pair {} at block {}, but it was not found",
    [getContractName(tokenAddress), getContractName(pairAddress), blockNumber.toString()],
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

  const pair = getFraxSwapPair(pairAddress, blockNumber);
  if (!pair) return records;

  // Calculate the token quantity for the pool
  const totalQuantity = getFraxSwapPairTokenQuantity(pairAddress, tokenAddress, blockNumber);

  const pairDecimals = pair.decimals();
  log.info(
    "getFraxSwapPairTokenQuantityRecords: FraxSwap pool {} has total quantity {} of token {}",
    [getContractName(pairAddress), totalQuantity.toString(), getContractName(tokenAddress)],
  );
  const pairTotalSupply = toDecimal(pair.totalSupply(), pairDecimals);

  // Grab balances
  const pairBalanceRecords = getFraxSwapPairRecords(
    timestamp,
    pairAddress,
    blockNumber,
    tokenAddress,
  );

  for (let i = 0; i < pairBalanceRecords.length; i++) {
    const record = pairBalanceRecords[i];

    const tokenBalance = totalQuantity.times(record.balance).div(pairTotalSupply);
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
