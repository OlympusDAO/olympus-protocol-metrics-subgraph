/**
 * This module contains functions to lookup the price (in USD) of base tokens (e.g. USD, ETH),
 * in which all liquidity pools are denominated.
 *
 * Functions in this module should minimise dependencies on other modules.
 */

import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenCategoryStable } from "../../../shared/src/contracts/TokenDefinition";
import { isTokenAddressInCategory } from "../../../shared/src/utils/TokenRecordHelper";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { ERC20_TOKENS, ERC20_WETH, PAIR_UNISWAP_V2_USDC_ETH } from "./Constants";
import { getContractName } from "./Constants";

const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

// eslint-disable-next-line no-shadow
export enum PairTokenBaseOrientation {
  TOKEN0,
  TOKEN1,
  UNKNOWN,
}

export const BASE_TOKEN_UNKNOWN = -1;

/**
 * Determines whether token0 or token1 of a pair is the base (wETH/USD) token.
 */
export function getBaseTokenIndex(
  addresses: Address[],
): i32 {
  for (let i = 0; i < addresses.length; i++) {
    const currentToken = addresses[i];

    // As we are ultimately trying to get to a USD-denominated rate,
    // check for USD stablecoins first
    if (isTokenAddressInCategory(currentToken.toHexString(), TokenCategoryStable, ERC20_TOKENS)) {
      return i;
    }

    // Now check secondary base tokens: ETH
    if (currentToken.toHexString().toLowerCase() == ERC20_WETH.toLowerCase()) {
      return i
    }
  }

  return BASE_TOKEN_UNKNOWN;
}

/**
 * Determines whether token0 or token1 of a pair is the base (wETH/USD) token.
 *
 * @param token0
 * @param token1
 * @returns
 */
export function getBaseTokenOrientation(
  token0: Address,
  token1: Address,
): PairTokenBaseOrientation {
  // As we are ultimately trying to get to a USD-denominated rate,
  // check for USD stablecoins first
  if (isTokenAddressInCategory(token0.toHexString(), TokenCategoryStable, ERC20_TOKENS)) {
    return PairTokenBaseOrientation.TOKEN0;
  }

  if (isTokenAddressInCategory(token1.toHexString(), TokenCategoryStable, ERC20_TOKENS)) {
    return PairTokenBaseOrientation.TOKEN1;
  }

  // Now check secondary base tokens: ETH
  if (token0.toHexString().toLowerCase() == ERC20_WETH.toLowerCase()) {
    return PairTokenBaseOrientation.TOKEN0;
  }

  if (token1.toHexString().toLowerCase() == ERC20_WETH.toLowerCase()) {
    return PairTokenBaseOrientation.TOKEN1;
  }

  return PairTokenBaseOrientation.UNKNOWN;
}

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
 * @returns Price of ETH in USD, or 0 if the contract reverts
 */
export function getBaseEthUsdRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(PAIR_UNISWAP_V2_USDC_ETH));
  if (!pair) {
    throw new Error(
      "Cannot determine value of ETH-USD as the contract " +
      PAIR_UNISWAP_V2_USDC_ETH +
      " does not exist yet.",
    );
  }

  const reservesResult = pair.try_getReserves();
  if (reservesResult.reverted) {
    log.error("getBaseEthUsdRate: Cannot determine value of ETH-USD as the contract {} reverted on getReserves().", [PAIR_UNISWAP_V2_USDC_ETH]);
    return BigDecimal.zero();
  }

  const reserves = reservesResult.value;
  const usdReserves = reserves.value0.toBigDecimal();
  const ethReserves = reserves.value1.toBigDecimal();

  const ethRate = usdReserves.div(ethReserves).times(BIG_DECIMAL_1E12);
  log.debug("getBaseEthUsdRate: ETH rate {}", [ethRate.toString()]);

  return ethRate;
}

export function getBaseUsdRate(): BigDecimal {
  return BigDecimal.fromString("1");
}

/**
 * Gets the USD value of the base token, as identified by {orientation}.
 *
 * This enables pairs to have ETH or DAI/USDC/USDT as the base token.
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
  _blockNumber: BigInt,
): BigDecimal {
  // TODO consider shifting usage to getBaseTokenRate
  if (orientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "Unsure how to deal with unknown token base orientation for tokens " +
      getContractName(token0.toHexString()) +
      ", " +
      getContractName(token1.toHexString()),
    );
  }

  const baseToken = orientation === PairTokenBaseOrientation.TOKEN0 ? token0 : token1;

  if (baseToken.equals(Address.fromString(ERC20_WETH))) {
    return getBaseEthUsdRate();
  }

  if (isTokenAddressInCategory(baseToken.toHexString(), TokenCategoryStable, ERC20_TOKENS)) {
    return getBaseUsdRate();
  }

  throw new Error(
    `getBaseTokenUSDRate: Token ${getContractName(
      baseToken.toHexString(),
    )} is unsupported for base token price lookup`,
  );
}

/**
 * Gets the USD value of the base token, as identified by {orientation}.
 *
 * This enables pairs to have ETH or DAI/USDC/USDT as the base token.
 *
 * @param token0
 * @param token1
 * @param orientation
 * @param blockNumber
 * @returns
 */
export function getBaseTokenRate(
  baseToken: Address,
  _blockNumber: BigInt,
): BigDecimal {
  if (baseToken.equals(Address.fromString(ERC20_WETH))) {
    return getBaseEthUsdRate();
  }

  if (isTokenAddressInCategory(baseToken.toHexString(), TokenCategoryStable, ERC20_TOKENS)) {
    return getBaseUsdRate();
  }

  throw new Error(
    `getBaseTokenUSDRate: Token ${getContractName(
      baseToken.toHexString(),
    )} is unsupported for base token price lookup`,
  );
}
