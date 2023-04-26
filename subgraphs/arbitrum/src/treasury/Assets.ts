import { BigInt, log } from "@graphprotocol/graph-ts";

import {
  TokenCategoryStable,
  TokenCategoryVolatile,
} from "../../../shared/src/contracts/TokenDefinition";
import { pushTokenRecordArray, pushTokenSupplyArray } from "../../../shared/src/utils/ArrayHelper";
import { TokenRecord, TokenSupply } from "../../generated/schema";
import { FundsDeposited } from "../../generated/TokenRecords-arbitrum/GelatoTaskTreasury";
import { getProtocolOwnedLiquiditySupplyRecords, getTreasuryOHMRecords } from "./OhmCalculations";
import { getOwnedLiquidityBalances } from "./OwnedLiquidity";
import { getTokenBalances } from "./TokenBalances";

function generateTokenRecords(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  pushTokenRecordArray(
    records,
    getTokenBalances(timestamp, TokenCategoryStable, blockNumber),
  );


  pushTokenRecordArray(
    records,
    getTokenBalances(timestamp, TokenCategoryVolatile, blockNumber)
  );

  pushTokenRecordArray(
    records,
    getOwnedLiquidityBalances(timestamp, blockNumber)
  );

  return records;
}

function generateTokenSupplies(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Treasury OHM
  pushTokenSupplyArray(
    records,
    getTreasuryOHMRecords(timestamp, blockNumber),
  );

  // POL
  pushTokenSupplyArray(
    records,
    [],
  );

  return records;
}

export function handleEvent(event: FundsDeposited): void {
  const block = event.block;

  log.debug("handleEvent: *** Indexing block {}", [block.number.toString()]);
  generateTokenRecords(block.timestamp, block.number);
  generateTokenSupplies(block.timestamp, block.number);
}