import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerCustomMapping } from "../../../shared/src/price/PriceHandlerCustomMapping";
import { PriceHandlerStablecoin } from "../../../shared/src/price/PriceHandlerStablecoin";
import { PriceHandlerUniswapV2 } from "../../../shared/src/price/PriceHandlerUniswapV2";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  ERC20_DAI,
  ERC20_FRAX,
  ERC20_GOHM,
  ERC20_KLIMA,
  ERC20_KLIMA_STAKED,
  ERC20_SYN,
  ERC20_USDC,
  ERC20_WETH,
  LP_UNISWAP_V2_KLIMA_USDC,
  LP_UNISWAP_V2_SYN_WETH,
  LP_UNISWAP_V2_USDC_WETH,
  LP_UNISWAP_V2_WETH_GOHM,
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";

export const HANDLERS: PriceHandler[] = [
  new PriceHandlerCustomMapping(ERC20_KLIMA, [ERC20_KLIMA_STAKED], getContractName),
  new PriceHandlerStablecoin([ERC20_DAI, ERC20_FRAX, ERC20_USDC], getContractName),
  new PriceHandlerUniswapV2([ERC20_GOHM, ERC20_WETH], LP_UNISWAP_V2_WETH_GOHM, getContractName),
  new PriceHandlerUniswapV2([ERC20_KLIMA, ERC20_USDC], LP_UNISWAP_V2_KLIMA_USDC, getContractName),
  new PriceHandlerUniswapV2([ERC20_SYN, ERC20_WETH], LP_UNISWAP_V2_SYN_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_USDC, ERC20_WETH], LP_UNISWAP_V2_USDC_WETH, getContractName),
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
export function getPriceRecursive(
  tokenAddress: string,
  block: BigInt,
  currentPool: string | null,
): PriceLookupResult | null {
  log.debug("Determining price for {} ({}) and current pool id {}", [getContractName(tokenAddress), tokenAddress, currentPool ? currentPool : ""]);
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

  if (priceResult === null) {
    log.warning("Unable to determine price for token {} ({}) at block {}", [getContractName(tokenAddress), tokenAddress, block.toString()]);
    return BigDecimal.zero();
  }

  log.debug("Price for {} ({}) at block {} was: {}", [getContractName(tokenAddress), tokenAddress, block.toString(), priceResult.price.toString()]);
  return priceResult.price;
}
