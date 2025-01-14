import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { TokenCategoryStable } from "../../../shared/src/contracts/TokenDefinition";
import { getCurrentIndex } from "../../../shared/src/supply/OhmCalculations";
import { arrayIncludesLoose } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import {
  isTokenAddressInCategory,
} from "../../../shared/src/utils/TokenRecordHelper";
import { ERC4626 } from "../../generated/ProtocolMetrics/ERC4626";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { TokenPriceSnapshot } from "../../generated/schema";
import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import { getBalancerPoolTotalValue, getOrCreateBalancerPoolSnapshot } from "../liquidity/LiquidityBalancer";
import { getOrCreateUniswapV2PoolSnapshot, getUniswapV2PairTotalValue } from "../liquidity/LiquidityUniswapV2";
import { getUniswapV3PairTotalValue } from "../liquidity/LiquidityUniswapV3";
import {
  BALANCER_VAULT,
  ERC20_BB_A_USD,
  ERC20_CVX_FRAX_3CRV,
  ERC20_DAI,
  ERC20_FRAX_3CRV,
  ERC20_FRAX_BP,
  ERC20_GOHM,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_TOKENS,
  ERC20_USDC,
  ERC20_UST,
  ERC20_UST_BLOCK_DEATH,
  ERC20_WETH,
  getContractName,
  getPairHandler,
  getUnstakedToken,
  NATIVE_ETH,
  OHM_PRICE_PAIRS,
} from "./Constants";
import { getERC20Decimals, getUniswapV3Pair } from "./ContractHelper";
import { getERC4626Rate } from "./ERC4626";
import { PairHandler, PairHandlerTypes } from "./PairHandler";
import {
  BASE_TOKEN_UNKNOWN,
  getBaseEthUsdRate,
  getBaseTokenIndex,
  getBaseTokenOrientation,
  getBaseTokenRate,
  getBaseTokenUSDRate,
  isBaseToken,
  PairTokenBaseOrientation,
} from "./PriceBase";

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
  } else if (pairHandler.getType() === PairHandlerTypes.UniswapV3) {
    log.debug(
      "getPairHandlerNonOhmValue: checking for the non-OHM value of UniswapV3 pool {} ({}) at block {}",
      [getContractName(pairHandler.getContract()), pairHandler.getContract(), blockNumber.toString()],
    );

    const totalValue = getUniswapV3PairTotalValue(pairHandler.getContract(), true, blockNumber);
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
function getBaseOhmUsdRateUniswapV2(
  contractAddress: string,
  blockNumber: BigInt,
): BigDecimal {
  const snapshot = getOrCreateUniswapV2PoolSnapshot(contractAddress, blockNumber);
  if (!snapshot) {
    throw new Error(
      "getBaseOhmUsdRateUniswapV2: Cannot determine discounted as the contract " +
      contractAddress +
      " does not exist at block " +
      blockNumber.toString(),
    );
  }

  let ohmIndex = -1;
  let daiIndex = -1;

  for (let i = 0; i < snapshot.tokens.length; i++) {
    const currentToken = snapshot.tokens[i];
    if (currentToken.toHexString().toLowerCase() == ERC20_OHM_V2.toLowerCase()) {
      ohmIndex = i;
    }
    else if (currentToken.toHexString().toLowerCase() == ERC20_DAI.toLowerCase()) {
      daiIndex = i;
    }
  }

  if (ohmIndex < 0) {
    throw new Error(`getBaseOhmUsdRateUniswapV2: Could not determine location of OHM token for UniswapV2 pool: ${contractAddress}`);
  }

  if (daiIndex < 0) {
    throw new Error(`getBaseOhmUsdRateUniswapV2: Could not determine location of DAI token for UniswapV2 pool: ${contractAddress}`);
  }

  const ohmReserves = snapshot.balances[ohmIndex];
  const daiReserves = snapshot.balances[daiIndex];

  const ohmRate = daiReserves.div(ohmReserves);
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
  log.debug("getUSDRateUniswapV3: token {}, pair {}", [getContractName(contractAddress), getContractName(pairAddress)]);
  const pair = getUniswapV3Pair(pairAddress, blockNumber);
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the pair contract " + pairAddress + " does not exist yet.",
    );
  }

  // TODO shift to snapshot
  const token0Result = pair.try_token0();
  const token1Result = pair.try_token1();
  const slot0Result = pair.try_slot0();
  if (token0Result.reverted || token1Result.reverted || slot0Result.reverted) {
    log.warning(
      "getUSDRateUniswapV3: UniswapV3 pair {} ({}) does not exist at block {}. Returning 0",
      [pairAddress, getContractName(pairAddress), blockNumber.toString()],
    );
    return BigDecimal.zero();
  }

  // Determine pair orientation
  const token0 = token0Result.value;
  const token1 = token1Result.value;
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
  const slot0 = slot0Result.value;
  let priceETH = slot0.value0.times(slot0.value0).toBigDecimal();
  const priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal();
  priceETH = priceETH.div(priceDiv);

  // Get the number of tokens denominated in ETH/OHM/USD
  const baseTokenNumerator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? BigDecimal.fromString("1").div(priceETH)
      : priceETH;

  // Multiply by difference in decimals
  const token0Snapshot = getOrCreateERC20TokenSnapshot(token0.toHexString(), blockNumber);
  const token1Snapshot = getOrCreateERC20TokenSnapshot(token1.toHexString(), blockNumber);
  if (!token0Snapshot || token0Snapshot.totalSupply === null) {
    log.warning("getUSDRateUniswapV3: Unable to obtain ERC20 for token {} at block {}", [
      token0.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }
  if (!token1Snapshot || token1Snapshot.totalSupply === null) {
    log.warning("getUSDRateUniswapV3: Unable to obtain ERC20 for token {} at block {}", [
      token1.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }

  // If there is a difference between the decimal places of the two tokens, adjust for that
  const decimalDifference: i32 =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token1Snapshot.decimals - token0Snapshot.decimals
      : token0Snapshot.decimals - token1Snapshot.decimals;
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
  log.debug("getUSDRateUniswapV3: determined rate of {} for token {} ({})", [
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
  log.debug("getUSDRateBalancer: contract {}, poolId {}", [getContractName(contractAddress), poolId]);

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
  log.debug("getUSDRateBalancer: token {}, numerator {}, denominator {}, base token USD rate {}, USD rate {}", [
    getContractName(contractAddress),
    numerator.toString(),
    denominator.toString(),
    baseTokenUsdRate.toString(),
    rate.toString(),
  ]);
  log.info("getUSDRateBalancer: token {} at block {} has rate {}", [getContractName(contractAddress), blockNumber.toString(), rate.toString()]);
  return rate;
}

/**
 * Determines the price for OHM denominated in USD.
 *
 * The sources for the price are defined in {OHM_PRICE_PAIRS}.
 * The pair with the greatest non-OHM reserves will be used.
 *
 * With the current implementation, this function CANNOT use `getUSDRate` or `resolvePrice`, as it
 * would result in an infinite loop.
 *
 * @param blockNumber
 * @returns
 */
function getBaseOhmUsdRate(blockNumber: BigInt): BigDecimal {
  log.debug("getBaseOhmUsdRate: determining OHM-USD rate at block {}", [blockNumber.toString()]);
  let largestPairIndex = -1;
  let largestPairValue: BigDecimal | null = null;

  // Iterate through and find the pair with the largest non-OHM value
  for (let i = 0; i < OHM_PRICE_PAIRS.length; i++) {
    const priceHandler = OHM_PRICE_PAIRS[i];
    const pairTotalValue = getPairHandlerNonOhmValue(priceHandler, blockNumber);
    // No value is returned if the pair is not (yet) valid
    if (!pairTotalValue) {
      continue;
    }

    // If there is an existing largest value, but pairTotalValue is less than that, do nothing
    if (largestPairValue && pairTotalValue <= largestPairValue) {
      log.debug("getBaseOhmUsdRate: skipping pair {} with non-OHM value {} less than current largest pair value {}", [getContractName(priceHandler.getContract()), pairTotalValue.toString(), largestPairValue.toString()]);
      continue;
    }

    log.info("getBaseOhmUsdRate: found new largest pair {} ({}) with non-OHM value {}", [getContractName(priceHandler.getContract()), priceHandler.getContract(), pairTotalValue.toString()]);
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
  } else if (pairHandler.getType() === PairHandlerTypes.UniswapV3) {
    return getUSDRateUniswapV3(ERC20_OHM_V2, pairHandler.getContract(), blockNumber);
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
function getUSDRateUniswapV2(
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

  // TODO look at replacing this
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

function getUSDRateERC4626(assetAddress: string, vaultAddress: string, blockNumber: BigInt): BigDecimal {
  const vaultContract = ERC4626.bind(Address.fromString(vaultAddress));

  const rate = getERC4626Rate(blockNumber, vaultContract);
  if (!rate) {
    throw new Error(`getUSDRateERC4626: No rate found for vault ${vaultAddress} at block ${blockNumber.toString()}`);
  }

  return rate;
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
function resolvePrice(contractAddress: string, blockNumber: BigInt): BigDecimal {
  // Value UST at 0 from May 9th onwards
  if (
    contractAddress.toLowerCase() == ERC20_UST.toLowerCase() &&
    blockNumber.gt(BigInt.fromString(ERC20_UST_BLOCK_DEATH))
  ) {
    log.debug("getUSDRate: Returning $0 for UST after collapse", []);
    return BigDecimal.fromString("0");
  }

  // If the value can be resolved using a price feed, do that
  const contractAddressWithEth = contractAddress == NATIVE_ETH ? ERC20_WETH : contractAddress;
  if (isBaseToken(contractAddressWithEth)) {
    return getBaseTokenRate(Address.fromString(contractAddressWithEth), blockNumber);
  }

  // Handle OHM separately, as we have multiple liquidity pools
  if (arrayIncludesLoose([ERC20_OHM_V1, ERC20_OHM_V2], contractAddress)) {
    log.debug("getUSDRate: Contract address {} is OHM. Returning OHM rate.", [contractAddress]);
    return getBaseOhmUsdRate(blockNumber);
  }

  // Handle gOHM
  if (arrayIncludesLoose([ERC20_GOHM], contractAddress)) {
    return getBaseOhmUsdRate(blockNumber).times(getCurrentIndex(blockNumber));
  }

  // Handle more complex derivates
  if ([ERC20_BB_A_USD.toLowerCase(), ERC20_CVX_FRAX_3CRV.toLowerCase(), ERC20_FRAX_3CRV.toLowerCase(), ERC20_FRAX_BP.toLowerCase()].includes(contractAddress.toLowerCase())) {
    return getBaseTokenRate(Address.fromString(ERC20_USDC), blockNumber);
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

  if (pairHandler.getType() === PairHandlerTypes.ERC4626) {
    return getUSDRateERC4626(contractAddress, pairHandler.getContract(), blockNumber);
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

function getOrCreateTokenPriceSnapshot(address: string, blockNumber: BigInt): TokenPriceSnapshot {
  // address/blockNumber
  const snapshotId = Bytes.fromHexString(address).concatI32(blockNumber.toI32());
  let snapshot = TokenPriceSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new TokenPriceSnapshot(snapshotId);
    snapshot.token = Address.fromString(address);
    snapshot.price = resolvePrice(address, blockNumber);
    snapshot.block = blockNumber;

    snapshot.save();
    log.debug("getOrCreateTokenPriceSnapshot: created snapshot for token {} with price {} at block {}", [getContractName(address), snapshot.price.toString(), blockNumber.toString()]);
  }

  return snapshot;
}

export function getUSDRate(address: string, blockNumber: BigInt): BigDecimal {
  const snapshot = getOrCreateTokenPriceSnapshot(address, blockNumber);

  return snapshot.price;
}
