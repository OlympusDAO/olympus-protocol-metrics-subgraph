import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { TokenCategoryPOL } from "../../../shared/src/contracts/TokenDefinition";
import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerUniswapV3 } from "../../../shared/src/price/PriceHandlerUniswapV3";
import { arrayIncludesLoose, pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import {
  createTokenRecord,
  getIsTokenLiquid,
} from "../../../shared/src/utils/TokenRecordHelper";
import { BLOCKCHAIN, ERC20_TOKENS_BASE, OHM_TOKENS, PROTOCOL_ADDRESSES } from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { getPrice, getPriceRecursive, PRICE_HANDLERS } from "../price/PriceLookup";

function getOwnedLiquidityBalanceUniswapV3(
  timestamp: BigInt,
  liquidityHandler: PriceHandlerUniswapV3,
  block: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const tokens = liquidityHandler.getTokens();
  const token0IsOhm = arrayIncludesLoose(OHM_TOKENS, tokens[0]);
  const token1IsOhm = arrayIncludesLoose(OHM_TOKENS, tokens[1]);

  // Determine the prices of the underlying tokens
  const token0Price = getPrice(tokens[0], block);
  const token1Price = getPrice(tokens[1], block);

  // Iterate over the protocol addresses
  for (let i = 0; i < PROTOCOL_ADDRESSES.length; i++) {
    const currentWalletAddress = PROTOCOL_ADDRESSES[i];

    // Get the balance of the underlying tokens
    const token0Balance = liquidityHandler.getUnderlyingTokenBalance(
      currentWalletAddress,
      tokens[0],
      block,
    );
    const token1Balance = liquidityHandler.getUnderlyingTokenBalance(
      currentWalletAddress,
      tokens[1],
      block,
    );

    // Calculate the total value of the underlying tokens
    const totalValue = token0Balance.times(token0Price).plus(token1Balance.times(token1Price));
    if (totalValue.equals(BigDecimal.zero())) {
      continue;
    }

    // Calculate the multiplier used when excluding the OHM token(s)
    const multiplier = (token0IsOhm ? BigDecimal.fromString("0") : token0Balance.times(token0Price)).plus(token1IsOhm ? BigDecimal.fromString("0") : token1Balance.times(token1Price)).div(totalValue);

    // Create the record
    records.push(
      createTokenRecord(
        timestamp,
        getContractName(liquidityHandler.getId()),
        liquidityHandler.getId(),
        getContractName(currentWalletAddress),
        currentWalletAddress,
        totalValue,
        BigDecimal.fromString("1"),
        block,
        true,
        ERC20_TOKENS_BASE,
        BLOCKCHAIN,
        multiplier,
        TokenCategoryPOL,
      )
    );
  }

  return records;
}

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

  // If the handler is UniswapV3, the approach is slightly different
  if (liquidityHandler instanceof PriceHandlerUniswapV3) {
    return getOwnedLiquidityBalanceUniswapV3(timestamp, liquidityHandler as PriceHandlerUniswapV3, block);
  }

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

  for (let i = 0; i < PROTOCOL_ADDRESSES.length; i++) {
    const currentWalletAddress = PROTOCOL_ADDRESSES[i];

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
      getIsTokenLiquid(liquidityHandler.getId(), ERC20_TOKENS_BASE),
      ERC20_TOKENS_BASE,
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
