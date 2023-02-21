import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20_WETH } from "../utils/Constants";
import { getERC20, getERC20DecimalBalance, getUniswapV3Pair } from "../utils/ContractHelper";
import { getUSDRateUniswapV3 } from "../utils/Price";
import { getBaseEthUsdRate } from "../utils/PriceBase";

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
