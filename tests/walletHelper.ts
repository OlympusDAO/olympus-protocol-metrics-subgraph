import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

export const mockWalletBalance = (
  walletAddress: string,
  tokenAddress: string,
  value: BigInt,
): void => {
  createMockedFunction(
    Address.fromString(walletAddress),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(tokenAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(value)]);
};

export const mockZeroWalletBalances = (walletAddress: string, tokenAddresses: string[]): void => {
  for (let i = 0; i < tokenAddresses.length; i++) {
    mockWalletBalance(walletAddress, tokenAddresses[i], BigInt.fromString("0"));
  }
};
