import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20_WETH } from "../../../arbitrum/src/contracts/Constants";
import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerStablecoin } from "../../../shared/src/price/PriceHandlerStablecoin";
import { PriceHandlerUniswapV2 } from "../../../shared/src/price/PriceHandlerUniswapV2";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  ERC20_BEETS,
  ERC20_BOO,
  ERC20_DAI,
  ERC20_DEI,
  ERC20_FRAX,
  ERC20_GOHM,
  ERC20_LQDR,
  ERC20_OXD,
  ERC20_USDC,
  ERC20_WFTM,
  LP_UNISWAP_V2_BOO_WFTM,
  LP_UNISWAP_V2_LQDR_WFTM,
  LP_UNISWAP_V2_WFTM_BEETS,
  LP_UNISWAP_V2_WFTM_ETH,
  LP_UNISWAP_V2_WFTM_GOHM,
  LP_UNISWAP_V2_WFTM_OXD,
  LP_UNISWAP_V2_WFTM_USDC,
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";

export const HANDLERS: PriceHandler[] = [
  new PriceHandlerStablecoin([ERC20_DAI, ERC20_DEI, ERC20_FRAX, ERC20_USDC], getContractName),
  new PriceHandlerUniswapV2([ERC20_BOO, ERC20_WFTM], LP_UNISWAP_V2_BOO_WFTM, getContractName),
  new PriceHandlerUniswapV2([ERC20_GOHM, ERC20_WFTM], LP_UNISWAP_V2_WFTM_GOHM, getContractName),
  new PriceHandlerUniswapV2([ERC20_LQDR, ERC20_WFTM], LP_UNISWAP_V2_LQDR_WFTM, getContractName),
  new PriceHandlerUniswapV2([ERC20_USDC, ERC20_WFTM], LP_UNISWAP_V2_WFTM_USDC, getContractName),
  new PriceHandlerUniswapV2([ERC20_WFTM, ERC20_BEETS], LP_UNISWAP_V2_WFTM_BEETS, getContractName),
  new PriceHandlerUniswapV2([ERC20_WFTM, ERC20_OXD], LP_UNISWAP_V2_WFTM_OXD, getContractName),
  new PriceHandlerUniswapV2([ERC20_WFTM, ERC20_WETH], LP_UNISWAP_V2_WFTM_ETH, getContractName),
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
