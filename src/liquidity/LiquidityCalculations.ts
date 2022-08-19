import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../generated/schema";
import { pushArray } from "../utils/ArrayHelper";
import {
  getContractName,
  getWalletAddressesForContract,
  LIQUIDITY_OWNED,
} from "../utils/Constants";
import { getUniswapV2Pair, getUniswapV2PairBalance } from "../utils/ContractHelper";
import { toDecimal } from "../utils/Decimals";
import { PairHandler, PairHandlerTypes } from "../utils/PairHandler";
import { TokenCategoryPOL } from "../utils/TokenDefinition";
import { createOrUpdateTokenRecord, setTokenRecordsMultiplier } from "../utils/TokenRecordHelper";
import { LiquidityBalances } from "./LiquidityBalance";
import { getBalancerRecords } from "./LiquidityBalancer";
import { getCurvePairRecords } from "./LiquidityCurve";
import { getFraxSwapPairRecords } from "./LiquidityFraxSwap";
import { getOhmUSDPairRiskFreeValue, getUniswapV2PairValue } from "./LiquidityUniswapV2";

/**
 * Creates TokenRecords objects for the giving liquidity records.
 *
 * The chief objective of this function is to determine
 * the correct price of the liquidity pool balance.
 *
 * If {riskFree} is true, {getOhmUSDPairRiskFreeValue} is used
 * to determine the value of the pool when OHM = $1.
 *
 * Otherwise, the value of the non-OHM token is determined.
 *
 * @param metricName
 * @param liquidityBalance
 * @param blockNumber
 * @param riskFree
 * @returns
 */
function getLiquidityTokenRecords(
  timestamp: BigInt,
  liquidityBalance: LiquidityBalances,
  blockNumber: BigInt,
  riskFree: boolean,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const contractName = getContractName(liquidityBalance.contract);
  // TODO handle uniswap V3
  // TODO this assumes that the other side of the LP is OHM, which is not always correct (ETH!)
  const lpValue = liquidityBalance.getTotalBalance().equals(BigInt.zero())
    ? BigDecimal.zero()
    : riskFree
    ? getOhmUSDPairRiskFreeValue(
        liquidityBalance.getTotalBalance(),
        liquidityBalance.contract,
        blockNumber,
      )
    : getUniswapV2PairValue(
        liquidityBalance.getTotalBalance(),
        liquidityBalance.contract,
        blockNumber,
      );
  log.debug("getLiquidityTokenRecordsWrapper: LP value for balance {} is {}", [
    liquidityBalance.getTotalBalance().toString(),
    lpValue.toString(),
  ]);

  // The number returned above is the value of the balance of LP, so we need to get the individual unit price
  const lpUnitPrice: BigDecimal = liquidityBalance.getTotalBalance().equals(BigInt.zero())
    ? BigDecimal.zero()
    : lpValue.div(toDecimal(liquidityBalance.getTotalBalance(), 18));
  log.debug("getLiquidityTokenRecordsWrapper: Unit price: {}", [lpUnitPrice.toString()]);

  const addresses = liquidityBalance.getAddresses();
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const balance = liquidityBalance.getBalance(address);
    if (!balance || balance.equals(BigInt.zero())) continue;

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        contractName,
        liquidityBalance.contract,
        getContractName(address),
        address,
        lpUnitPrice,
        toDecimal(balance, 18),
        blockNumber,
        true,
        BigDecimal.fromString("1"),
        TokenCategoryPOL,
      ),
    );
  }

  return records;
}

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
 * - Curve
 * - Balancer
 *
 * @param metricName
 * @param tokenAddress the address of the ERC20 token
 * @param riskFree whether the value is risk-free or not
 * @param excludeOhmValue true if the value of OHM in the LP should be excluded
 * @param restrictToTokenValue true if only the value of {tokenAddress} in the LP should be included
 * @param blockNumber current block number
 * @param ownedLiquidityPairs set this to override the array of owned liquidity pairs
 * @returns TokenRecord array
 */
