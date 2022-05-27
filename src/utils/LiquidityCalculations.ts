import { BigInt } from "@graphprotocol/graph-ts";

import {
  getContractName,
  OHMDAI_ONSEN_ID,
  ONSEN_ALLOCATOR,
  SUSHI_MASTERCHEF,
  SUSHI_OHMDAI_PAIR,
  SUSHI_OHMDAI_PAIRV2,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
} from "./Constants";
import {
  getMasterChef,
  getMasterChefBalance,
  getUniswapV2Pair,
  getUniswapV2PairBalance,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getDiscountedPairUSD, getPairUSD } from "./Price";
import { TokenRecord, TokenRecords } from "./TokenRecord";

/**
 * Returns the balance of the OHM-DAI liquidity pair.
 *
 * This includes:
 * - OHM-DAI in the treasury wallet
 * - OHM-DAI in the treasury wallet V2
 * - OHM-DAI in the treasury wallet V3
 * - OHM-DAI in the Onsen allocator
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmDaiLiquidityBalance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const records = new TokenRecords([]);
  const contractName = getContractName(SUSHI_OHMDAI_PAIR);
  const treasuryV1Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIR, blockNumber),
    TREASURY_ADDRESS,
    blockNumber,
  );
  const treasuryV2Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIR, blockNumber),
    TREASURY_ADDRESS_V2,
    blockNumber,
  );
  const treasuryV3Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIR, blockNumber),
    TREASURY_ADDRESS_V3,
    blockNumber,
  );
  const onsenBalance = getMasterChefBalance(
    getMasterChef(SUSHI_MASTERCHEF, blockNumber),
    ONSEN_ALLOCATOR,
    OHMDAI_ONSEN_ID,
    blockNumber,
  );
  const treasuryTotalBalance = treasuryV1Balance
    .plus(treasuryV2Balance)
    .plus(treasuryV3Balance)
    .plus(onsenBalance);
  const price = riskFree
    ? getDiscountedPairUSD(treasuryTotalBalance, SUSHI_OHMDAI_PAIR)
    : getPairUSD(treasuryTotalBalance, SUSHI_OHMDAI_PAIR, blockNumber);

  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS),
      TREASURY_ADDRESS,
      price,
      toDecimal(treasuryV1Balance, 18),
    ),
  );
  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS_V2),
      TREASURY_ADDRESS_V2,
      price,
      toDecimal(treasuryV2Balance, 18),
    ),
  );
  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS_V3),
      TREASURY_ADDRESS_V3,
      price,
      toDecimal(treasuryV3Balance, 18),
    ),
  );
  records.push(
    new TokenRecord(
      contractName,
      getContractName(ONSEN_ALLOCATOR),
      ONSEN_ALLOCATOR,
      price,
      toDecimal(onsenBalance, 18),
    ),
  );

  return records;
}

/**
 * Returns the balance of the OHM-DAI liquidity pair V2.
 *
 * This includes:
 * - OHM-DAI in the treasury wallet
 * - OHM-DAI in the treasury wallet V2
 * - OHM-DAI in the treasury wallet V3
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmDaiLiquidityV2Balance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const records = new TokenRecords([]);
  const contractName = getContractName(SUSHI_OHMDAI_PAIRV2);

  // We need to calculate the balances first, so that we can calculate the price of the pair.
  const treasuryV1Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIRV2, blockNumber),
    TREASURY_ADDRESS,
    blockNumber,
  );
  const treasuryV2Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIRV2, blockNumber),
    TREASURY_ADDRESS_V2,
    blockNumber,
  );
  const treasuryV3Balance = getUniswapV2PairBalance(
    getUniswapV2Pair(SUSHI_OHMDAI_PAIRV2, blockNumber),
    TREASURY_ADDRESS_V3,
    blockNumber,
  );
  const treasuryTotalBalance = treasuryV1Balance.plus(treasuryV2Balance).plus(treasuryV3Balance);
  const price = riskFree
    ? getDiscountedPairUSD(treasuryTotalBalance, SUSHI_OHMDAI_PAIRV2)
    : getPairUSD(treasuryTotalBalance, SUSHI_OHMDAI_PAIRV2, blockNumber);

  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS),
      TREASURY_ADDRESS,
      price,
      toDecimal(treasuryV1Balance, 18),
    ),
  );
  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS_V2),
      TREASURY_ADDRESS_V2,
      price,
      toDecimal(treasuryV2Balance, 18),
    ),
  );
  records.push(
    new TokenRecord(
      contractName,
      getContractName(TREASURY_ADDRESS_V3),
      TREASURY_ADDRESS_V3,
      price,
      toDecimal(treasuryV3Balance, 18),
    ),
  );

  return records;
}
