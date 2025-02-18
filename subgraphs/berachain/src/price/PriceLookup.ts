import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { getUSDRate } from "../../../shared/src/price/PriceRouter";
import { getContractName } from "../contracts/Contracts";
import { PRICE_HANDLERS } from "../contracts/LiquidityConstants";
import { getBaseTokenRate, isBaseToken } from "./PriceBase";

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
