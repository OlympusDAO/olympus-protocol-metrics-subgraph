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

function getPriceRecursive(tokenAddress: string, block: BigInt): PriceLookupResult | null {
  return getUSDRate(tokenAddress, HANDLERS, getPriceRecursive, block);
}

export function getPrice(tokenAddress: string, block: BigInt): BigDecimal | null {
  const priceResult = getPriceRecursive(tokenAddress, block);

  return priceResult ? priceResult.price : null;
}
