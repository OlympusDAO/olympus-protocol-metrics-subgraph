import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord, TokenSupply } from "../../../shared/generated/schema";
import { BLOCKCHAIN, ERC20_OHM_V2, ERC20_TOKENS, getContractName, liquidityPairHasToken } from "../utils/Constants";
import { getERC20DecimalBalance, getUniswapV3Pair } from "../utils/ContractHelper";
import { getUSDRate } from "../utils/Price";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { getERC20Decimals } from "../contracts/ERC20";
import { UniswapV3PositionManager } from "../../generated/ProtocolMetrics/UniswapV3PositionManager";
import { createTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { TYPE_LIQUIDITY, createTokenSupply } from "../../../shared/src/utils/TokenSupplyHelper";
import { TokenCategoryPOL } from "../../../shared/src/contracts/TokenDefinition";
import { getWalletAddressesForContract } from "../utils/ProtocolAddresses";

export const UNISWAP_V3_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const Q96 = BigInt.fromI32(2).pow(96);

function min(a: BigInt, b: BigInt): BigInt {
  return a.lt(b) ? a : b;
}

function max(a: BigInt, b: BigInt): BigInt {
  return a.gt(b) ? a : b;
}

function getToken0Amount(liquidity: BigInt, sqrtPrice: BigInt, sqrtRatioA: BigInt, sqrtRatioB: BigInt): BigInt {
  const newSqrtPrice = max(min(sqrtPrice, sqrtRatioB), sqrtRatioA);

  return liquidity.times(sqrtRatioB.minus(newSqrtPrice)).div(newSqrtPrice.times(sqrtRatioB));
}

function getToken1Amount(liquidity: BigInt, sqrtPrice: BigInt, sqrtRatioA: BigInt, sqrtRatioB: BigInt): BigInt {
  const newSqrtPrice = max(min(sqrtPrice, sqrtRatioB), sqrtRatioA);

  return liquidity.times(newSqrtPrice.minus(sqrtRatioA));
}

function getSqrtRatioAtTick(tick: number): BigInt {
  const sqrtRatio = BigInt.fromU64(u64(sqrt(1.0001 ** tick)));
  log.debug("getSqrtRatioAtTick: sqrtRatio: {}", [sqrtRatio.toString()]);

  return sqrtRatio;
}

function getPairBalances(pairAddress: string, positionId: BigInt, blockNumber: BigInt): BigDecimal[] | null {
  // Pair
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    return null;
  }

  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  if (token0Result.reverted || token1Result.reverted) {
    log.debug("getPairBalances: Skipping UniswapV3 pair {} ({}) as token calls reverted", [pairAddress, getContractName(pairAddress)]);
    return null;
  }

  const sqrtPriceX96 = pair.slot0().getSqrtPriceX96();
  log.debug("getPairBalances: sqrtPriceX96: {}", [sqrtPriceX96.toString()]);
  const currentTick = pair.slot0().getTick();
  log.debug("getPairBalances: currentTick: {}", [currentTick.toString()]);

  // Position
  const positionManager = UniswapV3PositionManager.bind(Address.fromString(UNISWAP_V3_POSITION_MANAGER));
  log.debug("getPairBalances: positionId: {}", [positionId.toString()]);
  const position = positionManager.positions(positionId);
  const token0 = position.getToken0();
  const token1 = position.getToken1();

  // Check that the position is for the pair we are looking for
  if (!token0.equals(token0Result.value) || !token1.equals(token1Result.value)) {
    log.debug("getPairBalances: Skipping position {} that does not match tokens in pair address {}", [positionId.toString(), pairAddress])
    return null;
  }

  // Ticks
  const tickLower = position.getTickLower();
  log.debug("getPairBalances: tickLower: {}", [tickLower.toString()]);
  const sqrtRatioA: BigInt = getSqrtRatioAtTick(tickLower);
  log.debug("getPairBalances: sqrtRatioA: {}", [sqrtRatioA.toString()]);

  const tickUpper = position.getTickUpper();
  log.debug("getUniswapV3PairRecords: tickUpper: {}", [tickUpper.toString()]);
  const sqrtRatioB: BigInt = getSqrtRatioAtTick(tickUpper);
  log.debug("getUniswapV3PairRecords: sqrtRatioB: {}", [sqrtRatioB.toString()]);

  // If a position has no liquidity, we don't want to record details
  const liquidity: BigInt = position.getLiquidity();
  if (liquidity.equals(BigInt.zero())) {
    log.debug("getPairBalances: Skipping position with zero liquidity", []);
    return null;
  }
  log.debug("getPairBalances: liquidity: {}", [liquidity.toString()]);

  const sqrtPrice: BigInt = sqrtPriceX96.div(Q96);
  log.debug("getPairBalances: sqrtPrice: {}", [sqrtPrice.toString()]);

  const token0Amount: BigInt = getToken0Amount(liquidity, sqrtPrice, sqrtRatioA, sqrtRatioB);
  const token1Amount: BigInt = getToken1Amount(liquidity, sqrtPrice, sqrtRatioA, sqrtRatioB);

  const token0Decimals = getERC20Decimals(token0.toHexString(), blockNumber);
  const token1Decimals = getERC20Decimals(token1.toHexString(), blockNumber);

  const token0Balance = toDecimal(token0Amount, token0Decimals);
  const token1Balance = toDecimal(token1Amount, token1Decimals);
  log.debug("getPairBalances: token0Balance: {}, token1Balance: {}", [token0Balance.toString(), token1Balance.toString()]);

  return [token0Balance, token1Balance];
}

