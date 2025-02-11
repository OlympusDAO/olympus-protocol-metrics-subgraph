import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { getContractName } from "../contracts/Contracts";
import { getPriceFeedValue } from "./PriceChainlink";

export function isBaseToken(baseToken: string): boolean {
  const FUNC = "isBaseToken";
  const priceFeedValue = getPriceFeedValue(baseToken);

  if (priceFeedValue !== null) {
    log.debug("{}: Token {} is a base token", [FUNC, getContractName(baseToken)]);
    return true;
  }

  log.debug("{}: Token {} is not a base token", [FUNC, getContractName(baseToken)]);
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
  const FUNC = "getBaseTokenRate";
  const baseTokenAddress = baseToken.toHexString().toLowerCase();
  if (!isBaseToken(baseTokenAddress)) {
    throw new Error(
      `${FUNC}: Token ${getContractName(
        baseTokenAddress,
      )} is unsupported for base token price lookup`,
    );
  }

  log.info("{} Getting USD rate for token {} ({})", [FUNC, getContractName(baseTokenAddress), baseTokenAddress]);
  const usdRate = getPriceFeedValue(baseTokenAddress);
  if (usdRate === null || usdRate.equals(BigDecimal.zero())) {
    throw new Error(`${FUNC}: Unable to determine USD rate for token ${getContractName(baseTokenAddress)} (${baseTokenAddress}) at block ${blockNumber.toString()}`);
  }

  log.debug(`${FUNC}: USD rate for token ${getContractName(baseTokenAddress)} (${baseTokenAddress}) is ${usdRate.toString()}`, []);
  return usdRate;
}
