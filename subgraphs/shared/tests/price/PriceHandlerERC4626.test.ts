import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as";

import { ContractNameLookup } from "../../src/contracts/ContractLookup";
import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { PriceHandlerERC4626 } from "../../src/price/PriceHandlerERC4626";
import { toBigInt, toDecimal } from "../../src/utils/Decimals";

const ERC4626_SUSDS = "0x808507121B80c02388fAd1472645B5fb38389452".toLowerCase();
const ERC20_USDS = "0x639A647f9770d913b564BF333464C3CFD9FD292e".toLowerCase();
const BLOCK = BigInt.fromString("1");
const SUSDS_ASSETS_TO_SHARES = toDecimal(BigInt.fromString("1040000000000000000"), 18);

const mockERC4626Token = (
    tokenAddress: string,
    underlyingTokenAddress: string,
    assetsToShares: BigDecimal,
    decimals: u8,
  ): void => {
    const contractAddress = Address.fromString(tokenAddress);

    // Underlying token address
    createMockedFunction(contractAddress, "asset", "asset():(address)").returns([ethereum.Value.fromAddress(Address.fromString(underlyingTokenAddress))]);

    // Decimals
    createMockedFunction(contractAddress, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(decimals))]);

    // Assets to shares
    createMockedFunction(contractAddress, "convertToAssets", "convertToAssets(uint256):(uint256)").
      withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromU32(10).pow(decimals))]).
      returns([ethereum.Value.fromUnsignedBigInt(toBigInt(assetsToShares, decimals))]);
  };

  const mockERC4626Tokens = (): void => {
    mockERC4626Token(ERC4626_SUSDS, ERC20_USDS, SUSDS_ASSETS_TO_SHARES, 18);
  };

describe("getPrice", () => {
    test("returns the price of the vault token", () => {
        const priceLookup: PriceLookup = (_tokenAddress: string, _block: BigInt): PriceLookupResult => {
            return {
                liquidity: BigDecimal.fromString("1"),
                price: BigDecimal.fromString("1"),
            };
        };

        const contractLookup: ContractNameLookup = (_tokenAddress: string): string => "sUSDS";

        // Mock the values
        mockERC4626Tokens();

        const handler = new PriceHandlerERC4626(ERC4626_SUSDS, ERC20_USDS, contractLookup);

        // Should return the price of the vault token
        const priceResult = handler.getPrice(ERC4626_SUSDS, priceLookup, BLOCK);
        assert.stringEquals(
            SUSDS_ASSETS_TO_SHARES.toString(),
            priceResult ? priceResult.price.toString() : "",
        );
    })
})
