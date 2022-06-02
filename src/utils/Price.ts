import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import {
  ERC20_STABLE_TOKENS,
  ERC20_WBTC,
  ERC20_WETH,
  getPairHandler,
  PAIR_UNISWAP_V2_ETH_WBTC,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "./Constants";
import { getUniswapV2Pair } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { PairHandlerTypes } from "./PairHandler";

const BIG_DECIMAL_1E8 = BigDecimal.fromString("1e8");
const BIG_DECIMAL_1E9 = BigDecimal.fromString("1e9");
const BIG_DECIMAL_1E10 = BigDecimal.fromString("1e10");
const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

export function getETHUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(PAIR_UNISWAP_V2_USDC_ETH));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        PAIR_UNISWAP_V2_USDC_ETH +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const ethRate = reserve0.div(reserve1).times(BIG_DECIMAL_1E12);
  log.debug("ETH rate {}", [ethRate.toString()]);

  return ethRate;
}

export function getBTCUSDRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(PAIR_UNISWAP_V2_ETH_WBTC));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        PAIR_UNISWAP_V2_ETH_WBTC +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const reserve0 = reserves.value0.toBigDecimal();
  const reserve1 = reserves.value1.toBigDecimal();

  const btcRate = getETHUSDRate().div(reserve0.div(reserve1).times(BIG_DECIMAL_1E10));
  log.debug("BTC rate {}", [btcRate.toString()]);

  return btcRate;
}

