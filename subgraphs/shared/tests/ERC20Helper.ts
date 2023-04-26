import { Address, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

import { ERC20 } from "../generated/Price/ERC20";
import { toBigInt } from "../src/utils/Decimals";

export function mockERC20Balance(walletAddress: string, tokenAddress: string, balance: BigDecimal): void {
  const contract = ERC20.bind(Address.fromString(tokenAddress));

  createMockedFunction(Address.fromString(tokenAddress), "balanceOf", "balanceOf(address):(uint256)").
    withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))]).
    returns([
      ethereum.Value.fromUnsignedBigInt(toBigInt(balance, contract.decimals()))
    ]);
}

export function mockERC20Balances(walletAddresses: string[], tokenAddress: string, balance: BigDecimal): void {
  for (let i = 0; i < walletAddresses.length; i++) {
    mockERC20Balance(walletAddresses[i], tokenAddress, balance);
  }
}