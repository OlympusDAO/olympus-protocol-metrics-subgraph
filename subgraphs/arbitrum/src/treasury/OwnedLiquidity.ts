import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import {
  createTokenRecord,
  getIsTokenLiquid,
} from "../../../shared/src/utils/TokenRecordHelper";
import { BLOCKCHAIN, ERC20_TOKENS_ARBITRUM, getProtocolAddresses, OHM_TOKENS } from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getPriceRecursive, PRICE_HANDLERS } from "../price/PriceLookup";

/**
 * Returns the token records for a given token. This includes:
 * - Wallets
 * - Allocators
 *
 * @param contractAddress the address of the ERC20 contract
 * @param block the current block
 * @returns TokenRecord array
 */
function getOwnedLiquidityBalance(
  timestamp: BigInt,
  liquidityHandler: PriceHandler,
  block: BigInt,
): TokenRecord[] {
  const contractName = getContractName(liquidityHandler.getId());
  log.info("getOwnedLiquidityBalance: Calculating balance for {} ({}) at block number {}", [
    contractName,
    liquidityHandler.getId(),
    block.toString(),
  ]);
  const records: TokenRecord[] = [];

  // Calculate the multiplier
  const totalValue = liquidityHandler.getTotalValue([], getPriceRecursive, block);
  if (!totalValue || totalValue.equals(BigDecimal.zero())) {
    return records;
  }
  const includedValue = liquidityHandler.getTotalValue(OHM_TOKENS, getPriceRecursive, block);
  if (!includedValue) {
    return records;
  }
  const multiplier = includedValue.div(totalValue);

  // Get the unit rate
  const unitRate = liquidityHandler.getUnitPrice(getPriceRecursive, block);
  if (!unitRate) {
    return records;
  }

  const allWallets = getProtocolAddresses();
  for (let i = 0; i < allWallets.length; i++) {
    const currentWalletAddress = allWallets[i];

    // Get the balance
    const balance = liquidityHandler.getBalance(currentWalletAddress, block);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    // Create record
    const record = createTokenRecord(
      timestamp,
      getContractName(liquidityHandler.getId()),
      liquidityHandler.getId(),
      getContractName(currentWalletAddress),
      currentWalletAddress,
      unitRate,
      balance,
      block,
      getIsTokenLiquid(liquidityHandler.getId(), ERC20_TOKENS_ARBITRUM),
      ERC20_TOKENS_ARBITRUM,
      BLOCKCHAIN,
      multiplier,
    );
    records.push(record);
  }

  return records;
}

/**
 * Gets the balances for all tokens in the category, using {getTokenBalance}.
 *
 * @param timestamp
 * @param blockNumber the current block
 * @returns TokenRecord array
 */
export function getOwnedLiquidityBalances(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (let i = 0; i < PRICE_HANDLERS.length; i++) {
    pushTokenRecordArray(records, getOwnedLiquidityBalance(timestamp, PRICE_HANDLERS[i], blockNumber));
  }

  return records;
}
