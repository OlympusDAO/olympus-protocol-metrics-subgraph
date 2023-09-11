import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { BLOCKCHAIN, ERC20_OHM_V2, ERC20_TOKENS, ERC20_WETH, getContractName, getWalletAddressesForContract, liquidityPairHasToken } from "../utils/Constants";
import { getERC20, getERC20DecimalBalance, getUniswapV3Pair } from "../utils/ContractHelper";
import { getUSDRate, getUSDRateUniswapV3 } from "../utils/Price";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { getERC20Decimals } from "../contracts/ERC20";
import { UniswapV3PositionManager } from "../../generated/ProtocolMetrics/UniswapV3PositionManager";
import { createOrUpdateTokenRecord } from "../../../shared/src/utils/TokenRecordHelper";
import { getBaseEthUsdRate } from "../utils/PriceBase";

export const UNISWAP_V3_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const Q96 = BigInt.fromI32(2).pow(96);

function getTickAtSqrtRatio(sqrtPriceX96: BigInt): f64 {
  const tick: f64 = Math.floor(Math.log(f64(sqrtPriceX96.div(Q96).pow(2).toU64())) / Math.log(1.0001));
  return tick;
}

function getSqrtRatioAtTick(tick: number): BigInt {
  const sqrtRatio = BigInt.fromU64(u64(sqrt(1.0001 ** tick)));
  log.debug("getSqrtRatioAtTick: sqrtRatio: {}", [sqrtRatio.toString()]);

  return sqrtRatio.times(BigInt.fromU64(2).pow(96));
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
      "getUniswapV3PairRecords: Skipping UniswapV3 pair that does not match specified token address {}",
      [tokenAddress],
    );
    return records;
  }

  // For the given pairAddress, determine the addresses of the tokens
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    return records;
  }

  const sqrtPriceX96 = pair.slot0().getSqrtPriceX96();

  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  if (token0Result.reverted || token1Result.reverted) {
    return records;
  }

  const wallets = getWalletAddressesForContract(pairAddress);
  const positionManager = UniswapV3PositionManager.bind(Address.fromString(UNISWAP_V3_POSITION_MANAGER));

  for (let i = 0; i < wallets.length; i++) {
    const walletAddress = wallets[i];

    const positionCount = positionManager.balanceOf(Address.fromString(walletAddress));
    for (let j: u32 = 0; j < positionCount.toU32(); j++) {
      const positionId = positionManager.tokenOfOwnerByIndex(Address.fromString(walletAddress), BigInt.fromU32(j));
      log.debug("getUniswapV3PairRecords: positionId: {}", [positionId.toString()]);
      const position = positionManager.positions(positionId);

      const token0 = position.getToken0();
      const token1 = position.getToken1();

      // Check that the position is for the pair we are looking for
      if (!token0.equals(token0Result.value) || !token1.equals(token1Result.value)) {
        log.debug("getUniswapV3PairRecords: Skipping position that does not match tokens in pair address {}", [pairAddress])
        continue;
      }

      // If a position has no liquidity, we don't want to record details
      const liquidity: BigInt = position.getLiquidity();
      if (liquidity.equals(BigInt.zero())) {
        continue;
      }

      const tickLower = position.getTickLower();
      log.debug("getUniswapV3PairRecords: tickLower: {}", [tickLower.toString()]);
      const sqrtRatioA: BigInt = getSqrtRatioAtTick(tickLower);
      log.debug("getUniswapV3PairRecords: sqrtRatioA: {}", [sqrtRatioA.toString()]);

      const tickUpper = position.getTickUpper();
      log.debug("getUniswapV3PairRecords: tickUpper: {}", [tickUpper.toString()]);
      const sqrtRatioB: BigInt = getSqrtRatioAtTick(tickUpper);
      log.debug("getUniswapV3PairRecords: sqrtRatioB: {}", [sqrtRatioB.toString()]);

      const currentTick = getTickAtSqrtRatio(sqrtPriceX96);
      const sqrtPrice: BigInt = sqrtPriceX96.div(Q96);
      log.debug("getUniswapV3PairRecords: sqrtPrice: {}", [sqrtPrice.toString()]);

      let token0Amount: BigInt = BigInt.zero();
      let token1Amount: BigInt = BigInt.zero();

      // Get the balances of each token
      // Source: https://ethereum.stackexchange.com/a/140264
      if (currentTick <= tickLower) {
        log.debug("getUniswapV3PairRecords: currentTick <= tickLower", []);
        token0Amount = liquidity.times(sqrtRatioB.minus(sqrtRatioA).div(sqrtRatioA.times(sqrtRatioB)));
      }
      else if (currentTick > tickUpper) {
        log.debug("getUniswapV3PairRecords: currentTick > tickUpper", []);
        token1Amount = liquidity.times(sqrtRatioB.minus(sqrtRatioA));
      }
      else {
        log.debug("getUniswapV3PairRecords: currentTick > tickLower && currentTick <= tickUpper", []);
        token0Amount = liquidity.times(sqrtRatioB.minus(sqrtPrice).div(sqrtPrice.times(sqrtRatioB)));
        token1Amount = liquidity.times(sqrtPrice.minus(sqrtRatioA));
      }

      const token0Decimals = getERC20Decimals(token0.toHexString(), blockNumber);
      const token1Decimals = getERC20Decimals(token1.toHexString(), blockNumber);

      const token0Balance = toDecimal(token0Amount, token0Decimals);
      const token1Balance = toDecimal(token1Amount, token1Decimals);

      // Get the prices
      const token0Price = getUSDRate(token0.toHexString(), blockNumber);
      const token1Price = getUSDRate(token1.toHexString(), blockNumber);

      const token0Value = token0Balance.times(token0Price);
      const token1Value = token1Balance.times(token1Price);

      const totalValue = token0Value.plus(token1Value);

      const token0IncludedValue = token0.equals(Address.fromString(ERC20_OHM_V2)) ? BigDecimal.fromString("0") : token0Value;
      const token1IncludedValue = token1.equals(Address.fromString(ERC20_OHM_V2)) ? BigDecimal.fromString("0") : token1Value;
      const includedValue = token0IncludedValue.plus(token1IncludedValue);
      const multiplier = includedValue.div(totalValue);

      records.push(createOrUpdateTokenRecord(
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
      ));
    }
  }

  return records;
}

