import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import {
  ERC20_STABLE_TOKENS,
  ERC20_VOLATILE_TOKENS,
  getContractName,
  getPairHandlers,
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
  TREASURY_ADDRESS,
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
import { PairHandlerTypes } from "./PairHandler";
import { getOhmUSDPairRiskFreeValue, getUniswapV2PairValue } from "./Price";
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
  const records = newTokenRecords("Liquidity");
  const contractName = getContractName(liquidityBalance.contract);
  // TODO handle uniswap V3
  // TODO this assumes that the other side of the LP is OHM, which is not always correct (ETH!)
  const lpValue = riskFree
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
        getContractName(address),
        address,
        lpUnitPrice,
        toDecimal(balance, 18),
      ),
    );
  }

  return records;
}

/**
 * Returns the TokenRecords representing the liquidity for {tokenAddress}.
 *
 * @param tokenAddress the address of the ERC20 token
 * @param riskFree whether the value is risk-free or not
 * @param singleSidedValue should be true if only the value of a single side of the LP is desired
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getLiquidityBalances(
  tokenAddress: string,
  riskFree: boolean,
  singleSidedValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("Liquidity");
  log.debug("Determining liquidity balance for token {}", [tokenAddress]);

  // Uniswap
  // Get the appropriate pair
  const pairHandlers = getPairHandlers(tokenAddress);
  for (let j = 0; j < pairHandlers.length; j++) {
    const pairHandler = pairHandlers[j];
    const liquidityBalance = new LiquidityBalances(pairHandler.getPair());
    if (pairHandler.getHandler() === PairHandlerTypes.UniswapV2) {
      const liquidityPair = getUniswapV2Pair(pairHandler.getPair(), blockNumber);

      // Across the different sources, determine the total balance of liquidity pools
      // Uniswap LPs in wallets
      for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
        const currentWallet = WALLET_ADDRESSES[i];
        const balance = getUniswapV2PairBalance(liquidityPair, currentWallet, blockNumber);
        if (!balance || balance.equals(BigInt.zero())) continue;

        log.debug("Found balance {} in wallet {}", [toDecimal(balance).toString(), currentWallet]);
        liquidityBalance.addBalance(currentWallet, balance);
      }

      combineTokenRecords(
        records,
        getLiquidityTokenRecords(liquidityBalance, blockNumber, riskFree),
      );
    } else if (pairHandler.getHandler() === PairHandlerTypes.UniswapV3) {
      const contractOne = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
      const balanceOne = contractOne
        ? contractOne.balanceOf(Address.fromString(pairHandler.getPair()))
        : null;
      log.info("token0 reserves: {}", [balanceOne ? balanceOne.toString() : "null"]);
      // TODO add support for Uniswap V3
      log.error("UniswapV3 not yet supported", []);
    } else {
      throw new Error("Unsupported liquidity pair type: " + pairHandler.getHandler().toString());
    }
  }

  // If the singleSidedValue is desired, we can halve the value of the LP and return that.
  if (singleSidedValue) {
    setTokenRecordsMultiplier(records, BigDecimal.fromString("0.5"));
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
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS, blockNumber),
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
    TREASURY_ADDRESS,
    getUniswapV2PairBalance(ohmEthLiquidityPair, TREASURY_ADDRESS, blockNumber),
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
 * Returns the value of liquidity pools for volatile and stable tokens.
 *
 * @param riskFree If `riskFree` is true, the risk-free value will be returned
 * @param singleSidedValue should be true if only the value of a single side of the LP is desired
 * @param blockNumber
 * @returns TokenRecords object
 */
export function getLiquidityPoolValue(
  riskFree: boolean,
  singleSidedValue: boolean,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("Liquidity Pool Value");

  for (let i = 0; i < ERC20_STABLE_TOKENS.length; i++) {
    combineTokenRecords(
      records,
      getLiquidityBalances(ERC20_STABLE_TOKENS[i], riskFree, singleSidedValue, blockNumber),
    );
  }

  for (let i = 0; i < ERC20_VOLATILE_TOKENS.length; i++) {
    combineTokenRecords(
      records,
      getLiquidityBalances(ERC20_VOLATILE_TOKENS[i], riskFree, singleSidedValue, blockNumber),
    );
  }

  return records;
}
