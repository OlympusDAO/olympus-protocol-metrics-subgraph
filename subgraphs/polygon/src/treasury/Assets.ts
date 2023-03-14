import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
import { RoundRequested } from "../../generated/TokenRecords-polygon/ChainlinkOffchainAggregator";
import { getOwnedLiquidityBalances } from "./OwnedLiquidity";
import { getTokenBalances } from "./TokenBalances";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  getTokenBalances(timestamp, TokenCategoryStable, blockNumber);

  getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber);

  getOwnedLiquidityBalances(timestamp, blockNumber);
}

export function handleAssets(block: ethereum.Block): void {
  // Only index every 14,400th block, approximately 8 hours
  if (!block.number.mod(BigInt.fromString("14400")).equals(BigInt.zero())) {
    return;
  }

  log.debug("handleAssets: *** Indexing block {}", [block.number.toString()]);
  generateTokenRecords(block.timestamp, block.number);
}

export function handleEvent(event: RoundRequested): void {
  log.debug("handleEvent: *** Indexing block {}", [event.block.number.toString()]);
  generateTokenRecords(event.block.timestamp, event.block.number);
}
