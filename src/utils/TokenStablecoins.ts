import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import {
  AAVE_ALLOCATOR,
  AAVE_ALLOCATOR_V2,
  ADAI_ERC20_CONTRACT,
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  ERC20DAI_CONTRACT,
  ERC20FRAX_CONTRACT,
  FEI_ERC20_CONTRACT,
  getContractName,
  LUSD_ALLOCATOR,
  LUSD_ERC20_CONTRACT,
  RARI_ALLOCATOR,
  STABILITY_POOL,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  UST_ERC20_CONTRACT,
} from "./Constants";
import {
  getConvexAllocator,
  getERC20,
  getERC20Balance,
  getRariAllocator,
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
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param daiERC20 ERC20 contract for DAI
 * @param aDaiERC20 ERC20 contract for Aave aDAI
 * @param rariAllocator RariAllocator contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getDaiBalance(
  daiERC20: ERC20 | null,
  aDaiERC20: ERC20 | null,
  rariAllocator: RariAllocator | null,
  blockNumber: BigInt,
): TokenRecords {
  const records = new TokenRecords();

  if (daiERC20) {
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(daiERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(daiERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "DAI",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(daiERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  if (aDaiERC20) {
    records.push(
      new TokenRecord(
        "DAI",
        "Aave Allocator",
        AAVE_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(aDaiERC20, AAVE_ALLOCATOR, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "DAI",
        "Aave Allocator V2",
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
        "Rari Allocator",
        RARI_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(rariAllocator.amountAllocated(BigInt.fromI32(3)), 18),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of FEI across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param feiERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFeiBalance(feiERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  if (feiERC20) {
    records.push(
      new TokenRecord(
        "FEI",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(feiERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FEI",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(feiERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FEI",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(feiERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of FRAX across the following:
 * - Convex allocator 1
 * - Convex allocator 2
 * - Convex allocator 3
 *
 * @param allocator1 Convex allocator
 * @param allocator2 Convex allocator
 * @param allocator3 Convex allocator
 * @param blockNumber current block number
 * @returns TokenRecords object
 */
export function getFraxAllocatedInConvexBalance(
  allocator1: ConvexAllocator | null,
  allocator2: ConvexAllocator | null,
  allocator3: ConvexAllocator | null,
  _blockNumber: BigInt,
): TokenRecords {
  // TODO add to mv and mvrfv?
  // Multiplied by 10e9 for consistency
  // TODO determine if the multiplier is correct

  const records = new TokenRecords();

  if (allocator1) {
    records.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 1",
        CONVEX_ALLOCATOR1,
        BigDecimal.fromString("1"),
        toDecimal(allocator1.totalValueDeployed().times(BigInt.fromString("1000000000")), 18),
      ),
    );
  }

  if (allocator2) {
    records.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 2",
        CONVEX_ALLOCATOR2,
        BigDecimal.fromString("1"),
        toDecimal(allocator2.totalValueDeployed().times(BigInt.fromString("1000000000")), 18),
      ),
    );
  }

  if (allocator3) {
    records.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 3",
        CONVEX_ALLOCATOR3,
        BigDecimal.fromString("1"),
        toDecimal(allocator3.totalValueDeployed().times(BigInt.fromString("1000000000")), 18),
      ),
    );
  }

  return records;
}

/**
 * Calculates the balance of FRAX across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - Convex allocators
 *
 * @param fraxERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getFraxBalance(fraxERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  if (fraxERC20) {
    records.push(
      new TokenRecord(
        "FRAX",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(fraxERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FRAX",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(fraxERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "FRAX",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(fraxERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  records.combine(
    getFraxAllocatedInConvexBalance(
      getConvexAllocator(CONVEX_ALLOCATOR1, blockNumber),
      getConvexAllocator(CONVEX_ALLOCATOR2, blockNumber),
      getConvexAllocator(CONVEX_ALLOCATOR3, blockNumber),
      blockNumber,
    ),
  );

  return records;
}

/**
 * Returns the balance of LUSD tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - LUSD allocator
 *
 * @param lusdERC20 ERC20 contract for LUSD
 * @param stabilityPoolContract StabilityPool contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getLUSDBalance(
  lusdERC20: ERC20 | null,
  stabilityPoolContract: StabilityPool | null,
  blockNumber: BigInt,
): TokenRecords {
  const records = new TokenRecords();

  if (lusdERC20) {
    records.push(
      new TokenRecord(
        "LUSD",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(lusdERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "LUSD",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(lusdERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "LUSD",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(lusdERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  if (stabilityPoolContract) {
    records.push(
      new TokenRecord(
        "LUSD",
        "LUSD Allocator",
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
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param ustERC20 ERC20 contract
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getUSTBalance(ustERC20: ERC20 | null, blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  if (ustERC20) {
    records.push(
      new TokenRecord(
        "UST",
        getContractName(TREASURY_ADDRESS),
        TREASURY_ADDRESS,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(ustERC20, TREASURY_ADDRESS, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "UST",
        getContractName(TREASURY_ADDRESS_V2),
        TREASURY_ADDRESS_V2,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(ustERC20, TREASURY_ADDRESS_V2, blockNumber), 18),
      ),
    );
    records.push(
      new TokenRecord(
        "UST",
        getContractName(TREASURY_ADDRESS_V3),
        TREASURY_ADDRESS_V3,
        BigDecimal.fromString("1"),
        toDecimal(getERC20Balance(ustERC20, TREASURY_ADDRESS_V3, blockNumber), 18),
      ),
    );
  }

  return records;
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

  records.combine(
    getDaiBalance(
      getERC20("DAI", ERC20DAI_CONTRACT, blockNumber),
      getERC20("aDAI", ADAI_ERC20_CONTRACT, blockNumber),
      getRariAllocator(RARI_ALLOCATOR, blockNumber),
      blockNumber,
    ),
  );
  records.combine(getFraxBalance(getERC20("FRAX", ERC20FRAX_CONTRACT, blockNumber), blockNumber));
  records.combine(
    getLUSDBalance(
      getERC20("LUSD", LUSD_ERC20_CONTRACT, blockNumber),
      getStabilityPool(STABILITY_POOL, blockNumber),
      blockNumber,
    ),
  );
  records.combine(getUSTBalance(getERC20("UST", UST_ERC20_CONTRACT, blockNumber), blockNumber));
  records.combine(getFeiBalance(getERC20("FEI", FEI_ERC20_CONTRACT, blockNumber), blockNumber));

  return records;
}

/**
 * Returns the DAI risk-free value, which is defined as:
 * - Balance of DAI
 * - Discounted value of OHM-DAI pair (where OHM = $1)
 * - Discounted value of OHM-DAI pair V2 (where OHM = $1)
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the risk-free value
 */
export function getDaiRiskFreeValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(
    getDaiBalance(
      getERC20("DAI", ERC20DAI_CONTRACT, blockNumber),
      getERC20("aDAI", ADAI_ERC20_CONTRACT, blockNumber),
      getRariAllocator(RARI_ALLOCATOR, blockNumber),
      blockNumber,
    ),
  );

  records.combine(getOhmDaiLiquidityBalance(blockNumber, true));

  records.combine(getOhmDaiLiquidityV2Balance(blockNumber, true));

  return records;
}

/**
 * Returns the DAI market value, which is defined as:
 * - Balance of DAI
 * - Value of OHM-DAI pair
 * - Value of OHM-DAI pair V2
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the market value
 */
export function getDaiMarketValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(
    getDaiBalance(
      getERC20("DAI", ERC20DAI_CONTRACT, blockNumber),
      getERC20("aDAI", ADAI_ERC20_CONTRACT, blockNumber),
      getRariAllocator(RARI_ALLOCATOR, blockNumber),
      blockNumber,
    ),
  );

  records.combine(getOhmDaiLiquidityBalance(blockNumber, false));

  records.combine(getOhmDaiLiquidityV2Balance(blockNumber, false));

  return records;
}

/**
 * Returns the FRAX risk-free value, which is defined as:
 * - Balance of FRAX
 * - Discounted value of OHM-FRAX pair (where OHM = $1)
 * - Discounted value of OHM-FRAX pair V2 (where OHM = $1)
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the risk-free value
 */
export function getFraxRiskFreeValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getFraxBalance(getERC20("FRAX", ERC20FRAX_CONTRACT, blockNumber), blockNumber));

  records.combine(getOhmFraxLiquidityBalance(blockNumber, true));

  records.combine(getOhmFraxLiquidityV2Balance(blockNumber, true));

  return records;
}

/**
 * Returns the FRAX market value, which is defined as:
 * - Balance of FRAX
 * - Value of OHM-FRAX pair
 * - Value of OHM-FRAX pair V2
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the market value
 */
export function getFraxMarketValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(getFraxBalance(getERC20("FRAX", ERC20FRAX_CONTRACT, blockNumber), blockNumber));

  records.combine(getOhmFraxLiquidityBalance(blockNumber, false));

  records.combine(getOhmFraxLiquidityV2Balance(blockNumber, false));

  return records;
}

/**
 * Returns the LUSD risk-free value, which is defined as:
 * - Balance of LUSD
 * - Discounted value of OHM-LUSD pair (where OHM = $1)
 * - Discounted value of OHM-LUSD pair V2 (where OHM = $1)
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the risk-free value
 */
export function getLusdRiskFreeValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(
    getLUSDBalance(
      getERC20("LUSD", LUSD_ERC20_CONTRACT, blockNumber),
      getStabilityPool(STABILITY_POOL, blockNumber),
      blockNumber,
    ),
  );

  records.combine(getOhmLusdLiquidityBalance(blockNumber, true));

  records.combine(getOhmLusdLiquidityV2Balance(blockNumber, true));

  return records;
}

/**
 * Returns the LUSD market value, which is defined as:
 * - Balance of LUSD
 * - Value of OHM-LUSD pair
 * - Value of OHM-LUSD pair V2
 *
 * @param blockNumber the current block number
 * @returns TokenRecords representing the components of the market value
 */
export function getLusdMarketValue(blockNumber: BigInt): TokenRecords {
  const records = new TokenRecords();

  records.combine(
    getLUSDBalance(
      getERC20("LUSD", LUSD_ERC20_CONTRACT, blockNumber),
      getStabilityPool(STABILITY_POOL, blockNumber),
      blockNumber,
    ),
  );

  records.combine(getOhmLusdLiquidityBalance(blockNumber, false));

  records.combine(getOhmLusdLiquidityV2Balance(blockNumber, false));

  return records;
}
