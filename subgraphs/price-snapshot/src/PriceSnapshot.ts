import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { ERC20_OHM_V2 } from "../../ethereum/src/utils/Constants";
import { getUSDRate } from "../../ethereum/src/utils/Price";
import { getCurrentIndex } from "../../shared/src/supply/OhmCalculations";
import { addDays, getDateFromBlockTimestamp, getISO8601DateString, getISO8601StringFromTimestamp } from "../../shared/src/utils/DateHelper";
import { NewRound } from "../generated/PriceSnapshot/ChainlinkPriceFeed";
import { PriceSnapshot, PriceSnapshotDaily } from "../generated/schema";
import { getDelta, getStandardDeviation } from "./helpers/Math";

function createPriceSnapshotDaily(date: Date): PriceSnapshotDaily {
    return new PriceSnapshotDaily(getISO8601DateString(date));
}

function getPriceSnapshotDaily(date: Date): PriceSnapshotDaily | null {
    const dateString = getISO8601DateString(date);

    log.debug("Fetching PriceSnapshotDaily for id: {}", [dateString]);
    return PriceSnapshotDaily.load(dateString);
}

function updatePriceSnapshotDaily(date: Date, snapshotId: string): void {
    let dailySnapshot = getPriceSnapshotDaily(date);
    if (!dailySnapshot) {
        log.debug("Creating new PriceSnapshotDaily, as it does not exist.", []);
        dailySnapshot = createPriceSnapshotDaily(date);
    }

    // Set the snapshot
    dailySnapshot.record = snapshotId;
    dailySnapshot.save();
}

function getPriceSnapshot(block: string): PriceSnapshot | null {
    return PriceSnapshot.load(block);
}

function getPreviousPriceSnapshot(date: Date): PriceSnapshot | null {
    const prevDate = addDays(date, -1);
    const prevSnapshotDaily = getPriceSnapshotDaily(prevDate);
    if (!prevSnapshotDaily) {
        return null;
    }

    const prevSnapshotRecordId = prevSnapshotDaily.record;
    if (!prevSnapshotRecordId) {
        return null;
    }

    const prevSnapshot = getPriceSnapshot(prevSnapshotRecordId);
    if (!prevSnapshot) {
        return null;
    }

    return prevSnapshot;
}

/**
 * Returns the delta between the OHM-USD price in the current snapshot and the latest snapshot from the previous day.
 * 
 * Delta is calculated as: (current price/previous price) - 1
 * 
 * @param currentSnapshot 
 * @param previousSnapshot 
 * @returns Price delta or null (if the previous price is missing)
 */
export function getPriceDelta(currentSnapshot: PriceSnapshot, previousSnapshot: PriceSnapshot | null): BigDecimal | null {
    if (!previousSnapshot) {
        return null;
    }

    return getDelta(currentSnapshot.ohmUsdPrice, previousSnapshot.ohmUsdPrice);
}

/**
 * Returns the volatility of OHM-USD using standard deviation.
 * 
 * @param currentSnapshot 
 * @param currentDate 
 * @param days 
 * @returns Price volatility or null (if there are not enough values)
 */
export function getPriceVolatility(currentSnapshot: PriceSnapshot, currentDate: Date, days: i32): BigDecimal | null {
    const currentPriceDelta = currentSnapshot.ohmUsdPrice1dDelta;
    if (!currentPriceDelta) {
        return null;
    }

    const priceDeltas: BigDecimal[] = [currentPriceDelta];

    // Fetch the previous days - 1 snapshots
    for (let i = 0; i < days - 1; i++) {
        const date = addDays(currentDate, -1 * i);
        const snapshot = getPreviousPriceSnapshot(date);

        if (snapshot !== null && snapshot.ohmUsdPrice1dDelta !== null) {
            // Workaround for null checking in AssemblyScript
            priceDeltas.push(snapshot.ohmUsdPrice1dDelta!);
        }
    }

    return getStandardDeviation(priceDeltas, days);
}

/**
 * Takes a price snapshot every 300 blocks (~ 1 hour), including:
 * - OHM-USD price
 * - gOHM-USD price
 * - Price delta against the latest price for the previous day, or null
 * - Price volatility over the previous 30 days (using the standard deviation of the 1d price delta), or null
 * 
 * @param event
 * @returns 
 */
export function handleEvent(event: NewRound): void {
    const block = event.block;

    const ohmIndex = getCurrentIndex(block.number);

    // Grab the previous day's snapshot
    const currentDate = getDateFromBlockTimestamp(block.timestamp);
    const prevSnapshot = getPreviousPriceSnapshot(currentDate);

    // Create the snapshot
    const currentSnapshot = new PriceSnapshot(`${block.number.toString()}`);
    currentSnapshot.block = block.number;
    currentSnapshot.timestamp = block.timestamp.times(BigInt.fromString("1000")); // Milliseconds
    currentSnapshot.date = getISO8601StringFromTimestamp(block.timestamp);

    currentSnapshot.ohmUsdPrice = getUSDRate(ERC20_OHM_V2, block.number);
    currentSnapshot.ohmUsdPrice1dDelta = getPriceDelta(currentSnapshot, prevSnapshot);
    currentSnapshot.ohmUsdPrice30dVolatility = getPriceVolatility(currentSnapshot, currentDate, <i32>30);

    currentSnapshot.gOhmUsdPrice = currentSnapshot.ohmUsdPrice.times(ohmIndex);
    currentSnapshot.save();

    // The daily snapshot should point to this new one
    updatePriceSnapshotDaily(currentDate, currentSnapshot.id);
}
