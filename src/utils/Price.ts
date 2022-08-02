import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import {
  BALANCER_VAULT,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_STABLE_TOKENS,
  ERC20_UST,
  ERC20_UST_BLOCK_DEATH,
  ERC20_WETH,
  getContractName,
  getPairHandler,
  NATIVE_ETH,
  OHM_PRICE_PAIRS,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "./Constants";
import { getERC20, getERC20Decimals } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getBalancerPoolToken, getBalancerVault } from "./LiquidityBalancer";
import { PairHandler, PairHandlerTypes } from "./PairHandler";

const BIG_DECIMAL_1E8 = BigDecimal.fromString("1e8");
const BIG_DECIMAL_1E9 = BigDecimal.fromString("1e9");
const BIG_DECIMAL_1E10 = BigDecimal.fromString("1e10");
const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

/**
 * One of the base price lookup functions. This has a hard-coded
 * liquidity pool that it uses to determine the price of ETH,
 * relative to the USD.
 *
 * It uses the following basis of liquidity pools:
 *
 * number of token1 * price of token1 = number of token2 * price of token2
 *
 * In the case of a USDC-ETH pair, we know the following:
 * - number of USDC (using getReserves())
 * - number of ETH (using getReserves())
 * - price of USDC (1)
 *
 * Therefore the price of ETH is:
 *
 * number of USDC * 1 / number of ETH = price of ETH
 *
 * @returns Price of ETH in USD
 */
export function getBaseEthUsdRate(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(PAIR_UNISWAP_V2_USDC_ETH));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        PAIR_UNISWAP_V2_USDC_ETH +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const usdReserves = reserves.value0.toBigDecimal();
  const ethReserves = reserves.value1.toBigDecimal();

  const ethRate = usdReserves.div(ethReserves).times(BIG_DECIMAL_1E12);
  log.debug("ETH rate {}", [ethRate.toString()]);

  return ethRate;
}

function getPairHandlerNonOhmValue(
  pairHandler: PairHandler,
  blockNumber: BigInt,
): BigDecimal | null {
  return null;
}

/**
 * One of the base price lookup functions. This has a hard-coded
 * liquidity pool that it uses to determine the price of OHM,
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
  log.debug("OHM rate {}", [ohmRate.toString()]);

  return ohmRate;
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

  if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
    return getBaseOhmUsdRateUniswapV2(pairHandler.getContract(), blockNumber);
  } else if (
    pairHandler.getType() === PairHandlerTypes.Balancer &&
    pairHandlerBalancerPool !== null
  ) {
    // TODO implement balancer lookup
    // TODO consider moving to a new file in order to isolate and reduce inter-dependencies
    // return getUSDRateBalancer(
    //   ERC20_OHM_V2,
    //   pairHandler.getContract(),
    //   pairHandlerBalancerPool,
    //   blockNumber,
    // );
  }

  throw new Error(
    `getBaseOhmUsdRate: pair handler type ${pairHandler.getType()} with contract ${getContractName(
      pairHandler.getContract(),
    )} (${pairHandler.getContract()}) is unsupported`,
  );
}

// eslint-disable-next-line no-shadow
export enum PairTokenBaseOrientation {
  TOKEN0,
  TOKEN1,
  UNKNOWN,
}

/**
 * Determines if the given string array loosely includes the given value.
 *
 * This is used as Array.includes() uses strict equality, and the strings
 * provided by {Address} are not always the same.
 *
 * This also ensures that when comparison is performed, both strings
 * are lowercase.
 *
 * @param array the array to iterate over
 * @param value the value to check against
 * @returns
 */
function arrayIncludesLoose(array: string[], value: string): boolean {
  for (let i = 0; i < array.length; i++) {
    if (array[i].toLowerCase() == value.toLowerCase()) return true;
  }

  return false;
}

/**
 * Determines whether token0 or token1 of a pair is the base (wETH/OHM) token.
 *
 * @param token0
 * @param token1
 * @returns
 */
