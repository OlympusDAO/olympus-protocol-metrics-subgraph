import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import { CONTRACT_STARTING_BLOCK_MAP } from "./Constants";
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
  log.debug("Checking for starting block of contract {}", [contractAddress]);

  // Assuming the starting block is much earlier
  if (!CONTRACT_STARTING_BLOCK_MAP.has(contractAddress)) {
    log.debug("No starting block defined for contract {}. Assuming it is prior", [contractAddress]);
    return true;
  }

  const startingBlock: string = CONTRACT_STARTING_BLOCK_MAP.get(contractAddress);
  log.debug("Starting block for contract {}: {}", [contractAddress, startingBlock]);

  // Current block is before the starting block
  if (blockNumber < BigInt.fromString(startingBlock)) {
    log.debug("Current block is before the starting block. Skipping", []);
    return false;
  }

  return true;
}

export function getERC20(contractAddress: string, currentBlockNumber: BigInt): ERC20 {
  log.debug("Fetching ERC20 contract for address {}", [contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsERC20.has(contractAddress)) {
    log.debug("Binding ERC20 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = ERC20.bind(Address.fromString(contractAddress));
    contractsERC20.set(contractAddress, contract);
  }

  return contractsERC20.get(contractAddress);
}

export function getUniswapV2Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV2Pair {
  log.debug("Fetching UniswapV2Pair contract for address {}", [contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsUniswapV2Pair.has(contractAddress)) {
    log.debug("Binding UniswapV2Pair contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = UniswapV2Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV2Pair.set(contractAddress, contract);
  }

  return contractsUniswapV2Pair.get(contractAddress);
}

export function getUniswapV3Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV3Pair {
  log.debug("Fetching UniswapV3Pair contract for address {}", [contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsUniswapV3Pair.has(contractAddress)) {
    log.debug("Binding UniswapV3Pair contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = UniswapV3Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV3Pair.set(contractAddress, contract);
  }

  return contractsUniswapV3Pair.get(contractAddress);
}

export function getMasterChef(contractAddress: string, currentBlockNumber: BigInt): MasterChef {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsMasterChef.has(contractAddress)) {
    log.debug("Binding MasterChef contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = MasterChef.bind(Address.fromString(contractAddress));
    contractsMasterChef.set(contractAddress, contract);
  }

  return contractsMasterChef.get(contractAddress);
}

export function getRariAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): RariAllocator {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsRariAllocator.has(contractAddress)) {
    log.debug("Binding RariAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = RariAllocator.bind(Address.fromString(contractAddress));
    contractsRariAllocator.set(contractAddress, contract);
  }

  return contractsRariAllocator.get(contractAddress);
}

export function getVeFXS(contractAddress: string, currentBlockNumber: BigInt): VeFXS {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsVeFXS.has(contractAddress)) {
    log.debug("Binding VeFXS contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = VeFXS.bind(Address.fromString(contractAddress));
    contractsVeFXS.set(contractAddress, contract);
  }

  return contractsVeFXS.get(contractAddress);
}

export function getConvexAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): ConvexAllocator {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsConvexAllocator.has(contractAddress)) {
    log.debug("Binding ConvexAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = ConvexAllocator.bind(Address.fromString(contractAddress));
    contractsConvexAllocator.set(contractAddress, contract);
  }

  return contractsConvexAllocator.get(contractAddress);
}

export function getStabilityPool(
  contractAddress: string,
  currentBlockNumber: BigInt,
): StabilityPool {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsStabilityPool.has(contractAddress)) {
    log.debug("Binding StabilityPool contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = StabilityPool.bind(Address.fromString(contractAddress));
    contractsStabilityPool.set(contractAddress, contract);
  }

  return contractsStabilityPool.get(contractAddress);
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
export function getBalance(contract: ERC20, address: string, currentBlockNumber: BigInt): BigInt {
  const callResult = contract.try_name();
  log.debug("Getting ERC20 balance in contract {} for wallet {} at block number {}", [
    callResult.reverted ? "N/A" : callResult.value,
    address,
    currentBlockNumber.toString(),
  ]);

  if (!contractExistsAtBlock(address, currentBlockNumber)) return BigInt.fromString("0");

  // const balanceResult = contract.try_balanceOf(Address.fromString(address));
  // if (balanceResult.reverted) {
  //   log.error("balanceOf function was reverted on contract {}", [callResult.value]);
  //   return BigInt.fromString("0");
  // }

  // log.debug("Got balance: {}", [balanceResult.value.toString()]);
  // return balanceResult.value;
  return contract.balanceOf(Address.fromString(address));
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
