import { ethereum, BigInt } from "@graphprotocol/graph-ts";
import { getISO8601StringFromTimestamp } from "../../../shared/src/utils/DateHelper";
import { PriceSnapshot } from "../../generated/schema";
import { ERC20_GOHM, ERC20_OHM_V2 } from "../utils/Constants";
import { getUSDRate } from "../utils/Price";

export function handleBlock(block: ethereum.Block): void {
    const entity = new PriceSnapshot(`${block.number.toString()}`);
    entity.block = block.number;
    entity.timestamp = block.timestamp.times(BigInt.fromString("1000")); // Milliseconds
    entity.date = getISO8601StringFromTimestamp(block.timestamp);
    entity.priceOhm = getUSDRate(ERC20_OHM_V2, block.number);
    entity.priceGOhm = getUSDRate(ERC20_GOHM, block.number);
    entity.save();
}