export function getUniswapV3PairTotalValue(pairAddress: string, blockNumber: BigInt): BigDecimal {
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  // Determine token0 value
  const token0 = pair.token0().toHexString();
  log.debug("getUniswapV3PairTotalValue: token0: {}", [token0]);
  const token0Contract = getERC20(token0, blockNumber);
  if (!token0Contract) {
    throw new Error("Unable to find ERC20 contract for " + token0);
  }

  const token0Reserves = getERC20DecimalBalance(token0, pairAddress, blockNumber);
  const token0Rate = getUSDRateUniswapV3(token0, pairAddress, blockNumber);
  const token0Value = token0Reserves.times(token0Rate);
  log.debug("getUniswapV3PairTotalValue: token0: reserves = {}, rate = {}, value: {}", [
    token0Reserves.toString(),
    token0Rate.toString(),
    token0Value.toString(),
  ]);

  // Determine token1 value
  const token1 = pair.token1().toHexString();
  log.debug("getUniswapV3PairTotalValue: token1: {}", [token1]);
  const token1Contract = getERC20(token1, blockNumber);
  if (!token1Contract) {
    throw new Error("Unable to find ERC20 contract for " + token1);
  }

  const token1Reserves = getERC20DecimalBalance(token1, pairAddress, blockNumber);
  // Cheating, a little bit
  const token1Rate = Address.fromString(token1).equals(Address.fromString(ERC20_WETH))
    ? getBaseEthUsdRate()
    : getUSDRateUniswapV3(token1, pairAddress, blockNumber);
  const token1Value = token1Reserves.times(token1Rate);
  log.debug("getUniswapV3PairTotalValue: token1: reserves = {}, rate = {}, value: {}", [
    token1Reserves.toString(),
    token1Rate.toString(),
    token1Value.toString(),
  ]);

  const pairValue = token0Value.plus(token1Value);
  log.debug("getUniswapV3PairTotalValue: UniswapV3 pair value for contract {} is: {}", [
    pairAddress,
    pairValue.toString(),
  ]);
  return pairValue;
}