/**
 * Returns the records for the specified UniswapV3 LP.
 *
 * @param metricName
 * @param pairAddress the address of the UniswapV3 pair
 * @param tokenAddress restrict results to match the specified tokenbe excluded
 * @param blockNumber the current block number
 * @returns
 */
export function getUniswapV3POLRecords(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string | null,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug(
      "getUniswapV3POLRecords: Skipping UniswapV3 pair that does not match specified token address {}",
      [tokenAddress],
    );
    return records;
  }

  // For the given pairAddress, determine the addresses of the tokens
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    return records;
  }

  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  if (token0Result.reverted || token1Result.reverted) {
    log.debug("getUniswapV3POLRecords: Skipping UniswapV3 pair {} ({}) as token calls reverted", [pairAddress, getContractName(pairAddress)]);
    return records;
  }

  const wallets = getWalletAddressesForContract(pairAddress);
  const positionManager = UniswapV3PositionManager.bind(Address.fromString(UNISWAP_V3_POSITION_MANAGER));

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const positionCount = positionManager.balanceOf(Address.fromString(walletAddress));
    log.debug("getUniswapV3POLRecords: wallet {} ({}) position count: {}", [walletAddress, getContractName(walletAddress), positionCount.toString()]);
    for (let j: u32 = 0; j < positionCount.toU32(); j++) {
      const positionId = positionManager.tokenOfOwnerByIndex(Address.fromString(walletAddress), BigInt.fromU32(j));
      log.debug("getUniswapV3POLRecords: positionId: {}", [positionId.toString()]);

      const balances = getPairBalances(pairAddress, positionId, blockNumber);
      if (!balances) {
        continue;
      }

      const token0Balance = balances[0];
      const token1Balance = balances[1];
      log.debug("getUniswapV3POLRecords: token0Balance: {}, token1Balance: {}", [token0Balance.toString(), token1Balance.toString()]);

      // Get the prices
      const token0Price = getUSDRate(token0Result.value.toHexString(), blockNumber);
      const token1Price = getUSDRate(token1Result.value.toHexString(), blockNumber);

      const token0Value = token0Balance.times(token0Price);
      const token1Value = token1Balance.times(token1Price);

      const totalValue = token0Value.plus(token1Value);
      log.debug("getUniswapV3POLRecords: totalValue: {}", [totalValue.toString()]);

      const token0IncludedValue = token0Result.value.equals(Address.fromString(ERC20_OHM_V2)) ? BigDecimal.fromString("0") : token0Value;
      const token1IncludedValue = token1Result.value.equals(Address.fromString(ERC20_OHM_V2)) ? BigDecimal.fromString("0") : token1Value;
      const includedValue = token0IncludedValue.plus(token1IncludedValue);
      const multiplier = includedValue.div(totalValue);
      log.debug("getUniswapV3POLRecords: multiplier: {}", [multiplier.toString()]);

      records.push(
        createTokenRecord(
          timestamp,
          getContractName(pairAddress),
          pairAddress,
          getContractName(walletAddress),
          walletAddress,
          totalValue,
          BigDecimal.fromString("1"),
          blockNumber,
          true,
          ERC20_TOKENS,
          BLOCKCHAIN,
          multiplier,
          TokenCategoryPOL,
        )
      );
    }
  }

  return records;
}

