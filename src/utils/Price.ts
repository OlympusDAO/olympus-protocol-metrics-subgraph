import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import {
  SUSHI_CVX_ETH_PAIR,
  SUSHI_OHMDAI_PAIR,
  SUSHI_OHMDAI_PAIRV2,
  SUSHI_OHMDAI_PAIRV2_BLOCK,
  SUSHI_USDC_ETH_PAIR,
  SUSHI_XSUSHI_ETH_PAIR,
  UNI_ETH_WBTC_PAIR,
  UNI_FXS_ETH_PAIR,
  UNI_TRIBE_ETH_PAIR,
} from "./Constants";
import { toDecimal } from "./Decimals";

const BIG_DECIMAL_1E8 = BigDecimal.fromString("1e8");
const BIG_DECIMAL_1E9 = BigDecimal.fromString("1e9");
const BIG_DECIMAL_1E10 = BigDecimal.fromString("1e10");
const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

export function getETHUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(SUSHI_USDC_ETH_PAIR));

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const ethRate = reserve0.div(reserve1).times(BIG_DECIMAL_1E12);
  log.debug("ETH rate {}", [ethRate.toString()]);

  return ethRate;
}

export function getBTCUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(UNI_ETH_WBTC_PAIR));

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const btcRate = getETHUSDRate().div(
    reserve0.div(reserve1).times(BIG_DECIMAL_1E10)
  );
  log.debug("BTC rate {}", [btcRate.toString()]);

  return btcRate;
}

export function getOHMUSDRate(block: BigInt): BigDecimal {
  let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIR));

  if (block.gt(BigInt.fromString(SUSHI_OHMDAI_PAIRV2_BLOCK))) {
    pair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIRV2));
  }

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const ohmRate = reserve1.div(reserve0).div(BIG_DECIMAL_1E9);
  log.debug("OHM rate {}", [ohmRate.toString()]);

  return ohmRate;
}

export function getXsushiUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(SUSHI_XSUSHI_ETH_PAIR));

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const xsushiRate = reserve1.div(reserve0).times(getETHUSDRate());
  log.debug("xsushiRate rate {}", [xsushiRate.toString()]);

  return xsushiRate;
}

export function getTribeUSDRate(): BigDecimal {
  const pair = UniswapV3Pair.bind(Address.fromString(UNI_TRIBE_ETH_PAIR));

  let priceETH = pair
    .slot0()
    .value0.times(pair.slot0().value0)
    .toBigDecimal();
  log.debug("tribe priceETH {}", [priceETH.toString()]);

  const priceDiv = BigInt.fromI32(2)
    .pow(192)
    .toBigDecimal();
  priceETH = priceETH.div(priceDiv);

  const priceUSD = priceETH.times(getETHUSDRate());

  log.debug("tribe rate {}", [priceUSD.toString()]);

  return priceUSD;
}

export function getFXSUSDRate(): BigDecimal {
  const pair = UniswapV3Pair.bind(Address.fromString(UNI_FXS_ETH_PAIR));

  let priceETH = pair
    .slot0()
    .value0.times(pair.slot0().value0)
    .toBigDecimal();
  log.debug("fxs priceETH {}", [priceETH.toString()]);

  const priceDiv = BigInt.fromI32(2)
    .pow(192)
    .toBigDecimal();
  priceETH = priceETH.div(priceDiv);

  const priceUSD = priceETH.times(getETHUSDRate());

  log.debug("fxs rate {}", [priceUSD.toString()]);

  return priceUSD;
}

export function getCVXUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(SUSHI_CVX_ETH_PAIR));

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const xsushiRate = reserve1.div(reserve0).times(getETHUSDRate());
  log.debug("cvx rate {}", [xsushiRate.toString()]);

  return xsushiRate;
}

/**
 * To calculate the risk-free value of an OHM-DAI LP, we assume
 * that DAI = $1 and OHM = $1.
 *
 * The multiple of the quantity of tokens on both sides of the LP
 * remains constant in a Uniswap V2 pool: x * y = k
 *
 * Given this: x1 * y1 = x2 * y2
 *
 * However, if x2 = y2, then: x1 * y1 = x2^2
 *
 * x2 = sqrt(x1 * y1)
 *
 * This tells us the number of DAI (or OHM) tokens required at the
 * position on the constant product curve.
 *
 * If we assume that 1 DAI = 1 OHM, then the value of the entire
 * liquidity pool at RFC is: (1 + 1) * sqrt(# DAI * # OHM)
 *
 * The total value, given the balance, is therefore:
 *
 * (# LP tokens / LP total supply) * (2) * sqrt(# DAI * # OHM)
 *
 * This blog also helps illustrate it: https://olympusdao.medium.com/a-primer-on-oly-bonds-9763f125c124
 */
export function getDiscountedPairUSD(
  lp_amount: BigInt,
  pair_adress: string
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));

  const total_lp = pair.totalSupply();
  const lp_token_1 = toDecimal(pair.getReserves().value0, 9);
  const lp_token_2 = toDecimal(pair.getReserves().value1, 18);
  const kLast = lp_token_1.times(lp_token_2).truncate(0).digits;

  const part1 = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const two = BigInt.fromI32(2);

  const sqrt = kLast.sqrt();
  const part2 = toDecimal(two.times(sqrt), 0);
  const result = part1.times(part2);
  return result;
}

export function getDiscountedPairLUSD(
  lp_amount: BigInt,
  pair_adress: string
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));

  const total_lp = pair.totalSupply();
  const lp_token_1 = toDecimal(pair.getReserves().value0, 18);
  const lp_token_2 = toDecimal(pair.getReserves().value1, 9);
  const kLast = lp_token_1.times(lp_token_2).truncate(0).digits;

  const part1 = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const two = BigInt.fromI32(2);

  const sqrt = kLast.sqrt();
  const part2 = toDecimal(two.times(sqrt), 0);
  const result = part1.times(part2);
  return result;
}

// Percentage of LP supply *
export function getPairUSD(
  lp_amount: BigInt,
  pair_adress: string,
  block: BigInt
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  const total_lp = pair.totalSupply();
  const lp_token_0 = pair.getReserves().value0;
  const lp_token_1 = pair.getReserves().value1;
  const ownedLP = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const ohm_value = toDecimal(lp_token_0, 9).times(getOHMUSDRate(block));
  const total_lp_usd = ohm_value.plus(toDecimal(lp_token_1, 18));

  return ownedLP.times(total_lp_usd);
}

export function getPairLUSD(
  lp_amount: BigInt,
  pair_adress: string,
  block: BigInt
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  const total_lp = pair.totalSupply();
  const lp_token_0 = pair.getReserves().value0;
  const lp_token_1 = pair.getReserves().value1;
  const ownedLP = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const ohm_value = toDecimal(lp_token_1, 9).times(getOHMUSDRate(block));
  const total_lp_usd = ohm_value.plus(toDecimal(lp_token_0, 18));

  return ownedLP.times(total_lp_usd);
}

export function getPairWETH(
  lp_amount: BigInt,
  pair_adress: string,
  block: BigInt
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  const total_lp = pair.totalSupply();
  const lp_token_0 = pair.getReserves().value0;
  const lp_token_1 = pair.getReserves().value1;
  const ownedLP = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const ohm_value = toDecimal(lp_token_0, 9).times(getOHMUSDRate(block));
  const eth_value = toDecimal(lp_token_1, 18).times(getETHUSDRate());
  const total_lp_usd = ohm_value.plus(eth_value);

  return ownedLP.times(total_lp_usd);
}
