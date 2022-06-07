import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import {
  ERC20_OHM,
  ERC20_OHM_V2,
  ERC20_STABLE_TOKENS,
  ERC20_WETH,
  getContractName,
  getPairHandler,
  PAIR_UNISWAP_V2_ETH_WBTC,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "./Constants";
import { getERC20, getUniswapV2Pair, getUniswapV3Pair } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { PairHandlerTypes } from "./PairHandler";

const BIG_DECIMAL_1E8 = BigDecimal.fromString("1e8");
const BIG_DECIMAL_1E9 = BigDecimal.fromString("1e9");
const BIG_DECIMAL_1E10 = BigDecimal.fromString("1e10");
const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

/**
 * One of the base price lookup functions. This has a hard-coded
 * liquidity pool that it uses to determine the price of ETH,
 * relative to the USD.
 *
 * It uses the following basis of liquidity pools:
 *
 * number of token1 * price of token1 = number of token2 * price of token2
 *
 * In the case of a USDC-ETH pair, we know the following:
 * - number of USDC (using getReserves())
 * - number of ETH (using getReserves())
 * - price of USDC (1)
 *
 * Therefore the price of ETH is:
 *
 * number of USDC * 1 / number of ETH = price of ETH
 *
 * @returns Price of ETH in USD
 */
export function getBaseEthUsdRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(PAIR_UNISWAP_V2_USDC_ETH));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        PAIR_UNISWAP_V2_USDC_ETH +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const usdReserves = reserves.value0.toBigDecimal();
  const ethReserves = reserves.value1.toBigDecimal();

  const ethRate = usdReserves.div(ethReserves).times(BIG_DECIMAL_1E12);
  log.debug("ETH rate {}", [ethRate.toString()]);

  return ethRate;
}

/**
 * One of the base price lookup functions. This has a hard-coded
 * liquidity pool that it uses to determine the price of OHM,
 * relative to USD.
 *
 * It uses the following basis of liquidity pools:
 *
 * number of token1 * price of token1 = number of token2 * price of token2
 *
 * In the case of a DAI-OHM pair, we know the following:
 * - number of DAI (using getReserves())
 * - number of OHM (using getReserves())
 * - price of DAI (1)
 *
 * Therefore the price of OHM is:
 *
 * number of DAI * 1 / number of OHM = price of OHM
 *
 * @returns Price of OHM in USD
 */
export function getBaseOhmUsdRate(block: BigInt): BigDecimal {
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

// eslint-disable-next-line no-shadow
export enum PairTokenBaseOrientation {
  TOKEN0,
  TOKEN1,
  UNKNOWN,
}

/**
 * Determines whether token0 or token1 of a pair is the base (wETH/OHM) token.
 *
 * @param token0
 * @param token1
 * @returns
 */
export function getBaseTokenOrientation(
  token0: Address,
  token1: Address,
): PairTokenBaseOrientation {
  /**
   * Note: token0.toHexString() ostensibly returns the contract address,
   * but it does not equal {ERC20_WETH} even after trimming. So we use Address.
   */
  const wethAddress = Address.fromString(ERC20_WETH);
  const ohmV1Address = Address.fromString(ERC20_OHM);
  const ohmV2Address = Address.fromString(ERC20_OHM_V2);
  // TODO what if the pair is OHM-ETH or ETH-OHM?

  if (token0.equals(wethAddress) || token0.equals(ohmV1Address) || token0.equals(ohmV2Address)) {
    return PairTokenBaseOrientation.TOKEN0;
  }

  if (token1.equals(wethAddress) || token1.equals(ohmV1Address) || token1.equals(ohmV2Address)) {
    return PairTokenBaseOrientation.TOKEN1;
  }

  return PairTokenBaseOrientation.UNKNOWN;
}

/**
 * Gets the USD value of the base token, as identified by {orientation}.
 *
 * This enables pairs to have ETH or OHM as the base token.
 *
 * @param token0
 * @param token1
 * @param orientation
 * @param blockNumber
 * @returns
 */
export function getBaseTokenUSDRate(
  token0: Address,
  token1: Address,
  orientation: PairTokenBaseOrientation,
  blockNumber: BigInt,
): BigDecimal {
  if (orientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "Unsure how to deal with unknown token base orientation for tokens " +
        token0.toHexString() +
        ", " +
        token1.toHexString(),
    );
  }

  const baseToken = orientation === PairTokenBaseOrientation.TOKEN0 ? token0 : token1;

  const ohmV1Address = Address.fromString(ERC20_OHM);
  const ohmV2Address = Address.fromString(ERC20_OHM_V2);
  if (baseToken.equals(ohmV1Address) || baseToken.equals(ohmV2Address)) {
    log.debug("Returning OHM", []);
    return getBaseOhmUsdRate(blockNumber);
  }

  // Otherwise, ETH
  log.debug("Returning ETH", []);
  return getBaseEthUsdRate();
}

