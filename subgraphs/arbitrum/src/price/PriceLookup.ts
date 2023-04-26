import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerBalancer } from "../../../shared/src/price/PriceHandlerBalancer";
import { PriceHandlerStablecoin } from "../../../shared/src/price/PriceHandlerStablecoin";
import { PriceHandlerUniswapV2 } from "../../../shared/src/price/PriceHandlerUniswapV2";
import { PriceHandlerUniswapV3 } from "../../../shared/src/price/PriceHandlerUniswapV3";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  BALANCER_VAULT,
  ERC20_ARB,
  ERC20_FRAX,
  ERC20_GOHM_SYNAPSE,
  ERC20_JONES,
  ERC20_MAGIC,
  ERC20_USDC,
  ERC20_VSTA,
  ERC20_WETH,
  LP_BALANCER_POOL_WETH_VESTA,
  LP_UNISWAP_V2_GOHM_WETH,
  LP_UNISWAP_V2_JONES_WETH,
  LP_UNISWAP_V2_MAGIC_WETH,
  LP_UNISWAP_V3_ARB_WETH,
  LP_UNISWAP_V3_WETH_USDC,
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";

export const HANDLERS: PriceHandler[] = [
  // new PriceHandlerBalancer([ERC20_MAGIC, ERC20_USDC], BALANCER_VAULT, LP_BALANCER_POOL_MAGIC_USDC, getContractName), // DO NOT enable: will cause infinite loop: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/issues/94
  new PriceHandlerBalancer([ERC20_WETH, ERC20_VSTA], BALANCER_VAULT, LP_BALANCER_POOL_WETH_VESTA, getContractName),
  new PriceHandlerStablecoin([ERC20_FRAX, ERC20_USDC], getContractName),
  new PriceHandlerUniswapV2([ERC20_GOHM_SYNAPSE, ERC20_WETH], LP_UNISWAP_V2_GOHM_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_JONES, ERC20_WETH], LP_UNISWAP_V2_JONES_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_MAGIC, ERC20_WETH], LP_UNISWAP_V2_MAGIC_WETH, getContractName),
  new PriceHandlerUniswapV3([ERC20_USDC, ERC20_WETH], LP_UNISWAP_V3_WETH_USDC, getContractName),
  new PriceHandlerUniswapV3([ERC20_ARB, ERC20_WETH], LP_UNISWAP_V3_ARB_WETH, getContractName),
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
