import { log } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../shared/src/utils/Decimals";
import { GnosisAuctionLaunched } from "../generated/BondManager/BondManager";
import { GnosisAuction, GnosisAuctionRoot } from "../generated/schema";

export const GNOSIS_RECORD_ID = "GnosisAuction";

export function handleGnosisAuctionLaunched(event: GnosisAuctionLaunched): void {
    // We have one one record in GnosisAuction
    let rootRecord: GnosisAuctionRoot | null = GnosisAuctionRoot.load(GNOSIS_RECORD_ID);
    if (!rootRecord) {
        rootRecord = new GnosisAuctionRoot(GNOSIS_RECORD_ID);
        rootRecord.markets = [];
    }

    log.debug("Adding Gnosis Auction with id {} to GnosisAuction record", [event.params.marketId.toString()]);
    rootRecord.markets.push(event.params.marketId);
    rootRecord.save();

    const auctionRecord = new GnosisAuction(event.params.marketId.toString());
    auctionRecord.capacity = toDecimal(event.params.capacity, 9);
    auctionRecord.save();
}