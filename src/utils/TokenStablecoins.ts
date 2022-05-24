import { BigDecimal, BigInt, Address, log } from "@graphprotocol/graph-ts";
import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import {
  ERC20DAI_CONTRACT,
  ADAI_ERC20_CONTRACT,
  RARI_ALLOCATOR,
  TREASURY_ADDRESS,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  AAVE_ALLOCATOR,
  AAVE_ALLOCATOR_V2,
  AAVE_ALLOCATOR_V2_BLOCK,
  RARI_ALLOCATOR_BLOCK,
  FEI_ERC20_CONTRACT,
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  CONVEX_ALLOCATOR1_BLOCK,
  CONVEX_ALLOCATOR2_BLOCK,
  CONVEX_ALLOCATOR3_BLOCK,
  ERC20FRAX_CONTRACT,
  LUSD_ERC20_CONTRACT,
  STABILITY_POOL,
  LUSD_ERC20_CONTRACTV2_BLOCK,
  LUSD_ALLOCATOR_BLOCK,
  LUSD_ALLOCATOR,
  UST_ERC20_CONTRACT,
  UST_ERC20_CONTRACT_BLOCK,
} from "./Constants";
import { contractsDictType, getBalance } from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { TokenRecords, TokenRecord, TokensRecords } from "./TokenRecord";

/**
 * Calculates the balance of DAI across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - Aave allocator
 * - Aave allocator v2
 * - Rari allocator
 *
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @returns BigInt representing the balance
 */
export function getDaiBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  const daiERC20 = contracts[ERC20DAI_CONTRACT] as ERC20;
  const aDaiERC20 = contracts[ADAI_ERC20_CONTRACT] as ERC20;
  const rariAllocator = contracts[RARI_ALLOCATOR] as RariAllocator;

  const sources = [
    new TokenRecord(
      "DAI",
      "Treasury Wallet",
      TREASURY_ADDRESS,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(daiERC20, TREASURY_ADDRESS, blockNumber), 18)
    ),
    new TokenRecord(
      "DAI",
      "Treasury Wallet V2",
      TREASURY_ADDRESS_V2,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(daiERC20, TREASURY_ADDRESS_V2, blockNumber), 18)
    ),
    new TokenRecord(
      "DAI",
      "Treasury Wallet V3",
      TREASURY_ADDRESS_V3,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(daiERC20, TREASURY_ADDRESS_V3, blockNumber), 18)
    ),
    new TokenRecord(
      "DAI",
      "Aave Allocator",
      AAVE_ALLOCATOR,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(aDaiERC20, AAVE_ALLOCATOR, blockNumber), 18)
    ),
    new TokenRecord(
      "DAI",
      "Aave Allocator V2",
      AAVE_ALLOCATOR_V2,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          aDaiERC20,
          AAVE_ALLOCATOR_V2,
          blockNumber,
          BigInt.fromString(AAVE_ALLOCATOR_V2_BLOCK)
        ),
        18
      )
    ),
  ];

  // Rari allocator
  if (blockNumber.gt(BigInt.fromString(RARI_ALLOCATOR_BLOCK))) {
    sources.push(
      new TokenRecord(
        "DAI",
        "Rari Allocator",
        RARI_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(rariAllocator.amountAllocated(BigInt.fromI32(3)), 18)
      )
    );
  }

  return new TokenRecords(sources);
}

/**
 * Calculates the balance of FEI across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @returns BigInt representing the balance
 */
export function getFeiBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  const feiERC20 = contracts[FEI_ERC20_CONTRACT] as ERC20;

  const sources = [
    new TokenRecord(
      "FEI",
      "Treasury Wallet",
      TREASURY_ADDRESS,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(feiERC20, TREASURY_ADDRESS, blockNumber), 18)
    ),
    new TokenRecord(
      "FEI",
      "Treasury Wallet V2",
      TREASURY_ADDRESS_V2,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(feiERC20, TREASURY_ADDRESS_V2, blockNumber), 18)
    ),
    new TokenRecord(
      "FEI",
      "Treasury Wallet V3",
      TREASURY_ADDRESS_V3,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(feiERC20, TREASURY_ADDRESS_V3, blockNumber), 18)
    ),
  ];

  return new TokenRecords(sources);
}

/**
 * Calculates the balance of FRAX across the following:
 * - Convex allocator 1
 * - Convex allocator 2
 * - Convex allocator 3
 *
 * @param contracts object with bound contracts
 * @param blockNumber current block number
 * @returns BigInt representing the balance
 */
export function getFraxAllocatedInConvexBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  // TODO add to mv and mvrfv?
  const allocator1 = contracts[CONVEX_ALLOCATOR1] as ConvexAllocator;
  const allocator2 = contracts[CONVEX_ALLOCATOR2] as ConvexAllocator;
  const allocator3 = contracts[CONVEX_ALLOCATOR3] as ConvexAllocator;

  const sources = [];

  // Multiplied by 10e9 for consistency
  // TODO determine if the multiplier is correct

  if (blockNumber.gt(BigInt.fromString(CONVEX_ALLOCATOR1_BLOCK))) {
    sources.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 1",
        CONVEX_ALLOCATOR1,
        BigDecimal.fromString("1"),
        toDecimal(
          allocator1
            .totalValueDeployed()
            .times(BigInt.fromString("1000000000")),
          18
        )
      )
    );
  }

  if (blockNumber.gt(BigInt.fromString(CONVEX_ALLOCATOR2_BLOCK))) {
    sources.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 2",
        CONVEX_ALLOCATOR2,
        BigDecimal.fromString("1"),
        toDecimal(
          allocator2
            .totalValueDeployed()
            .times(BigInt.fromString("1000000000")),
          18
        )
      )
    );
  }

  if (blockNumber.gt(BigInt.fromString(CONVEX_ALLOCATOR3_BLOCK))) {
    sources.push(
      new TokenRecord(
        "FRAX",
        "Convex Allocator 3",
        CONVEX_ALLOCATOR3,
        BigDecimal.fromString("1"),
        toDecimal(
          allocator3
            .totalValueDeployed()
            .times(BigInt.fromString("1000000000")),
          18
        )
      )
    );
  }

  return new TokenRecords(sources);
}