export function getBaseTokenOrientation(
  token0: Address,
  token1: Address,
): PairTokenBaseOrientation {
  // As we are ultimately trying to get to a USD-denominated rate,
  // check for USD stablecoins first
  if (arrayIncludesLoose(ERC20_STABLE_TOKENS, token0.toHexString())) {
    return PairTokenBaseOrientation.TOKEN0;
  }

  if (arrayIncludesLoose(ERC20_STABLE_TOKENS, token1.toHexString())) {
    return PairTokenBaseOrientation.TOKEN1;
  }

  /**
   * Note: token0.toHexString() ostensibly returns the contract address,
   * but it does not equal {ERC20_WETH} even after trimming. So we use Address.
   */
  const wethAddress = Address.fromString(ERC20_WETH);
  const ohmV1Address = Address.fromString(ERC20_OHM_V1);
  const ohmV2Address = Address.fromString(ERC20_OHM_V2);
  // TODO what if the pair is OHM-ETH or ETH-OHM?

  // Now check secondary base tokens: OHM and ETH
  if (token0.equals(wethAddress) || token0.equals(ohmV1Address) || token0.equals(ohmV2Address)) {
    return PairTokenBaseOrientation.TOKEN0;
  }

  if (token1.equals(wethAddress) || token1.equals(ohmV1Address) || token1.equals(ohmV2Address)) {
    return PairTokenBaseOrientation.TOKEN1;
  }

  return PairTokenBaseOrientation.UNKNOWN;
}

/**
 * Gets the USD value of the base token, as identified by {orientation}.
 *
 * This enables pairs to have ETH or OHM as the base token.
 *
 * @param token0
 * @param token1
 * @param orientation
 * @param blockNumber
 * @returns
 */
