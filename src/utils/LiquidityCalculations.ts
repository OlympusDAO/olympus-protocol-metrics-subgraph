import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { CurvePool } from "../../generated/ProtocolMetrics/CurvePool";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  getContractName,
  getLiquidityPairTokens,
  getStakedToken,
  LIQUIDITY_OWNED,
  OHMDAI_ONSEN_ID,
  OHMLUSD_ONSEN_ID,
  ONSEN_ALLOCATOR,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_ETH,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  PAIR_UNISWAP_V2_OHM_FRAX,
  PAIR_UNISWAP_V2_OHM_FRAX_V2,
  PAIR_UNISWAP_V2_OHM_LUSD,
  PAIR_UNISWAP_V2_OHM_LUSD_V2,
  SUSHI_MASTERCHEF,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "./Constants";
import {
  getERC20,
  getMasterChef,
  getMasterChefBalance,
  getUniswapV2Pair,
  getUniswapV2PairBalance,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { LiquidityBalances } from "./LiquidityBalance";
import { getBalancerRecords } from "./LiquidityBalancer";
import { PairHandler, PairHandlerTypes } from "./PairHandler";
import { getOhmUSDPairRiskFreeValue, getUniswapV2PairValue, getUSDRate } from "./Price";
import {
  combineTokenRecords,
  getTokenRecordsBalance,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
  setTokenRecordsMultiplier,
} from "./TokenRecordHelper";

/**
 * Creates TokenRecords for the giving liquidity records.
 *
 * The chief objective of this function is to determine
 * the correct price of the liquidity pool balance.
 *
 * If {riskFree} is true, {getOhmUSDPairRiskFreeValue} is used
 * to determine the value of the pool when OHM = $1.
 *
 * Otherwise, the value of the non-OHM token is determined.
 *
 * @param liquidityBalance
 * @param blockNumber
 * @param riskFree
 * @returns
 */
function getLiquidityTokenRecords(
  liquidityBalance: LiquidityBalances,
  blockNumber: BigInt,
  riskFree: boolean,
): TokenRecords {
  const records = newTokenRecords("Liquidity", blockNumber);
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
  log.debug("LP value for balance {} is {}", [
    liquidityBalance.getTotalBalance().toString(),
    lpValue.toString(),
  ]);

  // The number returned above is the value of the balance of LP, so we need to get the individual unit price
  const lpUnitPrice: BigDecimal = liquidityBalance.getTotalBalance().equals(BigInt.zero())
    ? BigDecimal.zero()
    : lpValue.div(toDecimal(liquidityBalance.getTotalBalance(), 18));
  log.debug("Unit price: {}", [lpUnitPrice.toString()]);

  const addresses = liquidityBalance.getAddresses();
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const balance = liquidityBalance.getBalance(address);
    if (!balance || balance.equals(BigInt.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        contractName,
        liquidityBalance.contract,
        getContractName(address),
        address,
        lpUnitPrice,
        toDecimal(balance, 18),
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns the total value of the given Curve pair.
 *
 * Calculated as: token0 balance * toke0 rate + token1 balance * token rate
 *
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
export function getCurvePairTotalValue(pairAddress: string, blockNumber: BigInt): BigDecimal {
  // Obtain both tokens
  const pair = CurvePool.bind(Address.fromString(pairAddress));
  const token0: string = pair.coins(BigInt.fromI32(0)).toHexString();
  const token0Balance = pair.balances(BigInt.fromI32(0));
  const token0Contract = getERC20(getContractName(token0), token0, blockNumber);
  if (!token0Contract) {
    throw new Error("Unable to fetch ERC20 at address " + token0 + " for Curve pool");
  }
  const token0BalanceDecimal = toDecimal(token0Balance, token0Contract.decimals());

  const token1: string = pair.coins(BigInt.fromI32(1)).toHexString();
  const token1Balance = pair.balances(BigInt.fromI32(1));
  const token1Contract = getERC20(getContractName(token1), token1, blockNumber);
  if (!token1Contract) {
    throw new Error("Unable to fetch ERC20 at address " + token1 + " for Curve pool");
  }
  const token1BalanceDecimal = toDecimal(token1Balance, token1Contract.decimals());

  // token0 balance * token0 rate + token1 balance * token1 rate
  return token0BalanceDecimal
    .times(getUSDRate(token0, blockNumber))
    .plus(token1BalanceDecimal.times(getUSDRate(token1, blockNumber)));
}

/**
 * Returns the TokenRecord for the Curve pair's token
 * at the given {walletAddress}.
 *
 * @param pairAddress Curve pair address
 * @param pairRate the unit rate of the pair
 * @param walletAddress the wallet to look up the balance
 * @param excludeOhmValue true if the value of OHM should be excluded
 * @param blockNumber the current block number
 * @returns
 */
export function getCurvePairRecord(
  pairAddress: string,
  pairRate: BigDecimal,
  walletAddress: string,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): TokenRecord | null {
  const pair = CurvePool.bind(Address.fromString(pairAddress));
  const pairTokenAddress = pair.token().toHexString();
  const pairToken = getERC20(getContractName(pairTokenAddress), pairTokenAddress, blockNumber);
  if (!pairToken) {
    throw new Error("Unable to bind to ERC20 contract for Curve pair token " + pairTokenAddress);
  }

  let tokenBalanceDecimal = BigDecimal.zero();
  let finalTokenAddress = pairTokenAddress;

  // Get the balance of the pair's token in walletAddress
  const pairTokenBalance = pairToken.balanceOf(Address.fromString(walletAddress));
  if (pairTokenBalance.equals(BigInt.zero())) {
    const stakedTokenAddressNullable = getStakedToken(pairTokenAddress);
    // If there's no balance and no staked token, exit
    if (!stakedTokenAddressNullable) {
      log.debug("Curve pair balance for token {} ({}) was 0, and no staked token was found.", [
        getContractName(pairTokenAddress),
        pairTokenAddress,
      ]);
      return null;
    }

    const stakedTokenAddress = stakedTokenAddressNullable ? stakedTokenAddressNullable : "";
    const stakedPairToken = getERC20(
      getContractName(stakedTokenAddress),
      stakedTokenAddress,
      blockNumber,
    );
    if (!stakedPairToken) {
      throw new Error(
        "Unable to bind to ERC20 contract for Curve pair token " + stakedTokenAddress,
      );
    }

    const stakedTokenBalance = stakedPairToken.balanceOf(Address.fromString(walletAddress));
    if (stakedTokenBalance.equals(BigInt.zero())) {
      log.debug("Curve pair balance for staked token {} ({}) was 0.", [
        getContractName(stakedTokenAddress),
        stakedTokenAddress,
      ]);
      return null;
    }

    tokenBalanceDecimal = toDecimal(stakedTokenBalance, stakedPairToken.decimals());
    finalTokenAddress = stakedTokenAddress;
    log.info("Curve pair balance for staked token {} ({}) was {}", [
      getContractName(stakedTokenAddress),
      stakedTokenAddress,
      tokenBalanceDecimal.toString(),
    ]);
  } else {
    tokenBalanceDecimal = toDecimal(pairTokenBalance, pairToken.decimals());
    log.info("Curve pair balance for token {} ({}) was {}", [
      getContractName(pairTokenAddress),
      pairTokenAddress,
      tokenBalanceDecimal.toString(),
    ]);
  }

  return newTokenRecord(
    getContractName(finalTokenAddress),
    finalTokenAddress,
    getContractName(walletAddress),
    walletAddress,
    pairRate,
    tokenBalanceDecimal,
    blockNumber,
    excludeOhmValue ? BigDecimal.fromString("0.5") : BigDecimal.fromString("1"),
  );
}

function getCurvePairToken(pairAddress: string): string {
  const pair = CurvePool.bind(Address.fromString(pairAddress));

  return pair.token().toHexString();
}

/**
 * Calculates the unit rate of the given Curve pair.
 *
 * Each Curve pair has an associated token. The total supply
 * of that token is determined and divides the value to
 * give the unit rate.
 *
 * @param pairAddress Curve pair address
 * @param totalValue total value of the Curve pair
 * @param blockNumber current block
 * @returns
 */
function getCurvePairUnitRate(
  pairAddress: string,
  totalValue: BigDecimal,
  blockNumber: BigInt,
): BigDecimal {
  const pairTokenAddress = getCurvePairToken(pairAddress);
  const pairTokenContract = getERC20(
    getContractName(pairTokenAddress),
    pairTokenAddress,
    blockNumber,
  );
  if (!pairTokenContract) {
    throw new Error("Unable to bind to ERC20 contract for Curve pair token " + pairTokenAddress);
  }

  const totalSupply = toDecimal(pairTokenContract.totalSupply(), pairTokenContract.decimals());
  const unitRate = totalValue.div(totalSupply);
  log.info("Unit rate of Curve LP {} is {} for total supply {}", [
    pairAddress,
    unitRate.toString(),
    totalSupply.toString(),
  ]);
  return unitRate;
}

/**
 * Returns the records for the specified Curve LP.
 *
 * This function does the following:
 * - Calculates the total value of the LP
 * - Calculates the unit rate of the LP
 * - Iterates through {WALLET_ADDRESSES} and adds records
 * for the balance of the LP's token
 *
 * @param pairAddress the address of the Curve pair
 * @param tokenAddress restrict results to match the specified token
 * @param excludeOhmValue true if the value of OHM in the LP should be excluded
 * @param blockNumber the current block number
 * @returns
 */
export function getCurvePairRecords(
  pairAddress: string,
  tokenAddress: string | null,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(getContractName(pairAddress), blockNumber);
  // If we are restricting by token and tokenAddress does not match either side of the pair
  if (tokenAddress && !getLiquidityPairTokens(pairAddress).includes(tokenAddress)) {
    log.debug("Skipping Curve pair that does not match specified token address {}", [tokenAddress]);
    return records;
  }

  // Calculate total value of the LP
  const totalValue = getCurvePairTotalValue(pairAddress, blockNumber);
  log.info("Total value of Curve LP {} is {}", [pairAddress, totalValue.toString()]);

  // Calculate the unit rate of the LP
  const unitRate = getCurvePairUnitRate(pairAddress, totalValue, blockNumber);

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const walletAddress = WALLET_ADDRESSES[i];
    const record = getCurvePairRecord(
      pairAddress,
      unitRate,
      walletAddress,
      excludeOhmValue,
      blockNumber,
    );
    if (!record) continue;

    pushTokenRecord(records, record);
  }

  return records;
}

/**
 * Returns the TokenRecords representing the liquidity owned by the treasury.
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
 * @param tokenAddress the address of the ERC20 token
 * @param riskFree whether the value is risk-free or not
 * @param excludeOhmValue true if the value of OHM in the LP should be excluded
 * @param blockNumber current block number
 * @param ownedLiquidityPairs set this to override the array of owned liquidity pairs
 * @returns TokenRecords object
 */
export function getLiquidityBalances(
  tokenAddress: string | null,
  riskFree: boolean,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
  ownedLiquidityPairs: PairHandler[] = LIQUIDITY_OWNED,
): TokenRecords {
  const records = newTokenRecords("Liquidity", blockNumber);

  for (let j = 0; j < ownedLiquidityPairs.length; j++) {
    const pairHandler = ownedLiquidityPairs[j];
    log.debug("Working with pair {}", [pairHandler.getContract()]);
    if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
      const liquidityPair = getUniswapV2Pair(pairHandler.getContract(), blockNumber);
      const liquidityBalance = new LiquidityBalances(pairHandler.getContract());

      // Across the different sources, determine the total balance of liquidity pools
      // Uniswap LPs in wallets
      for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
        const currentWallet = WALLET_ADDRESSES[i];
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

      const currentTokenRecords = getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);

      if (excludeOhmValue) {
        setTokenRecordsMultiplier(currentTokenRecords, BigDecimal.fromString("0.5"));
      }

      combineTokenRecords(records, currentTokenRecords);
    } else if (pairHandler.getType() === PairHandlerTypes.Curve) {
      // TODO support risk-free value of Curve
      const currentTokenRecords = getCurvePairRecords(
        pairHandler.getContract(),
        tokenAddress,
        excludeOhmValue,
        blockNumber,
      );

      // If the singleSidedValue is desired, we can halve the value of the LP and return that.
      if (excludeOhmValue) {
        setTokenRecordsMultiplier(currentTokenRecords, BigDecimal.fromString("0.5"));
      }

      combineTokenRecords(records, currentTokenRecords);
    } else if (pairHandler.getType() === PairHandlerTypes.Balancer) {
      const balancerPoolIdNullable: string | null = pairHandler.getPool();
      if (balancerPoolIdNullable == null) throw new Error("Balancer pair does not have a pool id");

      // Workaround for AssemblyScript not liking nulls
      const balancerPoolId: string = balancerPoolIdNullable ? balancerPoolIdNullable : "";
      // TODO support risk-free value of Balancer
      combineTokenRecords(
        records,
        getBalancerRecords(
          pairHandler.getContract(),
          balancerPoolId,
          excludeOhmValue,
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_DAI);
  const ohmDaiLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_DAI, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
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

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_DAI_V2);
  const ohmDaiLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_DAI_V2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmDaiLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the protocol-owned liquidity for the latest OHM-DAI liquidity pair.
 *
 * This currently includes:
 * - OHM-DAI V1
 * - OHM-DAI V2
 *
 * The latest pair is the one with both a non-zero total supply and balance.
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmDaiProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  const v1Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_DAI, blockNumber);
  const v2Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_DAI_V2, blockNumber);
  const v1Balance = getTokenRecordsBalance(getOhmDaiLiquidityBalance(blockNumber, false));
  const v2Balance = getTokenRecordsBalance(getOhmDaiLiquidityV2Balance(blockNumber, false));
  const v1TotalSupply: BigInt = v1Pair ? v1Pair.totalSupply() : BigInt.fromString("-1");
  const v2TotalSupply: BigInt = v2Pair ? v2Pair.totalSupply() : BigInt.fromString("-1");

  if (v2Balance.gt(BigDecimal.zero()) && v2TotalSupply.gt(BigInt.zero())) {
    return v2Balance.div(toDecimal(v2TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  if (v1Balance.gt(BigDecimal.zero()) && v1TotalSupply.gt(BigInt.zero())) {
    return v1Balance.div(toDecimal(v1TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  return BigDecimal.zero();
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_FRAX);
  const ohmFraxLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_FRAX, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_FRAX_V2);
  const ohmFraxLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_FRAX_V2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the protocol-owned liquidity for the latest OHM-FRAX liquidity pair.
 *
 * This currently includes:
 * - OHM-FRAX V1
 * - OHM-FRAX V2
 *
 * The latest pair is the one with both a non-zero total supply and balance.
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmFraxProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  const v1Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_FRAX, blockNumber);
  const v2Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_FRAX_V2, blockNumber);
  const v1Balance = getTokenRecordsBalance(getOhmFraxLiquidityBalance(blockNumber, false));
  const v2Balance = getTokenRecordsBalance(getOhmFraxLiquidityV2Balance(blockNumber, false));
  const v1TotalSupply: BigInt = v1Pair ? v1Pair.totalSupply() : BigInt.fromString("-1");
  const v2TotalSupply: BigInt = v2Pair ? v2Pair.totalSupply() : BigInt.fromString("-1");

  if (v2Balance.gt(BigDecimal.zero()) && v2TotalSupply.gt(BigInt.zero())) {
    return v2Balance.div(toDecimal(v2TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  if (v1Balance.gt(BigDecimal.zero()) && v1TotalSupply.gt(BigInt.zero())) {
    return v1Balance.div(toDecimal(v1TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  return BigDecimal.zero();
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_LUSD);
  const ohmLusdLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_LUSD, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmLusdLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
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
      OHMLUSD_ONSEN_ID,
      blockNumber,
    ),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
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
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_LUSD_V2);
  const ohmFraxLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_LUSD_V2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmFraxLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
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
      OHMLUSD_ONSEN_ID,
      blockNumber,
    ),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the protocol-owned liquidity for the latest OHM-LUSD liquidity pair.
 *
 * This currently includes:
 * - OHM-LUSD V1
 * - OHM-LUSD V2
 *
 * The latest pair is the one with both a non-zero total supply and balance.
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmLusdProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  const v1Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_LUSD, blockNumber);
  const v2Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_LUSD_V2, blockNumber);
  const v1Balance = getTokenRecordsBalance(getOhmLusdLiquidityBalance(blockNumber, false));
  const v2Balance = getTokenRecordsBalance(getOhmLusdLiquidityV2Balance(blockNumber, false));
  const v1TotalSupply: BigInt = v1Pair ? v1Pair.totalSupply() : BigInt.fromString("-1");
  const v2TotalSupply: BigInt = v2Pair ? v2Pair.totalSupply() : BigInt.fromString("-1");

  if (v2Balance.gt(BigDecimal.zero()) && v2TotalSupply.gt(BigInt.zero())) {
    return v2Balance.div(toDecimal(v2TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  if (v1Balance.gt(BigDecimal.zero()) && v1TotalSupply.gt(BigInt.zero())) {
    return v1Balance.div(toDecimal(v1TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  return BigDecimal.zero();
}

/**
 * Returns the balance of the OHM-ETH liquidity pair.
 *
 * This includes:
 * - OHM-ETH in the treasury wallet
 * - OHM-ETH in the treasury wallet V2
 * - OHM-ETH in the treasury wallet V3
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmEthLiquidityBalance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_ETH);
  const ohmEthLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_ETH, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the balance of the OHM-ETH liquidity pair V2.
 *
 * This includes:
 * - OHM-ETH in the treasury wallet
 * - OHM-ETH in the treasury wallet V2
 * - OHM-ETH in the treasury wallet V3
 *
 * @param blockNumber the current block number
 * @param riskFree whether the price of the LP is part of risk-free value
 * @returns TokenRecords object
 */
export function getOhmEthLiquidityV2Balance(blockNumber: BigInt, riskFree: boolean): TokenRecords {
  const liquidityBalance = new LiquidityBalances(PAIR_UNISWAP_V2_OHM_ETH_V2);
  const ohmEthLiquidityPair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_ETH_V2, blockNumber);
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V1,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V1, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V2,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V2, blockNumber),
  );
  liquidityBalance.addBalance(
    TREASURY_ADDRESS_V3,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS_V3, blockNumber),
  );

  return getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree);
}

/**
 * Returns the protocol-owned liquidity for the latest OHM-ETH liquidity pair.
 *
 * This currently includes:
 * - OHM-ETH V1
 * - OHM-ETH V2
 *
 * The latest pair is the one with both a non-zero total supply and balance.
 *
 * The value returned corresponds to the percentage, e.g. 80% will return 80 (not 0.8)
 *
 * @param blockNumber
 * @returns BigDecimal representing the percentage of protocol-owned liquidity
 */
export function getOhmEthProtocolOwnedLiquidity(blockNumber: BigInt): BigDecimal {
  const v1Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_ETH, blockNumber);
  const v2Pair = getUniswapV2Pair(PAIR_UNISWAP_V2_OHM_ETH_V2, blockNumber);
  const v1Balance = getTokenRecordsBalance(getOhmEthLiquidityBalance(blockNumber, false));
  const v2Balance = getTokenRecordsBalance(getOhmEthLiquidityV2Balance(blockNumber, false));
  const v1TotalSupply: BigInt = v1Pair ? v1Pair.totalSupply() : BigInt.fromString("-1");
  const v2TotalSupply: BigInt = v2Pair ? v2Pair.totalSupply() : BigInt.fromString("-1");

  if (v2Balance.gt(BigDecimal.zero()) && v2TotalSupply.gt(BigInt.zero())) {
    return v2Balance.div(toDecimal(v2TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  if (v1Balance.gt(BigDecimal.zero()) && v1TotalSupply.gt(BigInt.zero())) {
    return v1Balance.div(toDecimal(v1TotalSupply, 18)).times(BigDecimal.fromString("100"));
  }

  return BigDecimal.zero();
}

/**
 * Returns the value of owned liquidity pools.
 *
 * @param riskFree If `riskFree` is true, the risk-free value will be returned
 * @param excludeOhmValue should be true if only the non-OHM value of the LP is desired
 * @param blockNumber
 * @returns TokenRecords object
 */
export function getLiquidityPoolValue(
  riskFree: boolean,
  excludeOhmValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  log.info("Calculating liquidity pool value", []);
  const records = newTokenRecords("Liquidity Pool Value", blockNumber);

  combineTokenRecords(records, getLiquidityBalances(null, riskFree, excludeOhmValue, blockNumber));

  log.info("Liquidity pool value: {}", [records.value.toString()]);
  return records;
}