/**
 * Returns the USD rate of the token represented by {contractAddress},
 * given the UniswapV2 pair {pairAddress}.
 *
 * This will dynamically determine which of the pair tokens is the base
 * token (wETH or OHM).
 *
 * After the base token has been determined, the following formula is used
 * to determine the USD rate of the other token.
 *
 * e.g. taking the ETH-TRIBE pair:
 * TRIBE balance = 40,537.42936106
 * ETH balance = 4.99923661
 *
 * (ETH balance / TRIBE balance) * (ETH price) = TRIBE price
 * (4.99923661 / 40537.42936106) * 2000 = 0.24
 *
 * TODO: mention p1 * q1 = p2 * q2
 *
 * @param contractAddress
 * @param pairAddress
 * @returns
 */
function getUSDRateUniswapV2(
  contractAddress: string,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  if (Address.fromString(contractAddress).equals(Address.fromString(ERC20_WETH))) {
    log.debug("Returning base ETH-USD rate", []);
    return getBaseEthUsdRate();
  }
  if (
    Address.fromString(contractAddress).equals(Address.fromString(ERC20_OHM)) ||
    Address.fromString(contractAddress).equals(Address.fromString(ERC20_OHM_V2))
  ) {
    log.debug("Returning base OHM-USD rate", []);
    return getBaseOhmUsdRate(blockNumber);
  }

  // TODO check if we are ready to lookup using one of the base (OHM/ETH) rates
  // TODO handle OHM v1 rates?

  // TODO handle pairs at different blocks
  const pair = UniswapV2Pair.bind(Address.fromString(pairAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  // Determine orientation of the pair
  const token0 = pair.token0();
  const token1 = pair.token1();
  const baseTokenOrientation = getBaseTokenOrientation(token0, token1);
  if (baseTokenOrientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "Unsure how to deal with unknown token base orientation for pair " + pairAddress,
    );
  }

  const token0Contract = getERC20(
    getContractName(token0.toHexString()),
    token0.toHexString(),
    blockNumber,
  );
  if (!token0Contract) {
    throw new Error("Unable to find ERC20 contract for " + token0.toHexString());
  }

  const token1Contract = getERC20(
    getContractName(token1.toHexString()),
    token1.toHexString(),
    blockNumber,
  );
  if (!token1Contract) {
    throw new Error("Unable to find ERC20 contract for " + token1.toHexString());
  }

  const token0Reserves = toDecimal(pair.getReserves().value0, token0Contract.decimals());
  const token1Reserves = toDecimal(pair.getReserves().value1, token1Contract.decimals());
  // Get the number of tokens denominated in ETH/OHM
  const baseTokenNumerator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token0Reserves.div(token1Reserves)
      : token1Reserves.div(token0Reserves);

  const baseTokenUsdRate = getBaseTokenUSDRate(token0, token1, baseTokenOrientation, blockNumber);
  log.debug("baseTokenUsdRate = {}", [baseTokenUsdRate.toString()]);

  return baseTokenNumerator.times(baseTokenUsdRate);
}

function getUSDRateUniswapV3(contractAddress: string, pairAddress: string): BigDecimal {
  // TODO add support for swapped pair
  const pair = UniswapV3Pair.bind(Address.fromString(pairAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  // slot0 = "The current price of the pool as a sqrt(token1/token0) Q64.96 value"
  // Source: https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0
  // https://docs.uniswap.org/sdk/guides/fetching-prices
  let priceETH = pair.slot0().value0.times(pair.slot0().value0).toBigDecimal();
  const priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal();
  priceETH = priceETH.div(priceDiv);
  const priceUSD = priceETH.times(getBaseEthUsdRate());

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
export function getUSDRate(contractAddress: string, blockNumber: BigInt): BigDecimal {
  // Handle stablecoins
  // TODO add support for dynamic price lookup for stablecoins
  if (ERC20_STABLE_TOKENS.includes(contractAddress)) {
    return BigDecimal.fromString("1");
  }

  // Handle OHM V1 and V2
  if ([ERC20_OHM, ERC20_OHM_V2].includes(contractAddress)) {
    return getBaseOhmUsdRate(blockNumber);
  }

  // Look for the pair
  const pairHandler = getPairHandler(contractAddress);
  if (!pairHandler) {
    throw new Error("Unable to find liquidity pool handler for contract: " + contractAddress);
  }

  if (pairHandler.getHandler() === PairHandlerTypes.UniswapV2) {
    return getUSDRateUniswapV2(contractAddress, pairHandler.getPair(), blockNumber);
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
export function getOhmUSDPairRiskFreeValue(
  lpBalance: BigInt,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  // TODO assumes that the pair is Uniswap V2. What about V3 or balancer?
  // TODO assumes part of the pair is a stablecoin
  // TODO abstract out for ANY pair
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
  log.debug("OHM-DAI risk-free value is {}", [result.toString()]);
  return result;
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
  log.debug("token0: {}", [token0]);
  const token0Contract = getERC20(getContractName(token0), token0, blockNumber);
  if (!token0Contract) {
    throw new Error("Unable to find ERC20 contract for " + token0);
  }

  const token0Reserves = toDecimal(
    token0Contract.balanceOf(Address.fromString(pairAddress)),
    token0Contract.decimals(),
  );
  const token0Rate = getUSDRateUniswapV3(token0, pairAddress);
  const token0Value = token0Reserves.times(token0Rate);
  log.debug("token0: reserves = {}, rate = {}, value: {}", [
    token0Reserves.toString(),
    token0Rate.toString(),
    token0Value.toString(),
  ]);

  // Determine token1 value
  const token1 = pair.token1().toHexString();
  log.debug("token1: {}", [token1]);
  const token1Contract = getERC20(getContractName(token1), token1, blockNumber);
  if (!token1Contract) {
    throw new Error("Unable to find ERC20 contract for " + token1);
  }

  const token1Reserves = toDecimal(
    token1Contract.balanceOf(Address.fromString(pairAddress)),
    token1Contract.decimals(),
  );
  const token1Rate = getUSDRateUniswapV3(token1, pairAddress);
  const token1Value = token1Reserves.times(token1Rate);
  log.debug("token1: reserves = {}, rate = {}, value: {}", [
    token1Reserves.toString(),
    token1Rate.toString(),
    token1Value.toString(),
  ]);

  const pairValue = token0Value.plus(token1Value);
  log.debug("UniswapV3 pair value for contract {} is: {}", [pairAddress, pairValue.toString()]);
  return pairValue;
}

/**
 * Determines the value of the given balance of a liquidity pool.
 *
 * This is equivalent to: pair total value * ({pair balance} / total supply of pair)
 *
 * Note: unsure how to implement this, as there doesn't appear to be a way to obtain the
 * total supply of the pair from the contract. Can (FXS|WETH).balanceOf(pairAddress) be used
 * to determine/approximate this?
 *
 * @param lpBalance
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
// export function getUniswapV3PairValue(
//   lpBalance: BigInt,
//   pairAddress: string,
//   blockNumber: BigInt,
// ): BigDecimal {
//   const pair = getUniswapV3Pair(pairAddress, blockNumber);
//   if (!pair) {
//     throw new Error(
//       "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
//     );
//   }

//   const lpValue = getUniswapV3PairTotalValue(pairAddress, blockNumber);
//   const poolTotalSupply = toDecimal(pair.totalSupply(), 18);
//   const poolPercentageOwned = toDecimal(lpBalance, 18).div(poolTotalSupply);

//   return poolPercentageOwned.times(lpValue);
// }

export function getUniswapV2PairTotalValue(pairAddress: string, blockNumber: BigInt): BigDecimal {
  const pair = getUniswapV2Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  // Determine token0 value
  const token0 = pair.token0().toHexString();
  log.debug("token0: {}", [token0]);
  const token0Contract = getERC20(getContractName(token0), token0, blockNumber);
  if (!token0Contract) {
    throw new Error("Unable to find ERC20 contract for " + token0);
  }

  const token0Reserves = toDecimal(pair.getReserves().value0, token0Contract.decimals());
  const token0Rate = getUSDRateUniswapV2(token0, pairAddress, blockNumber);
  const token0Value = token0Reserves.times(token0Rate);
  log.debug("token0: reserves = {}, rate = {}, value: {}", [
    token0Reserves.toString(),
    token0Rate.toString(),
    token0Value.toString(),
  ]);

  // Determine token1 value
  const token1 = pair.token1().toHexString();
  log.debug("token1: {}", [token1]);
  const token1Contract = getERC20(getContractName(token1), token1, blockNumber);
  if (!token1Contract) {
    throw new Error("Unable to find ERC20 contract for " + token1);
  }

  const token1Reserves = toDecimal(pair.getReserves().value1, token1Contract.decimals());
  const token1Rate = getUSDRateUniswapV2(token1, pairAddress, blockNumber);
  const token1Value = token1Reserves.times(token1Rate);
  log.debug("token1: reserves = {}, rate = {}, value: {}", [
    token1Reserves.toString(),
    token1Rate.toString(),
    token1Value.toString(),
  ]);

  const totalValue = token0Value.plus(token1Value);
  log.debug("Total value of pair {} is {}", [pairAddress, totalValue.toString()]);
  return totalValue;
}

/**
 * Determines the value of the given balance
 * of a liquidity pool.
 *
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
  const pair = getUniswapV2Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  const lpValue = getUniswapV2PairTotalValue(pairAddress, blockNumber);
  const poolTotalSupply = toDecimal(pair.totalSupply(), 18);
  const poolPercentageOwned = toDecimal(lpBalance, 18).div(poolTotalSupply);

  return poolPercentageOwned.times(lpValue);
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

  const ohmValue = toDecimal(ohmReserves, 9).times(getBaseOhmUsdRate(blockNumber));

  // Total value in USD is ohmValue + balance of USD stablecoin
  // TODO support for price lookup
  const lpValue = ohmValue.plus(toDecimal(secondTokenReserves, 18));

  return poolPercentageOwned.times(lpValue);
}
