import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";

export function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): void {
  // Stable
  // Volatile
  // POL
}

export function handleAssets(block: ethereum.Block): void {
  // Only index every 14,400th block, approximately 8 hours
  if (!block.number.mod(BigInt.fromString("14400")).equals(BigInt.zero())) {
    return;
  }

  log.debug("handleAssets: *** Indexing block {}", [block.number.toString()]);
  generateTokenRecords(block.timestamp, block.number);
}
