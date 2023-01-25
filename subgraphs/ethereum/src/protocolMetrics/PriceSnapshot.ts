import { BigInt, ethereum } from "@graphprotocol/graph-ts";

import { getCurrentIndex } from "../../../shared/src/supply/OhmCalculations";
import { getISO8601StringFromTimestamp } from "../../../shared/src/utils/DateHelper";
import { PriceSnapshot } from "../../generated/schema";
import { getBaseOhmUsdRate } from "../utils/Price";

export function handleBlock(block: ethereum.Block): void {
    const ohmIndex = getCurrentIndex(block.number);

    const entity = new PriceSnapshot(`${block.number.toString()}`);
    entity.block = block.number;
    entity.timestamp = block.timestamp.times(BigInt.fromString("1000")); // Milliseconds
    entity.date = getISO8601StringFromTimestamp(block.timestamp);
    entity.priceOhm = getBaseOhmUsdRate(block.number);
    entity.priceGOhm = entity.priceOhm.times(ohmIndex);
    entity.save();
}
