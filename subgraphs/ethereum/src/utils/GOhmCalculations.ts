import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import { ERC20_GOHM } from "./Constants";

/**
 * Returns the total supply of the gOHM token at the given block number.
 *
 * If the ERC20 contract cannot be loaded, 0 will be returned.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal presenting the total supply at {blockNumber}
 */
export function getGOhmTotalSupply(blockNumber: BigInt): BigDecimal {
  const snapshot = getOrCreateERC20TokenSnapshot(ERC20_GOHM, blockNumber);

  if (!snapshot) {
    log.error(
      "getTotalSupply: Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ERC20_GOHM, blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  return snapshot.totalSupply;
}

/**
 * gOHM circulating supply is synthetically calculated as:
 *
 * OHM floating supply / current index
 */
export function getGOhmSyntheticSupply(ohmFloatingSupply: BigDecimal, currentIndex: BigDecimal): BigDecimal {
  return ohmFloatingSupply.div(currentIndex);
}