import { BigInt, ethereum } from "@graphprotocol/graph-ts";

import { getBaseOhmUsdRate } from "../../ethereum/src/utils/Price";
import { getCurrentIndex } from "../../shared/src/supply/OhmCalculations";
import { getISO8601StringFromTimestamp } from "../../shared/src/utils/DateHelper";
import { PriceSnapshot } from "../generated/schema";

export function handleBlock(block: ethereum.Block): void {
    // Record 1 block per hour (60*60/12 blocks per hour) 
    if (block.number.mod(BigInt.fromI32(5 * 60)).notEqual(BigInt.zero())) {
        return;
    }

    const ohmIndex = getCurrentIndex(block.number);

    const entity = new PriceSnapshot(`${block.number.toString()}`);
    entity.block = block.number;
    entity.timestamp = block.timestamp.times(BigInt.fromString("1000")); // Milliseconds
    entity.date = getISO8601StringFromTimestamp(block.timestamp);
    entity.priceOhm = getBaseOhmUsdRate(block.number);
    entity.priceGOhm = entity.priceOhm.times(ohmIndex);
    entity.save();
}