export function getLiquidityBalances(
  timestamp: BigInt,
  tokenAddress: string | null,
  riskFree: boolean,
  excludeOhmValue: boolean,
  restrictToTokenValue: boolean,
  blockNumber: BigInt,
  ownedLiquidityPairs: PairHandler[] = LIQUIDITY_OWNED,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (let j = 0; j < ownedLiquidityPairs.length; j++) {
    const pairHandler = ownedLiquidityPairs[j];
    log.debug("getLiquidityBalances: Working with pair {} ({})", [
      getContractName(pairHandler.getContract()),
      pairHandler.getContract(),
    ]);
    if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
      // TODO shift to getUniswapV2PairRecords()
      const liquidityPair = getUniswapV2Pair(pairHandler.getContract(), blockNumber);
      const liquidityBalance = new LiquidityBalances(pairHandler.getContract());
      const wallets = getWalletAddressesForContract(pairHandler.getContract());

      // Across the different sources, determine the total balance of liquidity pools
      // Uniswap LPs in wallets
      for (let i = 0; i < wallets.length; i++) {
        const currentWallet = wallets[i];
        const balance = getUniswapV2PairBalance(
          liquidityPair,
          currentWallet,
          blockNumber,
          tokenAddress,
        );
        if (!balance || balance.equals(BigInt.zero())) continue;

        log.debug("Found balance {} in wallet {}", [toDecimal(balance).toString(), currentWallet]);
        liquidityBalance.addBalance(currentWallet, balance);
      }

      const currentTokenRecords = getLiquidityTokenRecords(
        timestamp,
        liquidityBalance,
        blockNumber,
        riskFree,
      );

      // UniswapV2 only supports a pair, so we can safely apply the multiplier
      if (excludeOhmValue || (tokenAddress && restrictToTokenValue)) {
        log.info("getLiquidityBalances: setting multiplier to 0.5 for UniswapV2 pair {}", [
          getContractName(pairHandler.getContract()),
        ]);
        setTokenRecordsMultiplier(currentTokenRecords, BigDecimal.fromString("0.5"));
      }

      pushArray(records, currentTokenRecords);
    } else if (pairHandler.getType() === PairHandlerTypes.Curve) {
      pushArray(
        records,
        getCurvePairRecords(
          timestamp,
          pairHandler.getContract(),
          tokenAddress,
          excludeOhmValue,
          restrictToTokenValue,
          blockNumber,
        ),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.Balancer) {
      const balancerPoolId = pairHandler.getPool();
      if (balancerPoolId === null) throw new Error("Balancer pair does not have a pool id");

      pushArray(
        records,
        getBalancerRecords(
          timestamp,
          pairHandler.getContract(),
          balancerPoolId,
          excludeOhmValue,
          restrictToTokenValue,
          blockNumber,
          tokenAddress,
        ),
      );
    } else if (pairHandler.getType() === PairHandlerTypes.FraxSwap) {
      pushArray(
        records,
        getFraxSwapPairRecords(
          timestamp,
          pairHandler.getContract(),
          excludeOhmValue,
          restrictToTokenValue,
          blockNumber,
          tokenAddress,
        ),
      );
    } else {
      throw new Error("Unsupported liquidity pair type: " + pairHandler.getType().toString());
    }
  }

  return records;
}

/**
 * Returns the value of owned liquidity pools.
 *
 * @param metricName
 * @param riskFree If `riskFree` is true, the risk-free value will be returned
 * @param excludeOhmValue should be true if only the non-OHM value of the LP is desired
 * @param blockNumber
 * @returns TokenRecord array
 */
export function getOwnedLiquidityPoolValue(
  timestamp: BigInt,
  riskFree: boolean,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): TokenRecord[] {
  log.info("Calculating liquidity pool value", []);
  const records: TokenRecord[] = [];

  pushArray(
    records,
    getLiquidityBalances(timestamp, null, riskFree, excludeOhmValue, false, blockNumber),
  );

  return records;
}