/**
 * Calculates the balance of FRAX across the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - Convex allocators
 *
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @returns BigInt representing the balance
 */
export function getFraxBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  const fraxERC20 = contracts[ERC20FRAX_CONTRACT] as ERC20;

  const sources = [
    new TokenRecord(
      "FRAX",
      "Treasury Wallet",
      TREASURY_ADDRESS,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(fraxERC20, TREASURY_ADDRESS, blockNumber), 18)
    ),
    new TokenRecord(
      "FRAX",
      "Treasury Wallet V2",
      TREASURY_ADDRESS_V2,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(fraxERC20, TREASURY_ADDRESS_V2, blockNumber), 18)
    ),
    new TokenRecord(
      "FRAX",
      "Treasury Wallet V3",
      TREASURY_ADDRESS_V3,
      BigDecimal.fromString("1"),
      toDecimal(getBalance(fraxERC20, TREASURY_ADDRESS_V3, blockNumber), 18)
    ),
    ...getFraxAllocatedInConvexBalance(contracts, blockNumber).records,
  ];

  return new TokenRecords(sources);
}

/**
 * Returns the balance of LUSD tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 * - LUSD allocator
 *
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @returns BigInt representing the balance
 */
export function getLUSDBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  const lusdERC20 = contracts[LUSD_ERC20_CONTRACT] as ERC20;
  const stabilityPoolContract = contracts[STABILITY_POOL] as StabilityPool;

  const sources = [
    new TokenRecord(
      "LUSD",
      "Treasury Wallet",
      TREASURY_ADDRESS,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          lusdERC20,
          TREASURY_ADDRESS,
          blockNumber,
          BigInt.fromString(LUSD_ERC20_CONTRACTV2_BLOCK)
        ),
        18
      )
    ),
    new TokenRecord(
      "LUSD",
      "Treasury Wallet V2",
      TREASURY_ADDRESS_V2,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          lusdERC20,
          TREASURY_ADDRESS_V2,
          blockNumber,
          BigInt.fromString(LUSD_ERC20_CONTRACTV2_BLOCK)
        ),
        18
      )
    ),
    new TokenRecord(
      "LUSD",
      "Treasury Wallet V3",
      TREASURY_ADDRESS_V3,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          lusdERC20,
          TREASURY_ADDRESS_V3,
          blockNumber,
          BigInt.fromString(LUSD_ERC20_CONTRACTV2_BLOCK)
        ),
        18
      )
    ),
  ];

  if (blockNumber.gt(BigInt.fromString(LUSD_ALLOCATOR_BLOCK))) {
    sources.push(
      new TokenRecord(
        "LUSD",
        "LUSD Allocator",
        LUSD_ALLOCATOR,
        BigDecimal.fromString("1"),
        toDecimal(
          stabilityPoolContract.deposits(Address.fromString(LUSD_ALLOCATOR))
            .value0,
          18
        )
      )
    );
  }

  return new TokenRecords(sources);
}

/**
 * Returns the balance of UST tokens in the following:
 * - treasury address V1
 * - treasury address V2
 * - treasury address V3
 *
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @param treasury_address the v1 or v2 treasury address
 * @returns BigInt representing the balance
 */
export function getUSTBalance(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokenRecords {
  const ustERC20 = contracts[UST_ERC20_CONTRACT] as ERC20;

  const sources = [
    new TokenRecord(
      "UST",
      "Treasury Wallet",
      TREASURY_ADDRESS,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          ustERC20,
          TREASURY_ADDRESS,
          blockNumber,
          BigInt.fromString(UST_ERC20_CONTRACT_BLOCK)
        ),
        18
      )
    ),
    new TokenRecord(
      "UST",
      "Treasury Wallet V2",
      TREASURY_ADDRESS_V2,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          ustERC20,
          TREASURY_ADDRESS_V2,
          blockNumber,
          BigInt.fromString(UST_ERC20_CONTRACT_BLOCK)
        ),
        18
      )
    ),
    new TokenRecord(
      "UST",
      "Treasury Wallet V3",
      TREASURY_ADDRESS_V3,
      BigDecimal.fromString("1"),
      toDecimal(
        getBalance(
          ustERC20,
          TREASURY_ADDRESS_V3,
          blockNumber,
          BigInt.fromString(UST_ERC20_CONTRACT_BLOCK)
        ),
        18
      )
    ),
  ];

  return new TokenRecords(sources);
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
 * @param contracts object with bound contracts
 * @param blockNumber the current block number
 * @returns BigDecimal representing the balance
 */
export function getStableValue(
  contracts: contractsDictType,
  blockNumber: BigInt
): TokensRecords {
  const records = new TokensRecords();

  records.addToken("DAI", getDaiBalance(contracts, blockNumber));
  records.addToken("FRAX", getFraxBalance(contracts, blockNumber));
  records.addToken("UST", getUSTBalance(contracts, blockNumber));
  records.addToken("LUSD", getLUSDBalance(contracts, blockNumber));
  records.addToken("FEI", getFeiBalance(contracts, blockNumber));

  log.debug("Stablecoin tokens: {}", [records.toString()]);
  return records;
}
