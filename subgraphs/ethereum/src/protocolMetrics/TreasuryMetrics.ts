import { BigDecimal } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { BUYBACK_MS } from "../../../shared/src/Wallets";
import { ERC20_GOHM, ERC20_OHM_V1, ERC20_OHM_V2, OHM_IN_MARKET_VALUE_BLOCK } from "../utils/Constants";

/**
 * OHM price * circulating supply
 */
export function getMarketCap(ohmPrice: BigDecimal, circulatingSupply: BigDecimal): BigDecimal {
    return ohmPrice.times(circulatingSupply);
}

function _isTokenOHM(tokenAddress: string): boolean {
    const tokenLower = tokenAddress.toLowerCase();

    return tokenLower == ERC20_OHM_V1 || tokenLower == ERC20_OHM_V2 || tokenLower == ERC20_GOHM;
}

/**
 * Includes all assets in the treasury
 */
export function getTreasuryMarketValue(tokenRecords: TokenRecord[]): BigDecimal {
    let total = BigDecimal.zero();

    for (let i = 0; i < tokenRecords.length; i++) {
        const tokenRecord = tokenRecords[i];

        // Ignore if an OHM token and:
        // - not in the buyback MS, or
        // - it is before the inclusion block
        if (_isTokenOHM(tokenRecord.tokenAddress) &&
            (
                tokenRecord.sourceAddress.toLowerCase() != BUYBACK_MS.toLowerCase()
                ||
                tokenRecord.block.lt(OHM_IN_MARKET_VALUE_BLOCK)
            )) {
            continue;
        }

        total = total.plus(tokenRecord.value);
    }

    return total;
}

/**
 * Includes all liquid assets in the treasury, excluding the value of OHM
 */
export function getTreasuryLiquidBacking(tokenRecords: TokenRecord[]): BigDecimal {
    let total = BigDecimal.zero();

    for (let i = 0; i < tokenRecords.length; i++) {
        const tokenRecord = tokenRecords[i];
        if (!tokenRecord.isLiquid) {
            continue;
        }

        total = total.plus(tokenRecord.valueExcludingOhm);
    }

    return total;
}

export function getTreasuryLiquidBackingPerOhmFloating(liquidBacking: BigDecimal, ohmFloatingSupply: BigDecimal): BigDecimal {
    return liquidBacking.div(ohmFloatingSupply);
}

export function getTreasuryLiquidBackingPerGOhmSynthetic(liquidBacking: BigDecimal, gOhmSupply: BigDecimal): BigDecimal {
    return liquidBacking.div(gOhmSupply);
}
