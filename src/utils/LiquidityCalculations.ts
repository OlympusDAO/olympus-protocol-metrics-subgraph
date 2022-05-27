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
import { LiquidityBalances } from "./LiquidityBalance";

function getLiquidityBalance(
  liquidityBalance: LiquidityBalances,
  blockNumber: BigInt,
  riskFree: boolean,
): TokenRecords {
  const records = new TokenRecords([]);
  const contractName = getContractName(liquidityBalance.contract);
  const price = riskFree
    ? getDiscountedPairUSD(liquidityBalance.getTotalBalance(), liquidityBalance.contract)
    : getPairUSD(liquidityBalance.getTotalBalance(), liquidityBalance.contract, blockNumber);

  const addresses = liquidityBalance.getAddresses();
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const balance = liquidityBalance.getBalance(address);
    if (!balance) continue;

    records.push(
      new TokenRecord(
        contractName,
        getContractName(address),
        address,
        price,
        toDecimal(balance, 18),
      ),
    );
  }

  return records;
}

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
  const liquidityBalance = new LiquidityBalances(SUSHI_OHMDAI_PAIR);
  const ohmDaiLiquidityPair = getUniswapV2Pair(SUSHI_OHMDAI_PAIR, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );
  liquidityBalance.addBalance(
    ONSEN_ALLOCATOR,
    getMasterChefBalance(
      getMasterChef(SUSHI_MASTERCHEF, blockNumber),
      ONSEN_ALLOCATOR,
      OHMDAI_ONSEN_ID,
      blockNumber,
    ),
  );

  return getLiquidityBalance(liquidityBalance, blockNumber, riskFree);
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
  const liquidityBalance = new LiquidityBalances(SUSHI_OHMDAI_PAIRV2);
  const ohmDaiLiquidityPair = getUniswapV2Pair(SUSHI_OHMDAI_PAIRV2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityBalance(liquidityBalance, blockNumber, riskFree);
}
