import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
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
