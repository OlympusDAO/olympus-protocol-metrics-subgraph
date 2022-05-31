import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import {
  CONVEX_CVX_ALLOCATOR,
  CVX_ERC20_CONTRACT,
  FXS_ERC20_CONTRACT,
  getContractName,
  RARI_ALLOCATOR,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  TRIBE_ERC20_CONTRACT,
  VEFXS_ALLOCATOR,
  VEFXSERC20_CONTRACT,
  VLCVX_ERC20_CONTRACT,
  WETH_ERC20_CONTRACT,
  XSUSI_ERC20_CONTRACT,
} from "./Constants";
import { getERC20, getERC20Balance, getRariAllocator, getVeFXS } from "./ContractHelper";
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
 * Returns the balance of xSUSHI tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param xSushiERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getXSushiBalance(xSushiERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const xSushiRate = getXsushiUSDRate();

  if (xSushiERC20) {
    records.push(
      new TokenRecord(
        "xSUSHI",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        xSushiRate,
        toDecimal(getERC20Balance(xSushiERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "xSUSHI",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        xSushiRate,
        toDecimal(getERC20Balance(xSushiERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "xSUSHI",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        xSushiRate,
        toDecimal(getERC20Balance(xSushiERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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
export function getCVXBalance(cvxERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const cvxRate = getCVXUSDRate();

  if (cvxERC20) {
    records.push(
      new TokenRecord(
        "CVX",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        cvxRate,
        toDecimal(getERC20Balance(cvxERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "CVX",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        cvxRate,
        toDecimal(getERC20Balance(cvxERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "CVX",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        cvxRate,
        toDecimal(getERC20Balance(cvxERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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
export function getVlCVXBalance(vlERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const cvxRate = getCVXUSDRate();

  if (vlERC20) {
    records.push(
      new TokenRecord(
        "vlCVX",
        "Convex Allocator",
        CONVEX_CVX_ALLOCATOR,
        cvxRate,
        toDecimal(getERC20Balance(vlERC20, CONVEX_CVX_ALLOCATOR, blockNumber), 18),
      ),
    );
  }

  return records;
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

  records.combine(getCVXBalance(getERC20("CVX", CVX_ERC20_CONTRACT, blockNumber), blockNumber));
  records.combine(
    getVlCVXBalance(getERC20("vlCVX", VLCVX_ERC20_CONTRACT, blockNumber), blockNumber),
  );

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
function getFXSBalance(fxsERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const fxsRate = getFXSUSDRate();

  if (fxsERC20) {
    records.push(
      new TokenRecord(
        "FXS",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        fxsRate,
        toDecimal(getERC20Balance(fxsERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FXS",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        fxsRate,
        toDecimal(getERC20Balance(fxsERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FXS",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        fxsRate,
        toDecimal(getERC20Balance(fxsERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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
export function getVeFXSBalance(veFXS: VeFXS | null, _blockNumber: BigInt): TokenRecords {
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
  return getVeFXSBalance(getVeFXS(VEFXSERC20_CONTRACT, blockNumber), blockNumber);
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

  records.combine(getFXSBalance(getERC20("FXS", FXS_ERC20_CONTRACT, blockNumber), blockNumber));
  records.combine(getVeFXSRecords(blockNumber));

  return records;
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
  rariAllocator: RariAllocator | null,
  tribeERC20: ERC20 | null,
  blockNumber: BigInt,
): TokenRecords {
  log.debug("Calculating TRIBE balance", []);
  log.debug("TRIBE ERC20 is present: {}", [tribeERC20 ? "true" : "false"]);
  log.debug("Rari Allocator is present: {}", [rariAllocator ? "true" : "false"]);

  const records = new TokenRecords();
  const tribeRate = getTribeUSDRate();

  if (tribeERC20) {
    records.push(
      new TokenRecord(
        "TRIBE",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        tribeRate,
        toDecimal(getERC20Balance(tribeERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "TRIBE",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        tribeRate,
        toDecimal(getERC20Balance(tribeERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "TRIBE",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        tribeRate,
        toDecimal(getERC20Balance(tribeERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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
export function getWETHBalance(wethERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const wethRate = getETHUSDRate();

  if (wethERC20) {
    records.push(
      new TokenRecord(
        "wETH",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        wethRate,
        toDecimal(getERC20Balance(wethERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wETH",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        wethRate,
        toDecimal(getERC20Balance(wethERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wETH",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        wethRate,
        toDecimal(getERC20Balance(wethERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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
export function getWBTCBalance(wbtcERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();
  const wbtcRate = getBTCUSDRate();

  // TODO fix wBTC balance 0.000000002002006349
  if (wbtcERC20) {
    records.push(
      new TokenRecord(
        "wBTC",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        wbtcRate,
        toDecimal(getERC20Balance(wbtcERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wBTC",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        wbtcRate,
        toDecimal(getERC20Balance(wbtcERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "wBTC",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        wbtcRate,
        toDecimal(getERC20Balance(wbtcERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
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

  records.combine(
    getXSushiBalance(getERC20("xSUSHI", XSUSI_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  records.combine(getCVXBalance(getERC20("CVX", CVX_ERC20_CONTRACT, blockNumber), blockNumber));
  records.combine(
    getVlCVXBalance(getERC20("vlCVX", VLCVX_ERC20_CONTRACT, blockNumber), blockNumber),
  );
  records.combine(getFXSBalance(getERC20("FXS", FXS_ERC20_CONTRACT, blockNumber), blockNumber));

  if (!liquidOnly) {
    records.combine(getVeFXSRecords(blockNumber));
  }

  records.combine(
    getTribeBalance(
      getRariAllocator(RARI_ALLOCATOR, blockNumber),
      getERC20("TRIBE", TRIBE_ERC20_CONTRACT, blockNumber),
      blockNumber,
    ),
  );

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

  records.combine(getWETHBalance(getERC20("wETH", WETH_ERC20_CONTRACT, blockNumber), blockNumber));

  records.combine(getOhmEthLiquidityBalance(blockNumber, riskFree));

  records.combine(getOhmEthLiquidityV2Balance(blockNumber, riskFree));

  return records;
}

// TODO add CRV
// TODO find additional sources of FXS (25,641)
// TODO add FPIS
// TODO add ALCX
// TODO add BCT
// TODO check ETH in liquity
// TODO add KLIMA/sKLIMA