export function getBaseTokenUSDRate(
  token0: Address,
  token1: Address,
  orientation: PairTokenBaseOrientation,
  blockNumber: BigInt,
): BigDecimal {
  if (orientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "Unsure how to deal with unknown token base orientation for tokens " +
        token0.toHexString() +
        ", " +
        token1.toHexString(),
    );
  }

  const baseToken = orientation === PairTokenBaseOrientation.TOKEN0 ? token0 : token1;

  const ohmV1Address = Address.fromString(ERC20_OHM_V1);
  const ohmV2Address = Address.fromString(ERC20_OHM_V2);
  if (baseToken.equals(ohmV1Address) || baseToken.equals(ohmV2Address)) {
    log.debug("Returning OHM", []);
    return getBaseOhmUsdRate(blockNumber);
  }

  if (baseToken.equals(Address.fromString(ERC20_WETH))) {
    log.debug("Returning ETH", []);
    return getBaseEthUsdRate();
  }

  // Otherwise, USD
  return BigDecimal.fromString("1");
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
  if (arrayIncludesLoose(ERC20_STABLE_TOKENS, contractAddress)) {
    log.debug("getUSDRateUniswapV2: Returning stablecoin rate of 1", []);
    return BigDecimal.fromString("1");
  }

  // TODO handle OHM v1 rates?

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
  const pair = UniswapV3Pair.bind(Address.fromString(pairAddress));
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
  log.debug("Token orientation is {}", [baseTokenOrientation.toString()]);

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
  const token0Contract = getERC20(
    getContractName(token0.toHexString()),
    token0.toHexString(),
    blockNumber,
  );
  const token1Contract = getERC20(
    getContractName(token0.toHexString()),
    token1.toHexString(),
    blockNumber,
  );
  if (!token0Contract) {
    log.warning("Unable to obtain ERC20 for token {} at block {}", [
      token0.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }
  if (!token1Contract) {
    log.warning("Unable to obtain ERC20 for token {} at block {}", [
      token1.toHexString(),
      blockNumber.toString(),
    ]);
    return BigDecimal.zero();
  }

  // If there is a difference between the decimal places of the two tokens, adjust for that
  const decimalDifference: u8 = u8(token0Contract.decimals()) - u8(token1Contract.decimals());
  const adjustedNumerator = BigInt.fromI32(10)
    .pow(decimalDifference)
    .toBigDecimal()
    .times(baseTokenNumerator);

  const baseTokenUsdRate = getBaseTokenUSDRate(token0, token1, baseTokenOrientation, blockNumber);

  return adjustedNumerator.times(baseTokenUsdRate);
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

  const vault = getBalancerVault(vaultAddress, blockNumber);

  // Get token balances
  if (vault.try_getPoolTokens(Bytes.fromHexString(poolId)).reverted) {
    log.warning(
      "getUSDRateBalancer: Balancer vault contract reverted calling getPoolTokens with pool id {} at block {}. Skipping",
      [poolId, blockNumber.toString()],
    );
    return BigDecimal.zero();
  }
  const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(poolId));
  const addresses: Array<Address> = poolTokenWrapper.getTokens();
  const balances: Array<BigInt> = poolTokenWrapper.getBalances();

  // Get token weights
  const poolToken = getBalancerPoolToken(vaultAddress, poolId, blockNumber);
  if (poolToken === null) {
    log.warning(
      "getUSDRateBalancer: Balancer pool token contract reverted with pool id {} at block {}. Skipping",
      [poolId, blockNumber.toString()],
    );
    return BigDecimal.zero();
  }
  const tokenWeights = poolToken.getNormalizedWeights();

  // Get pair orientation
  const token0 = addresses[0];
  const token1 = addresses[1];

  log.debug("getUSDRateBalancer: determining pair orientation", []);
  const baseTokenOrientation = getBaseTokenOrientation(token0, token1);
  if (baseTokenOrientation === PairTokenBaseOrientation.UNKNOWN) {
    throw new Error(
      "getUSDRateBalancer: Unsure how to deal with unknown token base orientation for Balancer pool " +
        poolId,
    );
  }
  log.debug("getUSDRateBalancer: base token is {} ({})", [
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0 ? "token0" : "token1",
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? getContractName(token0.toHexString())
      : getContractName(token1.toHexString()),
  ]);

  const token0Decimals = getERC20Decimals(token0.toHexString(), blockNumber);
  const token1Decimals = getERC20Decimals(token1.toHexString(), blockNumber);

  const token0Reserves = toDecimal(balances[0], token0Decimals);
  const token1Reserves = toDecimal(balances[1], token1Decimals);
  // If the reserves are 0, then we can't find out the price
  if (token0Reserves.equals(BigDecimal.zero()) || token1Reserves.equals(BigDecimal.zero())) {
    log.debug("getUSDRateBalancer: reserves are 0. Skipping", []);
    return BigDecimal.zero();
  }

  const token0Weight = toDecimal(tokenWeights[0], poolToken.decimals());
  const token1Weight = toDecimal(tokenWeights[1], poolToken.decimals());
  log.debug("getUSDRateBalancer: token0 weight {}, token1 weight {}", [
    token0Weight.toString(),
    token1Weight.toString(),
  ]);

  const baseTokenUsdRate = getBaseTokenUSDRate(token0, token1, baseTokenOrientation, blockNumber);
  log.debug("getUSDRateBalancer: baseTokenUsdRate for {} ({}) is {}", [
    getContractName(contractAddress),
    contractAddress,
    baseTokenUsdRate.toString(),
  ]);

  // Get the non-base token in terms of the base token (since we know the rate)
  const numerator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token0Reserves.div(token0Weight)
      : token1Reserves.div(token1Weight);
  const denominator =
    baseTokenOrientation === PairTokenBaseOrientation.TOKEN0
      ? token1Reserves.div(token1Weight)
      : token0Reserves.div(token0Weight);
  const rate = numerator.div(denominator).times(baseTokenUsdRate);
  log.info("getUSDRateBalancer: numerator {}, denominator {}, USD rate {}", [
    numerator.toString(),
    denominator.toString(),
    rate.toString(),
  ]);
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
  // TODO add support for dynamic price lookup for stablecoins
  if (arrayIncludesLoose(ERC20_STABLE_TOKENS, contractAddress)) {
    log.debug("getUSDRate: Contract address {} is a stablecoin. Returning 1.", [contractAddress]);
    return BigDecimal.fromString("1");
  }

  // Handle OHM V1 and V2
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