/**
 * The TVL of a UniswapV3 pool.
 * 
 * To avoid circular dependencies, this CANNOT be used by getUniswapV3OhmSupply or getUniswapV3POLRecords
 * 
 * @param pairAddress 
 * @param excludeOhmValue 
 * @param blockNumber 
 * @returns 
 */
export function getUniswapV3PairTotalValue(pairAddress: string, excludeOhmValue: boolean, blockNumber: BigInt): BigDecimal {
  log.info("getUniswapV3PairTotalValue: Calculating total value of pair {} ({}). excludeOhmValue? {}", [getContractName(pairAddress), pairAddress, excludeOhmValue.toString()]);

  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    log.warning(
      "getUniswapV3PairTotalValue: Cannot determine total value as the UniswapV3 pool {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  if (token0Result.reverted || token1Result.reverted) {
    log.warning(
      "getUniswapV3PairTotalValue: Cannot determine total value as the UniswapV3 pool {} does not exist yet",
      [getContractName(pairAddress)],
    );
    return BigDecimal.zero();
  }

  const poolTokens = [token0Result.value.toHexString(), token1Result.value.toHexString()];
  let totalValue = BigDecimal.zero();

  for (let i = 0; i < poolTokens.length; i++) {
    const currentToken = poolTokens[i];
    log.debug("getUniswapV3PairTotalValue: Checking token {}", [getContractName(currentToken)]);

    // Skip if OHM is excluded
    if (excludeOhmValue && currentToken.toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      log.debug("getUniswapV3PairTotalValue: Skipping OHM value for pair {}, as excludeOhmValue is true", [getContractName(pairAddress)]);
      continue;
    }

    const currentBalance = getERC20DecimalBalance(currentToken, pairAddress, blockNumber);
    log.debug("getUniswapV3PairTotalValue: balance of token {} is {}", [getContractName(currentToken), currentBalance.toString()]);
    const currentRate = getUSDRate(currentToken, blockNumber);
    const currentValue = currentBalance.times(currentRate);
    log.debug("getUniswapV3PairTotalValue: value of token {} in pair is {}", [getContractName(currentToken), currentValue.toString()]);
    totalValue = totalValue.plus(currentValue);
  }

  log.info("getUniswapV3PairTotalValue: Total value of pair {} is {}. excludeOhmValue? {}", [
    getContractName(pairAddress),
    totalValue.toString(),
    excludeOhmValue.toString(),
  ]);
  return totalValue;
}

export function getUniswapV3OhmSupply(
  timestamp: BigInt,
  pairAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenSupply[] {
  const records: TokenSupply[] = [];

  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !liquidityPairHasToken(pairAddress, tokenAddress)) {
    log.debug(
      "getUniswapV3OhmSupply: Skipping UniswapV3 pair that does not match specified token address {}",
      [tokenAddress],
    );
    return records;
  }

  // For the given pairAddress, determine the addresses of the tokens
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    return records;
  }

  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  if (token0Result.reverted || token1Result.reverted) {
    return records;
  }

  const token0 = token0Result.value.toHexString();
  const token1 = token1Result.value.toHexString();

  // Get the OHM index
  if (token0.toLowerCase() != tokenAddress.toLowerCase() && token1.toLowerCase() != tokenAddress.toLowerCase()) {
    return records;
  }

  const ohmIndex: u32 = token0.toLowerCase() == tokenAddress.toLowerCase() ? 0 : 1;

  const wallets = getWalletAddressesForContract(pairAddress);
  const positionManager = UniswapV3PositionManager.bind(Address.fromString(UNISWAP_V3_POSITION_MANAGER));

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const positionCount = positionManager.balanceOf(Address.fromString(walletAddress));
    for (let j: u32 = 0; j < positionCount.toU32(); j++) {
      const positionId = positionManager.tokenOfOwnerByIndex(Address.fromString(walletAddress), BigInt.fromU32(j));
      log.debug("getUniswapV3PairRecords: positionId: {}", [positionId.toString()]);

      const balances = getPairBalances(pairAddress, positionId, blockNumber);
      if (!balances) {
        continue;
      }

      const ohmBalance = balances[ohmIndex];

      records.push(
        createTokenSupply(
          timestamp,
          getContractName(tokenAddress),
          tokenAddress,
          getContractName(pairAddress),
          pairAddress,
          getContractName(walletAddress),
          walletAddress,
          TYPE_LIQUIDITY,
          ohmBalance,
          blockNumber,
          -1,
        )
      );
    }
  }

  return records;
}