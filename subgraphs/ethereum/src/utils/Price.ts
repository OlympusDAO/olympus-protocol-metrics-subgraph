import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { TokenCategoryStable } from "../../../shared/src/contracts/TokenDefinition";
import { arrayIncludesLoose } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import {
  isTokenAddressInCategory,
} from "../../../shared/src/utils/TokenRecordHelper";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { getBalancerPoolTotalValue, getOrCreateBalancerPoolSnapshot } from "../liquidity/LiquidityBalancer";
import { getUniswapV2PairTotalValue } from "../liquidity/LiquidityUniswapV2";
import {
  BALANCER_VAULT,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_TOKENS,
  ERC20_UST,
  ERC20_UST_BLOCK_DEATH,
  ERC20_WETH,
  getContractName,
  getPairHandler,
  getUnstakedToken,
  NATIVE_ETH,
  OHM_PRICE_PAIRS,
} from "./Constants";
import { getERC20, getERC20Decimals, getUniswapV3Pair } from "./ContractHelper";
import { PairHandler, PairHandlerTypes } from "./PairHandler";
import {
  BASE_TOKEN_UNKNOWN,
  getBaseEthUsdRate,
  getBaseTokenIndex,
  getBaseTokenOrientation,
  getBaseTokenRate,
  getBaseTokenUSDRate,
  PairTokenBaseOrientation,
} from "./PriceBase";

const BIG_DECIMAL_1E9 = BigDecimal.fromString("1e9");

/**
 * Determines the non-OHM value of the given pair.
 *
 * @param pairHandler
 * @param blockNumber
 * @returns
 */
function getPairHandlerNonOhmValue(
  pairHandler: PairHandler,
  blockNumber: BigInt,
): BigDecimal | null {
  const pairHandlerPool = pairHandler.getPool();
  if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
    const poolNonOhmValue = getUniswapV2PairTotalValue(pairHandler.getContract(), true, blockNumber);
    if (poolNonOhmValue.equals(BigDecimal.zero())) {
      log.info(
        "getPairHandlerNonOhmValue: unable to determine non-OHM value for UniswapV2 pool {} ({}) at block {}. Skipping",
        [
          getContractName(pairHandler.getContract()),
          pairHandler.getContract(),
          blockNumber.toString(),
        ],
      );
      return null;
    }

    return poolNonOhmValue;
  } else if (pairHandler.getType() === PairHandlerTypes.Balancer && pairHandlerPool !== null) {
    log.debug(
      "getPairHandlerNonOhmValue: checking for the non-OHM value of Balancer pool {} ({}) at block {}",
      [getContractName(pairHandlerPool), pairHandlerPool, blockNumber.toString()],
    );
    const totalValue = getBalancerPoolTotalValue(pairHandler.getContract(), pairHandlerPool, true, blockNumber);
    if (totalValue.equals(BigDecimal.zero())) {
      return null;
    }

    return totalValue;
  }

  return null;
}

/**
 * Uses the UniswapV2 pool at {contractAddress} to determine the price of OHM,
 * relative to USD.
 *
 * It uses the following basis of liquidity pools:
 *
 * number of token1 * price of token1 = number of token2 * price of token2
 *
 * In the case of a DAI-OHM pair, we know the following:
 * - number of DAI (using getReserves())
 * - number of OHM (using getReserves())
 * - price of DAI (1)
 *
 * Therefore the price of OHM is:
 *
 * number of DAI * 1 / number of OHM = price of OHM
 *
 * @returns Price of OHM in USD
 */
export function getBaseOhmUsdRateUniswapV2(
  contractAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(contractAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
      contractAddress +
      " does not exist at block " +
      blockNumber.toString(),
    );
  }

  const reserves = pair.getReserves();
  const ohmReserves = reserves.value0.toBigDecimal();
  const daiReserves = reserves.value1.toBigDecimal();

  const ohmRate = daiReserves.div(ohmReserves).div(BIG_DECIMAL_1E9);
  log.debug("getBaseOhmUsdRateUniswapV2: OHM rate {}", [ohmRate.toString()]);

  return ohmRate;
}

