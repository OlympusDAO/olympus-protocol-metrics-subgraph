import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";

const BLOCK_NUMBER = BigInt.fromString("14000000");

export function mockUniswapV3Positions(
  positionManager: string,
  walletAddress: string,
  positions: BigInt[],
): void {
  // Mock the position count
  createMockedFunction(
    Address.fromString(positionManager),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(positions.length))]);

  // Mock the position
  for (let i = 0; i < positions.length; i++) {
    createMockedFunction(
      Address.fromString(positionManager),
      "tokenOfOwnerByIndex",
      "tokenOfOwnerByIndex(address,uint256):(uint256)",
    ).withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress)), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(i))]).
      returns([ethereum.Value.fromUnsignedBigInt(positions[i])]);
  }
}

export function mockUniswapV3PositionsZero(
  positionManager: string,
): void {
  // Get all wallets
  const wallets = getWalletAddressesForContract(positionManager, BLOCK_NUMBER);

  for (let i = 0; i < wallets.length; i++) {
    mockUniswapV3Positions(positionManager, wallets[i], []);
  }
}

export function mockUniswapV3Pair(
  pairAddress: string,
  token0: string,
  token1: string,
  sqrtPriceX96: BigInt,
  tick: BigInt,
): void {
  // Mock the pair
  createMockedFunction(
    Address.fromString(pairAddress),
    "slot0",
    "slot0():(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(sqrtPriceX96),
    ethereum.Value.fromSignedBigInt(tick),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromBoolean(false),
  ]);

  // Mock the token0
  createMockedFunction(
    Address.fromString(pairAddress),
    "token0",
    "token0():(address)",
  ).returns([ethereum.Value.fromAddress(Address.fromString(token0))]);

  // Mock the token1
  createMockedFunction(
    Address.fromString(pairAddress),
    "token1",
    "token1():(address)",
  ).returns([ethereum.Value.fromAddress(Address.fromString(token1))]);
}

export function mockUniswapV3Position(
  positionManager: string,
  walletAddress: string,
  position: BigInt,
  token0: string,
  token1: string,
  liquidity: BigInt,
  tickLower: BigInt,
  tickUpper: BigInt,
): void {
  // Mock the position
  createMockedFunction(
    Address.fromString(positionManager),
    "positions",
    "positions(uint256):(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  ).withArgs([ethereum.Value.fromUnsignedBigInt(position)]).
    returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // Nonce
      ethereum.Value.fromAddress(Address.zero()), // Operator
      ethereum.Value.fromAddress(Address.fromString(token0)), // Token0
      ethereum.Value.fromAddress(Address.fromString(token1)), // Token1
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // Fee
      ethereum.Value.fromSignedBigInt(tickLower), // TickLower
      ethereum.Value.fromSignedBigInt(tickUpper), // TickUpper
      ethereum.Value.fromUnsignedBigInt(liquidity), // Liquidity
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // FeeGrowthInside0LastX128
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // FeeGrowthInside1LastX128
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // TokensOwed0
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // TokensOwed1
    ]);
}
