import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceHandler, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerUniswapV3Quoter } from "../../../shared/src/price/PriceHandlerUniswapV3Quoter";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import {
  BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT,
  ERC20_HONEY,
  ERC20_IBERA,
  ERC20_OHM,
  ERC20_WBERA,
  LP_BERADROME_KODIAK_OHM_HONEY,
  LP_KODIAK_IBERA_WBERA,
  LP_KODIAK_OHM_HONEY,
  LP_UNISWAP_V3_WBERA_HONEY,
  NATIVE_BERA} from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getBaseTokenRate, isBaseToken } from "./PriceBase";
import { PriceHandlerKodiakIsland } from "./PriceHandlerKodiakIsland";
import { PriceHandlerRemapping } from "../../../shared/src/price/PriceHandlerRemapping";

const KODIAK_QUOTER = "0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B".toLowerCase();

// Price lookup is enabled for these tokens
export const PRICE_HANDLERS: PriceHandler[] = [
  new PriceHandlerUniswapV3Quoter([ERC20_HONEY, ERC20_WBERA], KODIAK_QUOTER, LP_UNISWAP_V3_WBERA_HONEY, getContractName),
  new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, null, null, getContractName),
  new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT, LP_BERADROME_KODIAK_OHM_HONEY, getContractName),
  new PriceHandlerUniswapV3Quoter([ERC20_IBERA, ERC20_WBERA], KODIAK_QUOTER, LP_KODIAK_IBERA_WBERA, getContractName),
  new PriceHandlerRemapping(NATIVE_BERA, ERC20_WBERA, getContractName),
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

  log.info("{}: Determining price for {} ({}) and current pool id {}", [FUNC, getContractName(tokenAddress), tokenAddress, currentPool ? currentPool : ""]);
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
  log.info(`${FUNC}: Determining price for ${getContractName(tokenAddress)} (${tokenAddress}) at block ${block.toString()}`, []);

  const priceResult = getPriceRecursive(tokenAddress, block, null);

  if (priceResult === null) {
    log.warning("{}: Unable to determine price for token {} ({}) at block {}", [FUNC, getContractName(tokenAddress), tokenAddress, block.toString()]);
    return BigDecimal.zero();
  }

  log.info("{}: Price for {} ({}) at block {} was: {}", [FUNC, getContractName(tokenAddress), tokenAddress, block.toString(), priceResult.price.toString()]);
  return priceResult.price;
}