/**
 * Returns the rate of {contractAddress} in USD,
 * using a UniswapV3 pool.
 *
 * If the specified pool cannot be found, an error will be thrown.
 * If the pool contract reverts (such as being before the starting block),
 * a rate of 0 will be returned.
 *
 * @param contractAddress
 * @param pairAddress
 * @param blockNumber
 * @returns
 */
export function getUSDRateUniswapV3(
  contractAddress: string,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  log.debug("getUSDRateUniswapV3: contract {}, pair {}", [contractAddress, pairAddress]);
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " + pairAddress + " does not exist yet.",
    );
  }

  if (pair.try_token0().reverted) {
    log.warning(
      "getUSDRateUniswapV3: UniswapV3 pair {} ({}) does not exist at block {}. Returning 0",
      [pairAddress, getContractName(pairAddress), blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  // Determine pair orientation
  const token0 = pair.token0();
  const token1 = pair.token1();
  const baseTokenOrientation = getBaseTokenOrientation(token0, token1);
  if (baseTokenOrientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "Unsure how to deal with unknown token base orientation for pair " + pairAddress,
    );
  }
  log.debug("getUSDRateUniswapV3: Token orientation is {}", [baseTokenOrientation.toString()]);

  // slot0 = "The current price of the pool as a sqrt(token1/token0) Q64.96 value"
  // Source: https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0
  // https://docs.uniswap.org/sdk/guides/fetching-prices
  let priceETH = pair.slot0().value0.times(pair.slot0().value0).toBigDecimal();
  const priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal();
  priceETH = priceETH.div(priceDiv);

  // Get the number of tokens denominated in ETH/OHM/USD
  const baseTokenNumerator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? BigDecimal.fromString("1").div(priceETH)
      : priceETH;

  // Multiply by difference in decimals
  const token0Contract = getERC20(token0.toHexString(), blockNumber);
  const token1Contract = getERC20(token1.toHexString(), blockNumber);
  if (!token0Contract) {
    log.warning("getUSDRateUniswapV3: Unable to obtain ERC20 for token {} at block {}", [
      token0.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }
  if (!token1Contract) {
    log.warning("getUSDRateUniswapV3: Unable to obtain ERC20 for token {} at block {}", [
      token1.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }

  // If there is a difference between the decimal places of the two tokens, adjust for that
  const decimalDifference: i32 =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token1Contract.decimals() - token0Contract.decimals()
      : token0Contract.decimals() - token1Contract.decimals();
  const decimalDifferenceAbs: u8 = u8(abs(decimalDifference));
  const decimalDifferencePow: BigDecimal = BigInt.fromI32(10)
    .pow(decimalDifferenceAbs)
    .toBigDecimal();
  const adjustedNumerator = (
    decimalDifference < 0
      ? BigDecimal.fromString("1").div(decimalDifferencePow)
      : decimalDifferencePow
  ).times(baseTokenNumerator);
  log.debug("getUSDRateUniswapV3: original numerator {}", [baseTokenNumerator.toString()]);
  log.debug("getUSDRateUniswapV3: adjusted numerator {}", [adjustedNumerator.toString()]);

  const baseTokenUsdRate = getBaseTokenUSDRate(token0, token1, baseTokenOrientation, blockNumber);
  log.debug("getUSDRateUniswapV3: base token rate of {}", [baseTokenUsdRate.toString()]);

  const finalUsdRate = adjustedNumerator.times(baseTokenUsdRate);
  log.debug("getUSDRateUniswapV3: determined rate of {} for contract {} ({})", [
    finalUsdRate.toString(),
    getContractName(contractAddress),
    contractAddress,
  ]);
  return finalUsdRate;
}

function getTokenIndex(tokenAddress: string, addresses: Bytes[]): i32 {
  for (let i = 0; i < addresses.length; i++) {
    if (tokenAddress.toLowerCase() == addresses[i].toHexString().toLowerCase()) {
      return i;
    }
  }

  return BASE_TOKEN_UNKNOWN;
}

/**
 * Returns the USD rate for {contractAddress}, using the Balancer pool
 * as a lookup method.
 *
 * The formula for determining the price is here: https://dev.balancer.fi/resources/pool-math/weighted-math#spot-price
 *
 * @param contractAddress
 * @param vaultAddress
 * @param poolId
 * @param blockNumber
 * @returns
 */
export function getUSDRateBalancer(
  contractAddress: string,
  vaultAddress: string,
  poolId: string,
  blockNumber: BigInt,
): BigDecimal {
  log.debug("getUSDRateBalancer: contract {}, poolId {}", [contractAddress, poolId]);

  const poolSnapshot = getOrCreateBalancerPoolSnapshot(poolId, vaultAddress, blockNumber);
  if (!poolSnapshot) {
    return BigDecimal.zero();
  }

  // Get token weights
  const tokens = poolSnapshot.tokens;

  // Get pair orientation
  log.debug("getUSDRateBalancer: determining pair orientation", []);
  const baseTokenIndex = getBaseTokenIndex(tokens);
  if (baseTokenIndex === BASE_TOKEN_UNKNOWN) {
    throw new Error(
      `getUSDRateBalancer: Unsure how to deal with unknown token base orientation for Balancer pool ${poolId}`
    );
  }
  log.debug("getUSDRateBalancer: base token is at index {}", [baseTokenIndex.toString()]);

  // Ensure we have the unstaked token (or else looking for the index can fail)
  // e.g. if using AURA-WETH as price lookup for vlAURA
  const unstakedToken = getUnstakedToken(contractAddress);
  const destinationTokenIndex = getTokenIndex(unstakedToken, tokens);
  if (destinationTokenIndex === BASE_TOKEN_UNKNOWN) {
    throw new Error(
      `getUSDRateBalancer: Unsure how to deal with unknown destination token orientation for Balancer pool '${poolId}', contractAddress '${getContractName(contractAddress)}' (${contractAddress})`
    );
  }
  log.debug("getUSDRateBalancer: destination token is at index {}", [destinationTokenIndex.toString()]);

  const baseToken: Bytes = tokens[baseTokenIndex];
  log.debug("getUSDRateBalancer: base token is {} ({})", [
    baseToken.toHexString(),
    getContractName(baseToken.toHexString()),
  ]);

  const balances = poolSnapshot.balances;
  const baseTokenReserves = balances[baseTokenIndex];
  const destinationTokenReserves = balances[destinationTokenIndex];
  // If the reserves are 0, then we can't find out the price
  if (baseTokenReserves.equals(BigDecimal.zero()) || destinationTokenReserves.equals(BigDecimal.zero())) {
    log.debug("getUSDRateBalancer: reserves are 0. Skipping", []);
    return BigDecimal.zero();
  }

  const tokenWeights = poolSnapshot.weights;
  const baseTokenWeight: BigDecimal = tokenWeights[baseTokenIndex];
  const destinationTokenWeight: BigDecimal = tokenWeights[destinationTokenIndex];
  log.debug("getUSDRateBalancer: base token weight {}, destination token weight {}", [
    baseTokenWeight.toString(),
    destinationTokenWeight.toString(),
  ]);

  const baseTokenUsdRate = getBaseTokenRate(Address.fromBytes(baseToken), blockNumber);
  log.debug("getUSDRateBalancer: baseTokenUsdRate for {} ({}) is {}", [
    getContractName(baseToken.toHexString()),
    baseToken.toHexString(),
    baseTokenUsdRate.toString(),
  ]);

  // Get the non-base token in terms of the base token (since we know the rate)
  const numerator = baseTokenReserves.div(baseTokenWeight);
  const denominator = destinationTokenReserves.div(destinationTokenWeight);
  const rate = numerator.div(denominator).times(baseTokenUsdRate);
  log.info("getUSDRateBalancer: numerator {}, denominator {}, base token USD rate {}, USD rate {}", [
    numerator.toString(),
    denominator.toString(),
    baseTokenUsdRate.toString(),
    rate.toString(),
  ]);
  return rate;
}

/**
 * Determines the price for OHM denominated in USD.
 *
 * The sources for the price are defined in {OHM_PRICE_PAIRS}.
 * The pair with the greatest non-OHM reserves will be used.
 *
 * @param blockNumber
 * @returns
 */
export function getBaseOhmUsdRate(blockNumber: BigInt): BigDecimal {
  log.debug("getBaseOhmUsdRate: determining OHM-USD rate at block {}", [blockNumber.toString()]);
  let largestPairIndex = -1;
  let largestPairValue: BigDecimal | null = null;

  // Iterate through and find the pair with the largest non-OHM value
  for (let i = 0; i < OHM_PRICE_PAIRS.length; i++) {
    const pairTotalValue = getPairHandlerNonOhmValue(OHM_PRICE_PAIRS[i], blockNumber);
    // No value is returned if the pair is not (yet) valid
    if (!pairTotalValue) {
      continue;
    }

    // If there is an existing largest value, but pairTotalValue is less than that, do nothing
    if (largestPairValue && pairTotalValue <= largestPairValue) {
      continue;
    }

    largestPairIndex = i;
    largestPairValue = pairTotalValue;
  }

  if (largestPairIndex < 0) {
    throw new Error(
      "getBaseOhmUsdRate: Unable to find liquidity pool suitable for determining the OHM price at block " +
      blockNumber.toString(),
    );
  }

  const pairHandler = OHM_PRICE_PAIRS[largestPairIndex];
  const pairHandlerBalancerPool = pairHandler.getPool();

  // TODO consider merging with the pair handler / function mapping in getUSDRate()
  if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
    return getBaseOhmUsdRateUniswapV2(pairHandler.getContract(), blockNumber);
  } else if (
    pairHandler.getType() === PairHandlerTypes.Balancer &&
    pairHandlerBalancerPool !== null
  ) {
    return getUSDRateBalancer(
      ERC20_OHM_V2,
      pairHandler.getContract(),
      pairHandlerBalancerPool,
      blockNumber,
    );
  }

  throw new Error(
    `getBaseOhmUsdRate: pair handler type ${pairHandler.getType()} with contract ${getContractName(
      pairHandler.getContract(),
    )} (${pairHandler.getContract()}) is unsupported`,
  );
}

/**
 * Returns the USD rate of the token represented by {contractAddress},
 * given the UniswapV2 pair {pairAddress}.
 *
 * This will dynamically determine which of the pair tokens is the base
 * token (wETH or OHM).
 *
 * After the base token has been determined, the following formula is used
 * to determine the USD rate of the other token.
 *
 * e.g. taking the ETH-TRIBE pair:
 * TRIBE balance = 40,537.42936106
 * ETH balance = 4.99923661
 *
 * (ETH balance / TRIBE balance) * (ETH price) = TRIBE price
 * (4.99923661 / 40537.42936106) * 2000 = 0.24
 *
 * TODO: mention p1 * q1 = p2 * q2
 *
 * @param contractAddress
 * @param pairAddress
 * @returns
 */
export function getUSDRateUniswapV2(
  contractAddress: string,
  pairAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  log.debug("getUSDRateUniswapV2: contract {}, pair {}", [contractAddress, pairAddress]);
  if (Address.fromString(contractAddress).equals(Address.fromString(ERC20_WETH))) {
    log.debug("getUSDRateUniswapV2: Returning base ETH-USD rate", []);
    return getBaseEthUsdRate();
  }
  if (
    Address.fromString(contractAddress).equals(Address.fromString(ERC20_OHM_V1)) ||
    Address.fromString(contractAddress).equals(Address.fromString(ERC20_OHM_V2))
  ) {
    log.debug("getUSDRateUniswapV2: Returning base OHM-USD rate", []);
    return getBaseOhmUsdRate(blockNumber);
  }
  if (isTokenAddressInCategory(contractAddress, TokenCategoryStable, ERC20_TOKENS)) {
    log.debug("getUSDRateUniswapV2: Returning stablecoin rate of 1", []);
    return BigDecimal.fromString("1");
  }

  const pair = UniswapV2Pair.bind(Address.fromString(pairAddress));
  if (pair === null || pair.try_token0().reverted || pair.try_token1().reverted) {
    log.debug(
      "getUSDRateUniswapV2: Cannot determine value as the contract ({}) reverted at block {}",
      [getContractName(pairAddress), blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  // Determine orientation of the pair
  log.debug("getUSDRateUniswapV2: determining pair orientation", []);
  const token0 = pair.token0();
  const token1 = pair.token1();
  const baseTokenOrientation = getBaseTokenOrientation(token0, token1);
  if (baseTokenOrientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "getUSDRateUniswapV2: Unsure how to deal with unknown token base orientation for pair " +
      pairAddress,
    );
  }

  log.debug("getUSDRateUniswapV2: getting ERC20 token decimals", []);
  const token0Decimals = getERC20Decimals(token0.toHexString(), blockNumber);
  const token1Decimals = getERC20Decimals(token1.toHexString(), blockNumber);

  log.debug("getUSDRateUniswapV2: getting pair reserves", []);
  const token0Reserves = toDecimal(pair.getReserves().value0, token0Decimals);
  const token1Reserves = toDecimal(pair.getReserves().value1, token1Decimals);
  // Get the number of tokens denominated in ETH/OHM
  const baseTokenNumerator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token0Reserves.div(token1Reserves)
      : token1Reserves.div(token0Reserves);

  const baseTokenUsdRate = getBaseTokenUSDRate(token0, token1, baseTokenOrientation, blockNumber);
  log.debug("getUSDRateUniswapV2: baseTokenUsdRate for {} ({}) is {}", [
    getContractName(contractAddress),
    contractAddress,
    baseTokenUsdRate.toString(),
  ]);

  return baseTokenNumerator.times(baseTokenUsdRate);
}

/**
 * Determines the USD value of the given token.
 *
 * This is achieved using the prices in liquidity pool pairs.
 *
 * If no pair handler is found, an error will be thrown. This is so
 * that indexing fails in a noticeable manner. The alternative
 * was to return 0, which would be non-obvious and would require
 * parsing the component metrics to identify problems.
 *
 * @param contractAddress the token to look for
 * @returns BigDecimal or 0
 */
export function getUSDRate(contractAddress: string, blockNumber: BigInt): BigDecimal {
  // Value UST at 0 from May 9th onwards
  if (
    contractAddress.toLowerCase() == ERC20_UST.toLowerCase() &&
    blockNumber.gt(BigInt.fromString(ERC20_UST_BLOCK_DEATH))
  ) {
    log.debug("getUSDRate: Returning $0 for UST after collapse", []);
    return BigDecimal.fromString("0");
  }

  // Handle stablecoins
  if (isTokenAddressInCategory(contractAddress, TokenCategoryStable, ERC20_TOKENS)) {
    log.debug("getUSDRate: Contract address {} is a stablecoin. Returning 1.", [contractAddress]);
    return BigDecimal.fromString("1");
  }

  // Handle OHM separately, as we have multiple liquidity pools
  if (arrayIncludesLoose([ERC20_OHM_V1, ERC20_OHM_V2], contractAddress)) {
    log.debug("getUSDRate: Contract address {} is OHM. Returning OHM rate.", [contractAddress]);
    return getBaseOhmUsdRate(blockNumber);
  }

  // Handle native ETH
  if (contractAddress == NATIVE_ETH) {
    log.debug("getUSDRate: Contract address {} is native ETH. Returning wETH rate.", [
      contractAddress,
    ]);
    return getBaseEthUsdRate();
  }

  // Look for the pair
  const pairHandler = getPairHandler(contractAddress);
  if (!pairHandler) {
    throw new Error(
      "getUSDRate: Unable to find liquidity pool handler for contract: " + contractAddress,
    );
  }

  if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
    return getUSDRateUniswapV2(contractAddress, pairHandler.getContract(), blockNumber);
  }

  if (pairHandler.getType() === PairHandlerTypes.UniswapV3) {
    return getUSDRateUniswapV3(contractAddress, pairHandler.getContract(), blockNumber);
  }

  const balancerPoolId = pairHandler.getPool();
  if (pairHandler.getType() === PairHandlerTypes.Balancer && balancerPoolId !== null) {
    return getUSDRateBalancer(contractAddress, BALANCER_VAULT, balancerPoolId, blockNumber);
  }

  throw new Error(
    "getUSDRate: Unsupported liquidity pool handler type (" +
    pairHandler.getType().toString() +
    ") for contract: " +
    contractAddress,
  );
}
