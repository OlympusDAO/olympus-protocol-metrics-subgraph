import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { getContractName } from "../contracts/Contracts";
import { getPriceFeedTokens, getPriceFeedValue } from "./PriceChainlink";

export function isBaseToken(baseToken: string): boolean {
  const baseTokenLower = baseToken.toLowerCase();

  if (getPriceFeedTokens().includes(baseTokenLower)) {
    return true;
  }

  return false;
}

/**
 * Gets the USD value of the base token.
 *
 * This enables pairs to have ETH or DAI/USDC/USDT as the base token.
 *
 * @param baseToken
 * @param blockNumber
 * @returns
 */
export function getBaseTokenRate(
  baseToken: Address,
  blockNumber: BigInt,
): BigDecimal {
  const baseTokenAddress = baseToken.toHexString().toLowerCase();
  if (!isBaseToken(baseTokenAddress)) {
    throw new Error(
      `getBaseTokenRate: Token ${getContractName(
        baseTokenAddress,
      )} is unsupported for base token price lookup`,
    );
  }

  const usdRate = getPriceFeedValue(baseTokenAddress);

  if (usdRate === null || usdRate.equals(BigDecimal.zero())) {
    throw new Error(`getBaseTokenRate: Unable to determine USD rate for token ${getContractName(baseTokenAddress)} (${baseTokenAddress}) at block ${blockNumber.toString()}`);
  }

  return usdRate;
}
