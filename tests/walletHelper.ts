import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

export const mockWalletBalance = (
  tokenAddress: string,
  walletAddress: string,
  value: BigInt,
): void => {
  createMockedFunction(
    Address.fromString(tokenAddress),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(value)]);
};

export const mockZeroWalletBalances = (tokenAddress: string, walletAddresses: string[]): void => {
  for (let i = 0; i < walletAddresses.length; i++) {
    mockWalletBalance(tokenAddress, walletAddresses[i], BigInt.fromString("0"));
  }
};
