import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
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

export function getERC20(contractAddress: string): ERC20 {
  let contract = contractsERC20.get(contractAddress);

  if (!contract) {
    contract = ERC20.bind(Address.fromString(contractAddress));
    contractsERC20.set(contractAddress, contract);
  }

  return contract;
}

export function getUniswapV2Pair(contractAddress: string): UniswapV2Pair {
  let contract = contractsUniswapV2Pair.get(contractAddress);

  if (!contract) {
    contract = UniswapV2Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV2Pair.set(contractAddress, contract);
  }

  return contract;
}

export function getUniswapV3Pair(contractAddress: string): UniswapV3Pair {
  let contract = contractsUniswapV3Pair.get(contractAddress);

  if (!contract) {
    contract = UniswapV3Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV3Pair.set(contractAddress, contract);
  }

  return contract;
}

export function getMasterChef(contractAddress: string): MasterChef {
  let contract = contractsMasterChef.get(contractAddress);

  if (!contract) {
    contract = MasterChef.bind(Address.fromString(contractAddress));
    contractsMasterChef.set(contractAddress, contract);
  }

  return contract;
}

export function getRariAllocator(contractAddress: string): RariAllocator {
  let contract = contractsRariAllocator.get(contractAddress);

  if (!contract) {
    contract = RariAllocator.bind(Address.fromString(contractAddress));
    contractsRariAllocator.set(contractAddress, contract);
  }

  return contract;
}

export function getVeFXS(contractAddress: string): VeFXS {
  let contract = contractsVeFXS.get(contractAddress);

  if (!contract) {
    contract = VeFXS.bind(Address.fromString(contractAddress));
    contractsVeFXS.set(contractAddress, contract);
  }

  return contract;
}

export function getConvexAllocator(contractAddress: string): ConvexAllocator {
  let contract = contractsConvexAllocator.get(contractAddress);

  if (!contract) {
    contract = ConvexAllocator.bind(Address.fromString(contractAddress));
    contractsConvexAllocator.set(contractAddress, contract);
  }

  return contract;
}

export function getStabilityPool(contractAddress: string): StabilityPool {
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
  minimumBlockNumber?: BigInt
): BigInt {
  // No minimum, return the balance
  if (!minimumBlockNumber)
    {return contract.balanceOf(Address.fromString(address));}

  // Minimum set and passed, return the balance
  if (currentBlockNumber > minimumBlockNumber)
    {return contract.balanceOf(Address.fromString(address));}

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
export function getValue(
  balance: BigInt,
  decimals: number,
  rate: BigDecimal
): BigDecimal {
  return toDecimal(balance, decimals).times(rate);
}
