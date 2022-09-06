import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { PriceLookupResult } from "../../../shared/src/price/PriceHandler.d";
import { PriceHandlerUniswapV3 } from "../../../shared/src/price/PriceHandlerUniswapV3";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import { ERC20_USDC, ERC20_WETH, LP_UNISWAP_V3_WETH_USDC } from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";

const HANDLERS: PriceHandler[] = [
  new PriceHandlerUniswapV3([ERC20_USDC, ERC20_WETH], LP_UNISWAP_V3_WETH_USDC, getContractName),
];

/**
 * Internal function to determine the price, using the shared price functions.
 *
 * It simply injects {HANDLERS}, so that {getUSDRate} can operate.
 *
 * @param tokenAddress
 * @param block
 * @param currentPool
 * @returns
 */
function getPriceRecursive(
  tokenAddress: string,
  block: BigInt,
  currentPool: string | null,
): PriceLookupResult | null {
  return getUSDRate(tokenAddress, HANDLERS, getPriceRecursive, block, currentPool);
}

/**
 * External-facing function that determines the price of {tokenAddress}.
 *
 * @param tokenAddress
 * @param block
 * @returns BigDecimal
 * @throws Error if a price cannot be found, so that the subgraph indexing fails quickly
 */
export function getPrice(tokenAddress: string, block: BigInt): BigDecimal {
  const priceResult = getPriceRecursive(tokenAddress, block, null);

  if (!priceResult) {
    throw new Error(
      `Unable to determine price for token ${getContractName(tokenAddress)} (${tokenAddress})`,
    );
  }

  return priceResult.price;
}
