import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import {
  AAVE_ALLOCATOR,
  AAVE_ALLOCATOR_V2,
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  ERC20_ADAI,
  ERC20_DAI,
  ERC20_FEI,
  ERC20_FRAX,
  ERC20_LUSD,
  ERC20_UST,
  getContractName,
  LUSD_ALLOCATOR,
  RARI_ALLOCATOR,
  STABILITY_POOL,
} from "./Constants";
import {
  getConvexAllocator,
  getConvexAllocatorRecords,
  getERC20,
  getERC20Balance,
  getERC20TokenRecordsFromWallets,
  getRariAllocator,
  getRariAllocatorBalance,
  getStabilityPool,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import {
  getOhmDaiLiquidityBalance,
  getOhmDaiLiquidityV2Balance,
  getOhmFraxLiquidityBalance,
  getOhmFraxLiquidityV2Balance,
  getOhmLusdLiquidityBalance,
  getOhmLusdLiquidityV2Balance,
} from "./LiquidityCalculations";
import { TokenRecord, TokenRecords } from "./TokenRecord";

/**
 * Calculates the balance of DAI across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getDaiBalance(blockNumber: BigInt): TokenRecords {
  const daiERC20 = getERC20("DAI", ERC20_DAI, blockNumber);
  const aDaiERC20 = getERC20("aDAI", ERC20_ADAI, blockNumber);
  const rariAllocator = getRariAllocator(RARI_ALLOCATOR, blockNumber);
  const records = getERC20TokenRecordsFromWallets(
    "DAI",
    daiERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  if (aDaiERC20) {
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(AAVE_ALLOCATOR),
        AAVE_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(aDaiERC20, AAVE_ALLOCATOR, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(AAVE_ALLOCATOR_V2),
        AAVE_ALLOCATOR_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(aDaiERC20, AAVE_ALLOCATOR_V2, blockNumber), 18),
      ),
    );
  }

  if (rariAllocator) {
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(RARI_ALLOCATOR),
        RARI_ALLOCATOR,
        BigDecimal.fromString("1"),
        getRariAllocatorBalance(ERC20_DAI, blockNumber),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of FEI across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFeiBalance(blockNumber: BigInt): TokenRecords {
  const feiERC20 = getERC20("FEI", ERC20_FEI, blockNumber);

  return getERC20TokenRecordsFromWallets("FEI", feiERC20, BigDecimal.fromString("1"), blockNumber);
}

/**
 * Calculates the balance of FRAX across the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - Convex allocators
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFraxBalance(blockNumber: BigInt): TokenRecords {
  const fraxERC20 = getERC20("FRAX", ERC20_FRAX, blockNumber);

  const records = getERC20TokenRecordsFromWallets(
    "FRAX",
    fraxERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  records.combine(getConvexAllocatorRecords(ERC20_FRAX, blockNumber));

  return records;
}

/**
 * Returns the balance of LUSD tokens in the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 * - LUSD allocator
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getLUSDBalance(blockNumber: BigInt): TokenRecords {
  const lusdERC20 = getERC20("LUSD", ERC20_LUSD, blockNumber);
  const stabilityPoolContract = getStabilityPool(STABILITY_POOL, blockNumber);
  const records = getERC20TokenRecordsFromWallets(
    "LUSD",
    lusdERC20,
    BigDecimal.fromString("1"),
    blockNumber,
  );

  if (stabilityPoolContract) {
    records.push(
      new TokenRecord(
        "LUSD",
        getContractName(LUSD_ALLOCATOR),
        LUSD_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(stabilityPoolContract.deposits(Address.fromString(LUSD_ALLOCATOR)).value0, 18),
      ),
    );
  }

  return records;
}

/**
 * Returns the balance of UST tokens in the following:
 * - all wallets, using {getERC20TokenRecordsFromWallets}.
 *
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getUSTBalance(blockNumber: BigInt): TokenRecords {
  const ustERC20 = getERC20("UST", ERC20_UST, blockNumber);

  return getERC20TokenRecordsFromWallets("UST", ustERC20, BigDecimal.fromString("1"), blockNumber);
}

/**
 * Returns the value of USD-pegged stablecoins:
 * - DAI
 * - FRAX
 * - LUSD
 * - UST
 * - FEI
 *
 * This currently (incorrectly) assumes that the value of each stablecoin is $1.
 *
 * TODO: lookup stablecoin price
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the stablecoin value
 */
export function getStableValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getDaiBalance(blockNumber));
  records.combine(getFraxBalance(blockNumber));
  records.combine(getLUSDBalance(blockNumber));
  records.combine(getUSTBalance(blockNumber));
  records.combine(getFeiBalance(blockNumber));

  return records;
}

/**
 * Returns the DAI market value, which is defined as:
 * - Balance of DAI
 * - Value of OHM-DAI pair
 * - Value of OHM-DAI pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getDaiMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  const records = new TokenRecords();

  records.combine(getDaiBalance(blockNumber));

  records.combine(getOhmDaiLiquidityBalance(blockNumber, riskFree));

  records.combine(getOhmDaiLiquidityV2Balance(blockNumber, riskFree));

  return records;
}

/**
 * Returns the FRAX market value, which is defined as:
 * - Balance of FRAX
 * - Value of OHM-FRAX pair
 * - Value of OHM-FRAX pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFraxMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  const records = new TokenRecords();

  records.combine(getFraxBalance(blockNumber));

  records.combine(getOhmFraxLiquidityBalance(blockNumber, riskFree));

  records.combine(getOhmFraxLiquidityV2Balance(blockNumber, riskFree));

  return records;
}

/**
 * Returns the LUSD market value, which is defined as:
 * - Balance of LUSD
 * - Value of OHM-LUSD pair
 * - Value of OHM-LUSD pair V2
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getLusdMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  const records = new TokenRecords();

  records.combine(getLUSDBalance(blockNumber));

  records.combine(getOhmLusdLiquidityBalance(blockNumber, riskFree));

  records.combine(getOhmLusdLiquidityV2Balance(blockNumber, riskFree));

  return records;
}

/**
 * Returns the FEI market value, which is defined as:
 * - Balance of FEI
 *
 * If {riskFree} is true, the discounted value of OHM-DAI pairs (where OHM = $1)
 * is calculated.
 *
 * @param blockNumber the current block number
 * @param riskFree true if calculating the risk-free value
 * @returns TokenRecords representing the components of the market value
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export function getFeiMarketValue(blockNumber: BigInt, riskFree: boolean = false): TokenRecords {
  const records = new TokenRecords();

  records.combine(getFeiBalance(blockNumber));

  return records;
}

// TODO add USDC
