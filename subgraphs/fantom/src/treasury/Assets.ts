import { BigInt, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
import { NewRound } from "../../generated/TokenRecords-fantom/ChainlinkAggregator";
import { getOwnedLiquidityBalances } from "./OwnedLiquidity";
import { getTokenBalances } from "./TokenBalances";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  getTokenBalances(timestamp, TokenCategoryStable, blockNumber);

  getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber);

  getOwnedLiquidityBalances(timestamp, blockNumber);
}

export function handleAssets(event: NewRound): void {
  log.debug("handleAssets: *** Indexing block {}", [event.block.number.toString()]);
  generateTokenRecords(event.block.timestamp, event.block.number);
}
