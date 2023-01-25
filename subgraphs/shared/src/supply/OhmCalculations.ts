import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ERC20_SOHM_V2, ERC20_SOHM_V3, ERC20_SOHM_V3_BLOCK } from "../Constants";
import { getSOlympusERC20V2, getSOlympusERC20V3 } from "../contracts/sOlympus";
import { toDecimal } from "../utils/Decimals";

/**
 * Returns the current staking index, based on the current block.
 *
 * If the current block is after {ERC20_SOHM_V3_BLOCK}, the index from the
 * sOHM v3 contract is returned.
 *
 * Otherwise, the index from the sOHM v2 contract is returned.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal
 */
export function getCurrentIndex(blockNumber: BigInt): BigDecimal {
    if (blockNumber.gt(BigInt.fromString(ERC20_SOHM_V3_BLOCK))) {
        const contractV3 = getSOlympusERC20V3(ERC20_SOHM_V3, blockNumber);

        return toDecimal(contractV3.index(), 9);
    } else {
        /**
         * {ERC20_SOHM_V2_BLOCK} is far before the typical starting block of this subgraph (14,000,000),
         * so we don't really need to test for it.
         *
         * TODO: However, if we do ever push the starting block back before {ERC20_SOHM_V2_BLOCK}, we need
         * to consider how to determine the index from sOHM V1, as it doesn't have an `index()` function.
         */
        const contractV2 = getSOlympusERC20V2(ERC20_SOHM_V2, blockNumber);

        return toDecimal(contractV2.index(), 9);
    }
}
