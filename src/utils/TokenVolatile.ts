import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import {
  ERC20_CVX,
  ERC20_CVX_VL,
  ERC20_FXS,
  ERC20_FXS_VE,
  ERC20_TRIBE,
  ERC20_WBTC,
  ERC20_WETH,
  ERC20_XSUSHI,
  getContractName,
  RARI_ALLOCATOR,
  VEFXS_ALLOCATOR,
} from "./Constants";
import {
  getERC20,
  getERC20TokenRecordsFromWallets,
  getRariAllocator,
  getRariAllocatorBalance,
  getRariAllocatorRecords,
  getVeFXS,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getOhmEthLiquidityBalance, getOhmEthLiquidityV2Balance } from "./LiquidityCalculations";
import {
  getBTCUSDRate,
  getCVXUSDRate,
  getETHUSDRate,
  getFXSUSDRate,
  getTribeUSDRate,
  getXsushiUSDRate,
} from "./Price";
import { TokenRecord, TokenRecords } from "./TokenRecord";

/**
 * Returns the value of vesting assets in the treasury
 *
 * @returns TokenRecords
 */
export function getVestingAssets(): TokenRecords {
  // Cross chain assets that can not be tracked right now
  // pklima
  // butterfly
  // Vsta
  // PhantomDAO
  // Lobis
  // TODO remove hard-coded number
  const record = new TokenRecord(
    "Vesting Assets",
    "No source",
    "0x0",
    BigDecimal.fromString("1"),
    BigDecimal.fromString("32500000"),
  );
  const records = new TokenRecords();
  records.push(record);
  return records;
}

/**
 * Returns the balance of xSUSHI tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getXSushiBalance(blockNumber: BigInt): TokenRecords {
  const xSushiERC20 = getERC20("xSUSHI", ERC20_XSUSHI, blockNumber);
  const xSushiRate = getXsushiUSDRate();
  return getERC20TokenRecordsFromWallets("xSUSHI", xSushiERC20, xSushiRate, blockNumber);
}

/**
 * Returns the balance of CVX tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXBalance(blockNumber: BigInt): TokenRecords {
  const cvxERC20 = getERC20("CVX", ERC20_CVX, blockNumber);
  const cvxRate = getCVXUSDRate();

  return getERC20TokenRecordsFromWallets("CVX", cvxERC20, cvxRate, blockNumber);
}

/**
 * Returns the balance of vlCVX tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVlCVXBalance(blockNumber: BigInt): TokenRecords {
  const vlCvxERC20 = getERC20("vlCVX", ERC20_CVX_VL, blockNumber);
  const cvxRate = getCVXUSDRate();

  return getERC20TokenRecordsFromWallets("vlCVX", vlCvxERC20, cvxRate, blockNumber);
}

/**
 * Returns the balance of CVX tokens:
 * - CVX
 * - vlCVX
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXTotalBalance(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getCVXBalance(blockNumber));
  records.combine(getVlCVXBalance(blockNumber));

  return records;
}

/**
 * Returns the balance of FXS tokens from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
function getFXSBalance(blockNumber: BigInt): TokenRecords {
  const fxsERC20 = getERC20("FXS", ERC20_FXS, blockNumber);
  const fxsRate = getFXSUSDRate();

  return getERC20TokenRecordsFromWallets("FXS", fxsERC20, fxsRate, blockNumber);
}

/**
 * Returns the balance of veFXS tokens in the following:
 * - FXS allocator
 *
 * @param veFXS VeFXS contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVeFXSBalance(blockNumber: BigInt): TokenRecords {
  const veFXS = getVeFXS(ERC20_FXS_VE, blockNumber);
  const records = new TokenRecords();
  const fxsRate = getFXSUSDRate();

  if (veFXS) {
    records.push(
      new TokenRecord(
        "veFXS",
        "veFXS Allocator",
        VEFXS_ALLOCATOR,
        fxsRate,
        toDecimal(veFXS.locked(Address.fromString(VEFXS_ALLOCATOR)).value0, 18),
      ),
    );
  }

  return records;
}

export function getVeFXSRecords(blockNumber: BigInt): TokenRecords {
  return getVeFXSBalance(blockNumber);
}

/**
 * Returns the balance of FXS tokens:
 * - FXS
 * - veFXS
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFXSTotalBalance(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getFXSBalance(blockNumber));
  records.combine(getVeFXSRecords(blockNumber));

  return records;
}

/**
 * Calculates the balance of TRIBE across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Rari allocator
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
function getTribeBalance(blockNumber: BigInt): TokenRecords {
  const tribeERC20 = getERC20("TRIBE", ERC20_TRIBE, blockNumber);
  const tribeRate = getTribeUSDRate();

  const records = getERC20TokenRecordsFromWallets("TRIBE", tribeERC20, tribeRate, blockNumber);
  records.combine(getRariAllocatorRecords(ERC20_TRIBE, tribeRate, blockNumber));

  return records;
}

/**
 * Calculates the balance of wETH from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWETHBalance(blockNumber: BigInt): TokenRecords {
  const wethERC20 = getERC20("wETH", ERC20_WETH, blockNumber);
  const wethRate = getETHUSDRate();

  return getERC20TokenRecordsFromWallets("wETH", wethERC20, wethRate, blockNumber);
}

/**
 * Calculates the balance of wBTC from all wallets, using
 * {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWBTCBalance(blockNumber: BigInt): TokenRecords {
  const wbtcERC20 = getERC20("wBTC", ERC20_WBTC, blockNumber);
  const wbtcRate = getBTCUSDRate();

  return getERC20TokenRecordsFromWallets("wTC", wbtcERC20, wbtcRate, blockNumber);
}

/**
 * Returns the value of volatile assets:
 * - Vesting assets
 * - xSUSHI
 * - CVX
 * - vlCVX
 * - FXS
 * - veFXS
 * - TRIBE
 *
 * If `liquidOnly` is specified, then the following are excluded as they are locked:
 * - Vesting assets
 * - veFXS
 *
 * vlCVX is only locked for 3 months at a time, so is considered liquid.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVolatileValue(blockNumber: BigInt, liquidOnly: boolean): TokenRecords {
  if (liquidOnly) log.debug("liquidOnly is true, so skipping illiquid assets", []);
  const records = new TokenRecords();

  if (!liquidOnly) {
    records.combine(getVestingAssets());
  }

  records.combine(getXSushiBalance(blockNumber));
  records.combine(getCVXBalance(blockNumber));
  records.combine(getVlCVXBalance(blockNumber));
  records.combine(getFXSBalance(blockNumber));

  if (!liquidOnly) {
    records.combine(getVeFXSRecords(blockNumber));
  }

  records.combine(getTribeBalance(blockNumber));

  return records;
}

/**
 * Returns the ETH market value, which is defined as:
 * - Balance of ETH
 * - Value of OHM-ETH pair
 * - Value of OHM-ETH pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getEthMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  const records = new TokenRecords();

  records.combine(getWETHBalance(blockNumber));

  records.combine(getOhmEthLiquidityBalance(blockNumber, riskFree));

  records.combine(getOhmEthLiquidityV2Balance(blockNumber, riskFree));

  return records;
}

// TODO add CRV
// TODO add FPIS
// TODO add ALCX
// TODO add BCT
// TODO check ETH in liquity
// TODO add KLIMA/sKLIMA
// TODO add method to iterate through volatile tokens and fetch balances
