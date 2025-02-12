import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

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
  ERC20_LQTY,
  ERC20_MAGIC,
  ERC20_OHM,
  ERC20_USDC,
  ERC20_VSTA,
  ERC20_WETH,
  LP_BALANCER_POOL_OHM_USDC,
  LP_BALANCER_POOL_WETH_OHM,
  LP_BALANCER_POOL_WETH_VESTA,
  LP_CAMELOT_OHM_WETH,
  LP_UNISWAP_V2_GOHM_WETH,
  LP_UNISWAP_V2_JONES_WETH,
  LP_UNISWAP_V2_LQTY_WETH,
  LP_UNISWAP_V2_MAGIC_WETH,
  LP_UNISWAP_V3_ARB_WETH,
  LP_UNISWAP_V3_WETH_USDC,
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getBaseTokenRate, isBaseToken } from "./PriceBase";

const UNISWAP_V3_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88".toLowerCase();

export const PRICE_HANDLERS: PriceHandler[] = [
  // new PriceHandlerBalancer([ERC20_MAGIC, ERC20_USDC], BALANCER_VAULT, LP_BALANCER_POOL_MAGIC_USDC, getContractName), // DO NOT enable: will cause infinite loop: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/issues/94
  new PriceHandlerBalancer([ERC20_WETH, ERC20_VSTA], BALANCER_VAULT, LP_BALANCER_POOL_WETH_VESTA, getContractName),
  new PriceHandlerBalancer([ERC20_WETH, ERC20_OHM], BALANCER_VAULT, LP_BALANCER_POOL_WETH_OHM, getContractName),
  new PriceHandlerBalancer([ERC20_OHM, ERC20_USDC], BALANCER_VAULT, LP_BALANCER_POOL_OHM_USDC, getContractName),
  new PriceHandlerStablecoin([ERC20_FRAX, ERC20_USDC], getContractName),
  new PriceHandlerUniswapV2([ERC20_GOHM_SYNAPSE, ERC20_WETH], LP_UNISWAP_V2_GOHM_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_JONES, ERC20_WETH], LP_UNISWAP_V2_JONES_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_LQTY, ERC20_WETH], LP_UNISWAP_V2_LQTY_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_MAGIC, ERC20_WETH], LP_UNISWAP_V2_MAGIC_WETH, getContractName),
  new PriceHandlerUniswapV2([ERC20_OHM, ERC20_WETH], LP_CAMELOT_OHM_WETH, getContractName),
  new PriceHandlerUniswapV3([ERC20_USDC, ERC20_WETH], LP_UNISWAP_V3_WETH_USDC, UNISWAP_V3_POSITION_MANAGER, getContractName),
  new PriceHandlerUniswapV3([ERC20_ARB, ERC20_WETH], LP_UNISWAP_V3_ARB_WETH, UNISWAP_V3_POSITION_MANAGER, getContractName),
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
  const FUNC = "getPriceRecursive";

  /**
   * Check for a base token in this function, instead of getPrice, so that recursive checks can use price feeds.
   */
  if (isBaseToken(tokenAddress)) {
    const usdRate = getBaseTokenRate(Address.fromString(tokenAddress), block);
    return {
      price: usdRate,
      liquidity: new BigDecimal(BigInt.fromU64(U64.MAX_VALUE))
    }
  }

  log.debug("{}: Determining price for {} ({}) and current pool id {}", [FUNC, getContractName(tokenAddress), tokenAddress, currentPool ? currentPool : ""]);
  return getUSDRate(tokenAddress, PRICE_HANDLERS, getPriceRecursive, block, currentPool);
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
  const FUNC = "getPrice";
  log.debug(`${FUNC}: Determining price for ${getContractName(tokenAddress)} (${tokenAddress}) at block ${block.toString()}`, []);

  const priceResult = getPriceRecursive(tokenAddress, block, null);

  if (priceResult === null) {
    log.warning("Unable to determine price for token {} ({}) at block {}", [getContractName(tokenAddress), tokenAddress, block.toString()]);
    return BigDecimal.zero();
  }

  log.debug("Price for {} ({}) at block {} was: {}", [getContractName(tokenAddress), tokenAddress, block.toString(), priceResult.price.toString()]);
  return priceResult.price;
}
