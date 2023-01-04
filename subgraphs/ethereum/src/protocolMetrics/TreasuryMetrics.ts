import { BigDecimal } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../../common/generated/schema";

/**
 * OHM price * circulating supply
 */
export function getMarketCap(ohmPrice: BigDecimal, circulatingSupply: BigDecimal): BigDecimal {
    return ohmPrice.times(circulatingSupply);
}

/**
 * Includes all assets in the treasury
 */
export function getTreasuryMarketValue(tokenRecords: TokenRecord[]): BigDecimal {
    let total = BigDecimal.zero();

    for (let i = 0; i < tokenRecords.length; i++) {
        const tokenRecord = tokenRecords[i];

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
