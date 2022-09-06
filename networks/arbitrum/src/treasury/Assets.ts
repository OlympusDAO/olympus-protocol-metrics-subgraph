import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
import { getTokenBalances } from "./TokenBalances";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  // Stable
  getTokenBalances(timestamp, TokenCategoryStable, blockNumber);

  // Volatile
  getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber);

  // TODO POL
}

export function handleAssets(block: ethereum.Block): void {
  // Only index every 14,400th block, approximately 8 hours
  if (!block.number.mod(BigInt.fromString("14400")).equals(BigInt.zero())) {
    return;
  }

  log.debug("handleAssets: *** Indexing block {}", [block.number.toString()]);
  generateTokenRecords(block.timestamp, block.number);
}
