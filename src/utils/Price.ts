import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import {
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_STABLE_TOKENS,
  ERC20_UST,
  ERC20_UST_BLOCK_DEATH,
  ERC20_WETH,
  getContractName,
  getPairHandler,
  NATIVE_ETH,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "./Constants";
import { getERC20, getERC20Decimals } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { PairHandlerTypes } from "./PairHandler";

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
export function getBaseOhmUsdRate(block: BigInt): BigDecimal {
  let contractAddress = PAIR_UNISWAP_V2_OHM_DAI;
  if (block.gt(BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK))) {
    contractAddress = PAIR_UNISWAP_V2_OHM_DAI_V2;
  }

  const pair = UniswapV2Pair.bind(Address.fromString(contractAddress));
  if (!pair) {
    throw new Error(
      "Cannot determine discounted value as the contract " +
        contractAddress +
        " does not exist yet.",
    );
  }

  const reserves = pair.getReserves();
  const ohmReserves = reserves.value0.toBigDecimal();
  const daiReserves = reserves.value1.toBigDecimal();

  const ohmRate = daiReserves.div(ohmReserves).div(BIG_DECIMAL_1E9);
  log.debug("OHM rate {}", [ohmRate.toString()]);

  return ohmRate;
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

  // TODO check if we are ready to lookup using one of the base (OHM/ETH) rates
  // TODO handle OHM v1 rates?

  // TODO handle pairs at different blocks
  const pair = UniswapV2Pair.bind(Address.fromString(pairAddress));
  if (!pair) {
    throw new Error(
      "getUSDRateUniswapV2: Cannot determine discounted value as the contract " +
        pairAddress +
        " does not exist yet.",
    );
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
    log.debug("Returning $0 for UST after collapse", []);
    return BigDecimal.fromString("0");
  }

  // Handle stablecoins
  // TODO add support for dynamic price lookup for stablecoins
  if (arrayIncludesLoose(ERC20_STABLE_TOKENS, contractAddress)) {
    log.debug("Contract address {} is a stablecoin. Returning 1.", [contractAddress]);
    return BigDecimal.fromString("1");
  }

  // Handle OHM V1 and V2
  if (arrayIncludesLoose([ERC20_OHM_V1, ERC20_OHM_V2], contractAddress)) {
    log.debug("Contract address {} is OHM. Returning OHM rate.", [contractAddress]);
    return getBaseOhmUsdRate(blockNumber);
  }

  // Handle native ETH
  if (contractAddress == NATIVE_ETH) {
    log.debug("Contract address {} is native ETH. Returning wETH rate.", [contractAddress]);
    return getBaseEthUsdRate();
  }

  // Look for the pair
  const pairHandler = getPairHandler(contractAddress);
  if (!pairHandler) {
    throw new Error("Unable to find liquidity pool handler for contract: " + contractAddress);
  }

  if (pairHandler.getType() === PairHandlerTypes.UniswapV2) {
    return getUSDRateUniswapV2(contractAddress, pairHandler.getContract(), blockNumber);
  }

  if (pairHandler.getType() === PairHandlerTypes.UniswapV3) {
    return getUSDRateUniswapV3(contractAddress, pairHandler.getContract(), blockNumber);
  }

  throw new Error(
    "Unsupported liquidity pool handler type (" +
      pairHandler.getType().toString() +
      ") for contract: " +
      contractAddress,
  );
}
