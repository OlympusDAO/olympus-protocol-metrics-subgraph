import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import { CONTRACT_STARTING_BLOCK_MAP, RARI_ALLOCATOR_BLOCK } from "./Constants";
import { toDecimal } from "./Decimals";

/**
 * The Graph recommends only binding a contract once
 * AssemblyScript doesn't like union types, so we have
 * to statically-type these contract maps.
 */
const contractsERC20 = new Map<string, ERC20>();
const contractsUniswapV2Pair = new Map<string, UniswapV2Pair>();
const contractsUniswapV3Pair = new Map<string, UniswapV3Pair>();
const contractsRariAllocator = new Map<string, RariAllocator>();
const contractsMasterChef = new Map<string, MasterChef>();
const contractsVeFXS = new Map<string, VeFXS>();
const contractsConvexAllocator = new Map<string, ConvexAllocator>();
const contractsStabilityPool = new Map<string, StabilityPool>();

/**
 * Indicates whether a contract exists at a given block number.
 *
 * This will check `CONTRACT_STARTING_BLOCK_MAP` for the presence
 * of the contract address at the given block number.
 *
 * If no starting block is defined, it is assumed that the
 * contract is present prior to the starting block of this subgraph
 * (currently 14000000).
 *
 * @param contractAddress
 * @param blockNumber
 */
function contractExistsAtBlock(contractAddress: string, blockNumber: BigInt): boolean {
  const startingBlock: string = CONTRACT_STARTING_BLOCK_MAP.get(contractAddress);
  log.debug("Starting block for contract {}: {}", [contractAddress, startingBlock]);

  // Assuming the starting block is much earlier
  if (!startingBlock) {
    log.debug("No starting block defined for contract {}. Assuming it is prior.", [
      contractAddress,
    ]);
    return true;
  }

  // Current block is before the starting block
  if (blockNumber < BigInt.fromString(startingBlock)) {
    log.debug("Current block is before the starting block. Skipping.", []);
    return false;
  }

  return true;
}

export function getERC20(contractAddress: string, currentBlockNumber: BigInt): ERC20 {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsERC20.get(contractAddress);

  if (!contract) {
    log.debug("Binding ERC20 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    contract = ERC20.bind(Address.fromString(contractAddress));
    contractsERC20.set(contractAddress, contract);
  }

  return contract;
}

export function getUniswapV2Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV2Pair {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsUniswapV2Pair.get(contractAddress);

  if (!contract) {
    contract = UniswapV2Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV2Pair.set(contractAddress, contract);
  }

  return contract;
}

export function getUniswapV3Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV3Pair {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsUniswapV3Pair.get(contractAddress);

  if (!contract) {
    contract = UniswapV3Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV3Pair.set(contractAddress, contract);
  }

  return contract;
}

export function getMasterChef(contractAddress: string, currentBlockNumber: BigInt): MasterChef {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsMasterChef.get(contractAddress);

  if (!contract) {
    contract = MasterChef.bind(Address.fromString(contractAddress));
    contractsMasterChef.set(contractAddress, contract);
  }

  return contract;
}

export function getRariAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): RariAllocator {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsRariAllocator.get(contractAddress);

  if (!contract) {
    contract = RariAllocator.bind(Address.fromString(contractAddress));
    contractsRariAllocator.set(contractAddress, contract);
  }

  return contract;
}

export function getVeFXS(contractAddress: string, currentBlockNumber: BigInt): VeFXS {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsVeFXS.get(contractAddress);

  if (!contract) {
    contract = VeFXS.bind(Address.fromString(contractAddress));
    contractsVeFXS.set(contractAddress, contract);
  }

  return contract;
}

export function getConvexAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): ConvexAllocator {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsConvexAllocator.get(contractAddress);

  if (!contract) {
    contract = ConvexAllocator.bind(Address.fromString(contractAddress));
    contractsConvexAllocator.set(contractAddress, contract);
  }

  return contract;
}

export function getStabilityPool(
  contractAddress: string,
  currentBlockNumber: BigInt,
): StabilityPool {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  let contract = contractsStabilityPool.get(contractAddress);

  if (!contract) {
    contract = StabilityPool.bind(Address.fromString(contractAddress));
    contractsStabilityPool.set(contractAddress, contract);
  }

  return contract;
}

/**
 * Helper method to simplify getting the balance from an ERC20 contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound ERC20 contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @param minimumBlockNumber The minimum block number for the balance to apply.
 * @returns BigInt
 */
export function getBalance(
  contract: ERC20,
  address: string,
  currentBlockNumber: BigInt,
  minimumBlockNumber: BigInt = BigInt.fromString("0"),
): BigInt {
  // No minimum, return the balance
  if (!minimumBlockNumber) {
    return contract.balanceOf(Address.fromString(address));
  }

  // Minimum set and passed, return the balance
  if (currentBlockNumber > minimumBlockNumber) {
    return contract.balanceOf(Address.fromString(address));
  }

  // Minimum set and not passed, return 0
  return BigInt.fromString("0");
}

/**
 * Determines the value of a given balance.
 *
 * @param balance Balance of a token
 * @param decimals Number of decimals
 * @param rate The conversion rate
 * @returns BigDecimal representing the value
 */
export function getValue(balance: BigInt, decimals: number, rate: BigDecimal): BigDecimal {
  return toDecimal(balance, decimals).times(rate);
}