export function getOHMUSDRate(block: BigInt): BigDecimal {
  let contractAddress = PAIR_UNISWAP_V2_OHM_DAI;
  if (block.gt(BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK))) {
    contractAddress = PAIR_UNISWAP_V2_OHM_DAI_V2;
  }

  const pair = UniswapV2Pair.bind(Address.fromString(contractAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        contractAddress +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const ohmReserves = reserves.value0.toBigDecimal();
  const daiReserves = reserves.value1.toBigDecimal();

  const ohmRate = daiReserves.div(ohmReserves).div(BIG_DECIMAL_1E9);
  log.debug("OHM rate {}", [ohmRate.toString()]);

  return ohmRate;
}

/**
 * Returns the USD rate of the token represented by {contractAddress}
 *
 * @param contractAddress
 * @param pairAddress
 * @returns
 */
function getUSDRateUniswapV2(contractAddress: string, pairAddress: string): BigDecimal {
  if (contractAddress === ERC20_WETH) return getETHUSDRate();
  if (contractAddress === ERC20_WBTC) return getBTCUSDRate();

  // TODO handle pairs at different blocks
  const pair = UniswapV2Pair.bind(Address.fromString(pairAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  const token0Reserves = pair.getReserves().value0.toBigDecimal();
  const token1Reserves = pair.getReserves().value1.toBigDecimal();

  // Determine orientation of the pair
  // We assume that one of the pair of ETH
  const token0 = pair.token0();
  // Get the number of tokens denominated in ETH
  /**
   * Note: token0.toHexString() ostensibly returns the contract address,
   * but it does not equal {ERC20_WETH} even after trimming.
   */
  const ethBalance = token0.equals(Address.fromString(ERC20_WETH))
    ? token0Reserves.div(token1Reserves)
    : token1Reserves.div(token0Reserves);
  return ethBalance.times(getETHUSDRate());
}

function getUSDRateUniswapV3(contractAddress: string, pairAddress: string): BigDecimal {
  // TODO add support for swapped pair
  const pair = UniswapV3Pair.bind(Address.fromString(pairAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  let priceETH = pair.slot0().value0.times(pair.slot0().value0).toBigDecimal();
  const priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal();
  priceETH = priceETH.div(priceDiv);
  const priceUSD = priceETH.times(getETHUSDRate());

  return priceUSD;
}

/**
 * Determines the USD value of the given token.
 *
 * This is achieved using the prices in liquidity pool pairs.
 *
 * If no pair handler is found, an error will be thrown. This is so
 * that indexing fails in a noticeable manner. The alternative
 * was to return 0, which would be non-obvious and would require
 * parsing the component metrics to identify problems.
 *
 * @param contractAddress the token to look for
 * @returns BigDecimal or 0
 */
export function getUSDRate(contractAddress: string): BigDecimal {
  // Handle stablecoins
  // TODO add support for dynamic price lookup for stablecoins
  if (ERC20_STABLE_TOKENS.includes(contractAddress)) {
    return BigDecimal.fromString("1");
  }

  // Look for the pair
  const pairHandler = getPairHandler(contractAddress);
  if (!pairHandler) {
    throw new Error("Unable to find liquidity pool handler for contract: " + contractAddress);
  }

  if (pairHandler.getHandler() === PairHandlerTypes.UniswapV2) {
    return getUSDRateUniswapV2(contractAddress, pairHandler.getPair());
  }

  if (pairHandler.getHandler() === PairHandlerTypes.UniswapV3) {
    return getUSDRateUniswapV3(contractAddress, pairHandler.getPair());
  }

  throw new Error(
    "Unsupported liquidity pool handler type (" +
      pairHandler.getHandler().toString() +
      ") for contract: " +
      contractAddress,
  );
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
  lpBalance: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  // TODO assumes that the pair is Uniswap V2. What about V3 or balancer?
  const pair = getUniswapV2Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  const total_lp = pair.totalSupply();
  const lp_token_1 = toDecimal(pair.getReserves().value0, 9);
  const lp_token_2 = toDecimal(pair.getReserves().value1, 18);
  const kLast = lp_token_1.times(lp_token_2).truncate(0).digits;

  const part1 = toDecimal(lpBalance, 18).div(toDecimal(total_lp, 18));
  const two = BigInt.fromI32(2);

  const sqrt = kLast.sqrt();
  const part2 = toDecimal(two.times(sqrt), 0);
  const result = part1.times(part2);
  return result;
}

// TODO unused?
export function getDiscountedPairLUSD(lp_amount: BigInt, pair_adress: string): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pair_adress + " does not exist yet.",
    );
  }

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
/**
 * Determines the value of the given balance
 * of a liquidity pool between a token and USD
 * stablecoin.
 *
 * @param lpBalance
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
export function getPairUSD(
  lpBalance: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const pair = getUniswapV2Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  const ohmReserves = pair.getReserves().value0;
  const secondTokenReserves = pair.getReserves().value1;
  const poolTotalSupply = toDecimal(pair.totalSupply(), 18);
  const poolPercentageOwned = toDecimal(lpBalance, 18).div(poolTotalSupply);

  const ohmValue = toDecimal(ohmReserves, 9).times(getOHMUSDRate(blockNumber));

  // Total value in USD is ohmValue + balance of USD stablecoin
  // TODO support for price lookup
  const lpValue = ohmValue.plus(toDecimal(secondTokenReserves, 18));

  return poolPercentageOwned.times(lpValue);
}

// TODO unused?
export function getPairLUSD(lp_amount: BigInt, pair_adress: string, block: BigInt): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pair_adress + " does not exist yet.",
    );
  }

  const total_lp = pair.totalSupply();
  const lp_token_0 = pair.getReserves().value0;
  const lp_token_1 = pair.getReserves().value1;
  const ownedLP = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const ohm_value = toDecimal(lp_token_1, 9).times(getOHMUSDRate(block));
  const total_lp_usd = ohm_value.plus(toDecimal(lp_token_0, 18));

  return ownedLP.times(total_lp_usd);
}

// TODO unused?
export function getPairWETH(lp_amount: BigInt, pair_adress: string, block: BigInt): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(pair_adress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pair_adress + " does not exist yet.",
    );
  }

  const total_lp = pair.totalSupply();
  const lp_token_0 = pair.getReserves().value0;
  const lp_token_1 = pair.getReserves().value1;
  const ownedLP = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18));
  const ohm_value = toDecimal(lp_token_0, 9).times(getOHMUSDRate(block));
  const eth_value = toDecimal(lp_token_1, 18).times(getETHUSDRate());
  const total_lp_usd = ohm_value.plus(eth_value);

  return ownedLP.times(total_lp_usd);
}
