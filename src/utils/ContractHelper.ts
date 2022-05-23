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

export type contractsDictType = {
  [key: string]:
    | ERC20
    | UniswapV2Pair
    | RariAllocator
    | MasterChef
    | VeFXS
    | ConvexAllocator
    | UniswapV3Pair
    | StabilityPool;
};

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
    return contract.balanceOf(Address.fromString(address));

  // Minimum set and passed, return the balance
  if (currentBlockNumber > minimumBlockNumber)
    return contract.balanceOf(Address.fromString(address));

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
