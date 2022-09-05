import { Address, BigInt } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../generated/Price/ERC20";

export function getERC20(tokenAddress: string, _block: BigInt): ERC20 {
  return ERC20.bind(Address.fromString(tokenAddress));
}

export function getDecimals(tokenAddress: string, block: BigInt): number {
  const contract = getERC20(tokenAddress, block);
  return contract.decimals();
}
