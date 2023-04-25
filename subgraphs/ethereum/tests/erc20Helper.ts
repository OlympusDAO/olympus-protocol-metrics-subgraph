import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

export const ERC20_STANDARD_DECIMALS = 18;

export const mockERC20TotalSupply = (
    token: string,
    tokenDecimals: i32,
    totalSupply: BigInt,
): void => {
    const tokenAddress = Address.fromString(token);

    // Total supply
    createMockedFunction(tokenAddress, "totalSupply", "totalSupply():(uint256)").returns([
        ethereum.Value.fromUnsignedBigInt(totalSupply),
    ]);

    // Token decimals
    createMockedFunction(tokenAddress, "decimals", "decimals():(uint8)").returns([
        ethereum.Value.fromI32(tokenDecimals),
    ]);
};

export const mockERC20Decimals = (
    token: string,
    decimals: i32,
): void => {
    createMockedFunction(Address.fromString(token), "decimals", "decimals():(uint8)").returns([
        ethereum.Value.fromI32(decimals),
    ]);
};

export const mockERC20Balance = (
    token: string,
    wallet: string,
    balance: BigInt,
): void => {
    createMockedFunction(Address.fromString(token), "balanceOf", "balanceOf(address):(uint256)").
        withArgs([ethereum.Value.fromAddress(Address.fromString(wallet))]).
        returns([
            ethereum.Value.fromUnsignedBigInt(balance),
        ]);
}