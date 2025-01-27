import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerERC4626 } from "../../../shared/src/price/PriceHandlerERC4626";
import { PriceHandlerUniswapV2 } from "../../../shared/src/price/PriceHandlerUniswapV2";
import { PriceHandlerUniswapV3 } from "../../../shared/src/price/PriceHandlerUniswapV3";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  ERC20_OHM,
  ERC20_USDS,
  ERC20_WETH,
  ERC4626_SUSDS,
  LP_UNISWAP_V2_OHM_WETH,
  LP_UNISWAP_V3_OHM_SUSDS,
  UNISWAP_V3_POSITION_MANAGER
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getBaseTokenRate, isBaseToken } from "./PriceBase";

export const PRICE_HANDLERS: PriceHandler[] = [
  new PriceHandlerUniswapV2([ERC20_OHM, ERC20_WETH], LP_UNISWAP_V2_OHM_WETH, getContractName),
  new PriceHandlerUniswapV3([ERC20_OHM, ERC4626_SUSDS], LP_UNISWAP_V3_OHM_SUSDS, UNISWAP_V3_POSITION_MANAGER, getContractName),
  new PriceHandlerERC4626(ERC4626_SUSDS, ERC20_USDS, getContractName),
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
    log.warning("{}: Unable to determine price for token {} ({}) at block {}", [FUNC, getContractName(tokenAddress), tokenAddress, block.toString()]);
    return BigDecimal.zero();
  }

  log.debug("{}: Price for {} ({}) at block {} was: {}", [FUNC, getContractName(tokenAddress), tokenAddress, block.toString(), priceResult.price.toString()]);
  return priceResult.price;
}
