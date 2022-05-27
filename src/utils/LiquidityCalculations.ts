import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import {
  getContractName,
  OHMDAI_ONSEN_ID,
  ONSEN_ALLOCATOR,
  SUSHI_MASTERCHEF,
  SUSHI_OHMDAI_PAIR,
  SUSHI_OHMDAI_PAIRV2,
  SUSHI_OHMDAI_PAIRV2_BLOCK,
  SUSHI_OHMLUSD_PAIR,
  SUSHI_OHMLUSD_PAIR_V2,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  UNI_OHMFRAX_PAIR,
  UNI_OHMFRAX_PAIRV2,
} from "./Constants";
import {
  getMasterChef,
  getMasterChefBalance,
  getUniswapV2Pair,
  getUniswapV2PairBalance,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { LiquidityBalances } from "./LiquidityBalance";
import { getDiscountedPairUSD, getPairUSD } from "./Price";
import { TokenRecord, TokenRecords } from "./TokenRecord";

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

/**
 * Returns the protocol-owned liquidity for the current version of the OHM-DAI liquidity pair.
 *
 * This currently includes:
 * - OHM-DAI V1
 * - OHM-DAI V2
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmDaiProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  let balance = BigDecimal.fromString("0");
  let totalSupply = BigDecimal.fromString("1");
  const v1Pair = getUniswapV2Pair(SUSHI_OHMDAI_PAIR, blockNumber);
  const v2Pair = getUniswapV2Pair(SUSHI_OHMDAI_PAIRV2, blockNumber);

  if (v2Pair) {
    balance = getOhmDaiLiquidityV2Balance(blockNumber, false).getBalance();
    totalSupply = toDecimal(v2Pair.totalSupply(), 18);
  } else if (v1Pair) {
    balance = getOhmDaiLiquidityBalance(blockNumber, false).getBalance();
    totalSupply = toDecimal(v1Pair.totalSupply(), 18);
  } else {
    throw new Error(
      "Expected one of the contracts " +
        SUSHI_OHMDAI_PAIR +
        " and " +
        SUSHI_OHMDAI_PAIRV2 +
        " to be available.",
    );
  }

  return balance.div(totalSupply).times(BigDecimal.fromString("100"));
}

/**
 * Returns the balance of the OHM-FRAX liquidity pair.
 *
 * This includes:
 * - OHM-FRAX in the treasury wallet
 * - OHM-FRAX in the treasury wallet V2
 * - OHM-FRAX in the treasury wallet V3
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmFraxLiquidityBalance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(UNI_OHMFRAX_PAIR);
  const ohmFraxLiquidityPair = getUniswapV2Pair(UNI_OHMFRAX_PAIR, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityBalance(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the balance of the OHM-FRAX liquidity pair V2.
 *
 * This includes:
 * - OHM-FRAX in the treasury wallet
 * - OHM-FRAX in the treasury wallet V2
 * - OHM-FRAX in the treasury wallet V3
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmFraxLiquidityV2Balance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(UNI_OHMFRAX_PAIRV2);
  const ohmFraxLiquidityPair = getUniswapV2Pair(UNI_OHMFRAX_PAIRV2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityBalance(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the protocol-owned liquidity for the current version of the OHM-FRAX liquidity pair.
 *
 * This currently includes:
 * - OHM-FRAX V1
 * - OHM-FRAX V2
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmFraxProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  let balance = BigDecimal.fromString("0");
  let totalSupply = BigDecimal.fromString("1");
  const v1Pair = getUniswapV2Pair(UNI_OHMFRAX_PAIR, blockNumber);
  const v2Pair = getUniswapV2Pair(UNI_OHMFRAX_PAIRV2, blockNumber);

  if (v2Pair) {
    balance = getOhmFraxLiquidityV2Balance(blockNumber, false).getBalance();
    totalSupply = toDecimal(v2Pair.totalSupply(), 18);
  } else if (v1Pair) {
    balance = getOhmFraxLiquidityBalance(blockNumber, false).getBalance();
    totalSupply = toDecimal(v1Pair.totalSupply(), 18);
  } else {
    throw new Error(
      "Expected one of the contracts " +
        UNI_OHMFRAX_PAIR +
        " and " +
        UNI_OHMFRAX_PAIRV2 +
        " to be available.",
    );
  }

  return balance.div(totalSupply).times(BigDecimal.fromString("100"));
}

/**
 * Returns the balance of the OHM-LUSD liquidity pair.
 *
 * This includes:
 * - OHM-LUSD in the treasury wallet
 * - OHM-LUSD in the treasury wallet V2
 * - OHM-LUSD in the treasury wallet V3
 * - OHM-LUSD in the Onsen allocator
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmLusdLiquidityBalance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(SUSHI_OHMLUSD_PAIR);
  const ohmLusdLiquidityPair = getUniswapV2Pair(SUSHI_OHMLUSD_PAIR, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmLusdLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmLusdLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmLusdLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
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
 * Returns the balance of the OHM-LUSD liquidity pair V2.
 *
 * This includes:
 * - OHM-LUSD in the treasury wallet
 * - OHM-LUSD in the treasury wallet V2
 * - OHM-LUSD in the treasury wallet V3
 * - OHM-LUSD in the Onsen allocator
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmLusdLiquidityV2Balance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(SUSHI_OHMLUSD_PAIR_V2);
  const ohmFraxLiquidityPair = getUniswapV2Pair(SUSHI_OHMLUSD_PAIR_V2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
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
