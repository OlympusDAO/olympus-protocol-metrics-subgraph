import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
import { Harvest } from "../../generated/TokenRecords-arbitrum/JonesMillinerV2";
import { getOwnedLiquidityBalances } from "./OwnedLiquidity";
import { getTokenBalances } from "./TokenBalances";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  getTokenBalances(timestamp, TokenCategoryStable, blockNumber);

  getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber);

  getOwnedLiquidityBalances(timestamp, blockNumber);
}

export function handleAssets(block: ethereum.Block): void {
  // Only index every 86,400th block (8 hours * 60 minutes * 60 seconds * 3 per second)
  if (!block.number.mod(BigInt.fromString("86400")).equals(BigInt.zero())) {
    return;
  }

  log.debug("handleAssets: *** Indexing block {}", [block.number.toString()]);
  generateTokenRecords(block.timestamp, block.number);
}

export function handleHarvestEvent(event: Harvest): void {
  log.debug("handleHarvestEvent: *** Indexing block {}", [event.block.number.toString()]);
  generateTokenRecords(event.block.timestamp, event.block.number);
}
