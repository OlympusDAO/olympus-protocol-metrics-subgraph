import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerKodiakIsland } from "../../../shared/src/price/PriceHandlerKodiakIsland";
import { PriceHandlerUniswapV3 } from "../../../shared/src/price/PriceHandlerUniswapV3";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  ERC20_HONEY,
  ERC20_OHM,
  ERC20_WBERA,
  LP_KODIAK_OHM_HONEY,
  LP_UNISWAP_V3_WBERA_HONEY,
  UNISWAP_V3_POSITION_MANAGER
} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getBaseTokenRate, isBaseToken } from "./PriceBase";

const KODIAK_QUOTER = "0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B".toLowerCase();

export const PRICE_HANDLERS: PriceHandler[] = [
  // TODO add IBERA pool
  new PriceHandlerUniswapV3([ERC20_HONEY, ERC20_WBERA], LP_UNISWAP_V3_WBERA_HONEY, UNISWAP_V3_POSITION_MANAGER, getContractName),
  new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, getContractName),
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
