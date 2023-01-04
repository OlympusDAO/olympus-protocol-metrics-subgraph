import { BigInt, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../../common/src/contracts/TokenDefinition";
import { RebaseCall } from "../../generated/TokenRecords-fantom/FantOHMStaking";
import { getOwnedLiquidityBalances } from "./OwnedLiquidity";
import { getTokenBalances } from "./TokenBalances";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  getTokenBalances(timestamp, TokenCategoryStable, blockNumber);

  getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber);

  getOwnedLiquidityBalances(timestamp, blockNumber);
}

export function handleAssets(call: RebaseCall): void {
  log.debug("handleAssets: *** Indexing block {}", [call.block.number.toString()]);
  generateTokenRecords(call.block.timestamp, call.block.number);
}
