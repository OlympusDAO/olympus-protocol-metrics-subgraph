import { BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { getContractName, LIQUIDITY_OWNED } from "../utils/Constants";
import { PairHandler, PairHandlerTypes } from "../utils/PairHandler";
import { getBalancerRecords } from "./LiquidityBalancer";
import { getCurvePairRecords } from "./LiquidityCurve";
import { getFraxSwapPairRecords } from "./LiquidityFraxSwap";
import { getUniswapV2PairRecords } from "./LiquidityUniswapV2";
import { getUniswapV3POLRecords } from "./LiquidityUniswapV3";

/**
 * Returns the TokenRecord objects representing the liquidity owned by the treasury.
 *
 * By default, all liquidity pairs in {LIQUIDITY_OWNED} will be iterated, unless
 * overridden by the {ownedLiquidityPairs} parameter.
 *
 * If {tokenAddress} is specified, the results will be limited to
 * liquidity pools in which {tokenAddress} is included.
 *
 * This currently supports the following LPs:
 * - Uniswap V2
 * - Uniswap V3
 * - Curve
 * - Balancer
 * - FraxSwap
 *
 * @param metricName
 * @param tokenAddress the address of the ERC20 token
 * @param blockNumber current block number
 * @param ownedLiquidityPairs set this to override the array of owned liquidity pairs
 * @returns TokenRecord array
 */
export function getLiquidityBalances(
  timestamp: BigInt,
  tokenAddress: string | null,
  blockNumber: BigInt,
  ownedLiquidityPairs: PairHandler[] = LIQUIDITY_OWNED,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  log.debug("getLiquidityBalances: Working with {} liquidity pairs", [ownedLiquidityPairs.length.toString()]);

  for (let j = 0; j < ownedLiquidityPairs.length; j++) {
    const pairHandler = ownedLiquidityPairs[j];
    log.debug("getLiquidityBalances: Working with pair {} ({})", [
      getContractName(pairHandler.getContract()),
      pairHandler.getContract(),
    ]);
    if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
      pushTokenRecordArray(
        records,
        getUniswapV2PairRecords(timestamp, pairHandler.getContract(), tokenAddress, blockNumber),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.Curve) {
      pushTokenRecordArray(
        records,
        getCurvePairRecords(timestamp, pairHandler.getContract(), tokenAddress, blockNumber),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.Balancer) {
      const balancerPoolId = pairHandler.getPool();
      if (balancerPoolId === null) throw new Error("Balancer pair does not have a pool id");

      pushTokenRecordArray(
        records,
        getBalancerRecords(
          timestamp,
          pairHandler.getContract(),
          balancerPoolId,
          blockNumber,
          tokenAddress,
        ),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.FraxSwap) {
      pushTokenRecordArray(
        records,
        getFraxSwapPairRecords(timestamp, pairHandler.getContract(), blockNumber, tokenAddress),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.UniswapV3) {
      pushTokenRecordArray(
        records,
        getUniswapV3POLRecords(timestamp, pairHandler.getContract(), tokenAddress, blockNumber),
      )
    }
    else {
      throw new Error("Unsupported liquidity pair type: " + pairHandler.getType().toString());
    }
  }

  log.debug("getLiquidityBalances: Finished with all liquidity pairs", []);
  return records;
}

/**
 * Returns the value of owned liquidity pools.
 *
 * @param metricName
 * @param blockNumber
 * @returns TokenRecord array
 */
export function getOwnedLiquidityPoolValue(timestamp: BigInt, blockNumber: BigInt): TokenRecord[] {
  log.info("getOwnedLiquidityPoolValue: Calculating liquidity pool value", []);
  const records: TokenRecord[] = [];

  pushTokenRecordArray(records, getLiquidityBalances(timestamp, null, blockNumber));

  return records;
}
