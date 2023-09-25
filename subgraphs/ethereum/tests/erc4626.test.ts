import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly/index";
import { mockPriceFeed } from "./chainlink";
import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { getAllERC4626Balances } from "../src/utils/ERC4626";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";

const SDAI = "0x83F20F44975D03b1b09e64809B757c47f942BEeA";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

const ASSETS_TO_SHARES = toDecimal(BigInt.fromString("1033238201161564342"), 18);

const mockERC4626Reverts = (
  tokenAddress: string,
): void => {
  createMockedFunction(
    Address.fromString(tokenAddress),
    "asset",
    "asset():(address)",
  ).reverts();
};

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

describe("ERC4626", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    // Mock zero wallet balances
    mockZeroWalletBalances(
      SDAI,
      getWalletAddressesForContract(SDAI));
  });

  test("handles contract revert", () => {
    // Ensure there is a price feed for the underlying token
    mockPriceFeed(DAI, BigDecimal.fromString("1"));

    // ERC4626 contract reverts
    mockERC4626Reverts(SDAI);

    // Mock balance
    mockWalletBalance(SDAI, TREASURY_ADDRESS_V3, toBigInt(BigDecimal.fromString("100"), 18));

    // Call function
    const records = getAllERC4626Balances(BigInt.zero(), BigInt.zero());
    assert.i32Equals(0, records.length);
  });

  test("success", () => {
    // Ensure there is a price feed for the underlying token
    mockPriceFeed(DAI, BigDecimal.fromString("1"));

    // Set up ERC4626 token
    mockERC4626Token(
      SDAI,
      DAI,
      ASSETS_TO_SHARES,
      18,
    );

    // Mock balance
    mockWalletBalance(SDAI, TREASURY_ADDRESS_V3, toBigInt(BigDecimal.fromString("100"), 18));

    // Call function
    const records = getAllERC4626Balances(BigInt.zero(), BigInt.zero());

    const recordOne = records[0];
    assert.stringEquals(recordOne.tokenAddress.toLowerCase(), SDAI.toLowerCase());
    assert.stringEquals(recordOne.sourceAddress.toLowerCase(), TREASURY_ADDRESS_V3.toLowerCase());
    assert.stringEquals(recordOne.balance.toString(), "100");
    assert.stringEquals(recordOne.rate.toString(), ASSETS_TO_SHARES.toString());

    assert.i32Equals(1, records.length);
  });
});