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
