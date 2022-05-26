import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import {
  CONVEX_CVX_ALLOCATOR,
  CVX_ERC20_CONTRACT,
  FXS_ERC20_CONTRACT,
  RARI_ALLOCATOR,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  TRIBE_ERC20_CONTRACT,
  VEFXS_ALLOCATOR,
  VEFXSERC20_CONTRACT,
  VLCVX_ERC20_CONTRACT,
  XSUSI_ERC20_CONTRACT,
} from "./Constants";
import { getBalance, getERC20, getRariAllocator, getVeFXS } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import {
  getBTCUSDRate,
  getCVXUSDRate,
  getETHUSDRate,
  getFXSUSDRate,
  getTribeUSDRate,
  getXsushiUSDRate,
} from "./Price";
import { TokenRecord, TokenRecords, TokensRecords } from "./TokenRecord";

/**
 * Returns the value of vesting assets in the treasury
 *
 * @returns TokensRecords
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
  return new TokenRecords([record]);
}

/**
 * Returns the balance of xSUSHI tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param xSushiERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getXSushiBalance(xSushiERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const xSushiRate = getXsushiUSDRate();

  if (xSushiERC20) {
    records.push(
      new TokenRecord(
        "xSUSHI",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        xSushiRate,
        toDecimal(getBalance(xSushiERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "xSUSHI",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        xSushiRate,
        toDecimal(getBalance(xSushiERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "xSUSHI",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        xSushiRate,
        toDecimal(getBalance(xSushiERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
}

/**
 * Returns the balance of CVX tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param cvxERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getCVXBalance(cvxERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const cvxRate = getCVXUSDRate();

  if (cvxERC20) {
    records.push(
      new TokenRecord(
        "CVX",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        cvxRate,
        toDecimal(getBalance(cvxERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "CVX",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        cvxRate,
        toDecimal(getBalance(cvxERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "CVX",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        cvxRate,
        toDecimal(getBalance(cvxERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
}

/**
 * Returns the balance of vlCVX tokens in the following:
 * - CVX allocator
 *
 * @param vlERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVlCVXBalance(vlERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const cvxRate = getCVXUSDRate();

  if (vlERC20) {
    records.push(
      new TokenRecord(
        "vlCVX",
        "Convex Allocator",
        CONVEX_CVX_ALLOCATOR,
        cvxRate,
        toDecimal(getBalance(vlERC20, CONVEX_CVX_ALLOCATOR, blockNumber), 18),
      ),
    );
  }

  return records;
}

export function getCVXVlCVXBalance(blockNumber: BigInt): TokensRecords {
  const records = new TokensRecords();

  records.addToken("CVX", getCVXBalance(getERC20(CVX_ERC20_CONTRACT, blockNumber), blockNumber));
  records.addToken(
    "vlCVX",
    getVlCVXBalance(getERC20(VLCVX_ERC20_CONTRACT, blockNumber), blockNumber),
  );

  log.info("CVX/vlCVX tokens: {}", [records.toString()]);
  return records;
}

/**
 * Returns the balance of FXS tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param fxsERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
function getFXSBalance(fxsERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const fxsRate = getFXSUSDRate();

  if (fxsERC20) {
    records.push(
      new TokenRecord(
        "FXS",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        fxsRate,
        toDecimal(getBalance(fxsERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FXS",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        fxsRate,
        toDecimal(getBalance(fxsERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FXS",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        fxsRate,
        toDecimal(getBalance(fxsERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
}

/**
 * Returns the balance of veFXS tokens in the following:
 * - FXS allocator
 *
 * @param veFXS VeFXS contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getVeFXSBalance(veFXS: VeFXS, _blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const cvxRate = getCVXUSDRate();

  if (veFXS) {
    records.push(
      new TokenRecord(
        "veFXS",
        "veFXS Allocator",
        VEFXS_ALLOCATOR,
        cvxRate,
        toDecimal(veFXS.locked(Address.fromString(VEFXS_ALLOCATOR)).value0, 18),
      ),
    );
  }

  return records;
}

export function getVeFXSRecords(blockNumber: BigInt): TokenRecords {
  return getVeFXSBalance(getVeFXS(VEFXSERC20_CONTRACT, blockNumber), blockNumber);
}

/**
 * Calculates the balance of TRIBE across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - Rari allocator
 *
 * @param rariAllocator bound contract
 * @param tribeERC20 bound contract
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
function getTribeBalance(
  rariAllocator: RariAllocator,
  tribeERC20: ERC20,
  blockNumber: BigInt,
): TokenRecords {
  log.debug("Calculating TRIBE balance", []);
  log.debug("TRIBE ERC20 is present: {}", [tribeERC20 ? "true" : "false"]);
  log.debug("Rari Allocator is present: {}", [rariAllocator ? "true" : "false"]);

  const records = new TokenRecords([]);
  const tribeRate = getTribeUSDRate();

  if (tribeERC20) {
    records.push(
      new TokenRecord(
        "TRIBE",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        tribeRate,
        toDecimal(getBalance(tribeERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "TRIBE",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        tribeRate,
        toDecimal(getBalance(tribeERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "TRIBE",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        tribeRate,
        toDecimal(getBalance(tribeERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  if (rariAllocator) {
    records.push(
      new TokenRecord(
        "TRIBE",
        "Rari Allocator",
        RARI_ALLOCATOR,
        tribeRate,
        toDecimal(rariAllocator.amountAllocated(BigInt.fromI32(4)), 18),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of wETH across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param wethERC20 bound contract
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWETHBalance(wethERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const wethRate = getETHUSDRate();

  if (wethERC20) {
    records.push(
      new TokenRecord(
        "wETH",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        wethRate,
        toDecimal(getBalance(wethERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wETH",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        wethRate,
        toDecimal(getBalance(wethERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wETH",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        wethRate,
        toDecimal(getBalance(wethERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of wBTC across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param wbtcERC20 bound contract
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getWBTCBalance(wbtcERC20: ERC20, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords([]);
  const wbtcRate = getBTCUSDRate();

  if (wbtcERC20) {
    records.push(
      new TokenRecord(
        "wBTC",
        "Treasury Wallet",
        TREASURY_ADDRESS,
        wbtcRate,
        toDecimal(getBalance(wbtcERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wBTC",
        "Treasury Wallet V2",
        TREASURY_ADDRESS_V2,
        wbtcRate,
        toDecimal(getBalance(wbtcERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wBTC",
        "Treasury Wallet V3",
        TREASURY_ADDRESS_V3,
        wbtcRate,
        toDecimal(getBalance(wbtcERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
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
 * @param blockNumber the current block number
 * @returns TokensRecords object
 */
export function getVolatileValue(blockNumber: BigInt, liquidOnly: boolean): TokensRecords {
  const records = new TokensRecords();

  if (!liquidOnly) {
    records.addToken("Vesting Assets", getVestingAssets());
  }

  records.addToken(
    "xSUSHI",
    getXSushiBalance(getERC20(XSUSI_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  records.addToken("CVX", getCVXBalance(getERC20(CVX_ERC20_CONTRACT, blockNumber), blockNumber));
  records.addToken(
    "vlCVX",
    getVlCVXBalance(getERC20(VLCVX_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  records.addToken("FXS", getFXSBalance(getERC20(FXS_ERC20_CONTRACT, blockNumber), blockNumber));

  if (!liquidOnly) {
    records.addToken("veFXS", getVeFXSRecords(blockNumber));
  }

  records.addToken(
    "TRIBE",
    getTribeBalance(
      getRariAllocator(RARI_ALLOCATOR, blockNumber),
      getERC20(TRIBE_ERC20_CONTRACT, blockNumber),
      blockNumber,
    ),
  );

  log.info("Volatile tokens: {}", [records.toString()]);
  return records;
}
