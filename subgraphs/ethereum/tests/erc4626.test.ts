import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, log,test } from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { ERC20_USDS, ERC4626_SUSDS } from "../src/utils/Constants";
import { getAllERC4626Balances } from "../src/utils/ERC4626";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";
import { mockPriceFeed } from "./chainlink";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const SDAI = "0x83F20F44975D03b1b09e64809B757c47f942BEeA";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

const SDAI_ASSETS_TO_SHARES = toDecimal(BigInt.fromString("1033238201161564342"), 18);
const SUSDS_ASSETS_TO_SHARES = toDecimal(BigInt.fromString("1040000000000000000"), 18);

const BLOCK_NUMBER = BigInt.fromString("14000000");

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

const mockERC4626Tokens = (): void => {
  mockERC4626Token(SDAI, DAI, SDAI_ASSETS_TO_SHARES, 18);
  mockERC4626Token(ERC4626_SUSDS, ERC20_USDS, SUSDS_ASSETS_TO_SHARES, 18);
};

const mockPriceFeeds = (): void => {
  mockPriceFeed(DAI, BigDecimal.fromString("1"));
  mockPriceFeed(ERC20_USDS, BigDecimal.fromString("1"));
};

describe("ERC4626", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    // Do at the start, as it can be used by mock functions
    mockTreasuryAddressNull();
    mockClearinghouseRegistryAddressNull();

    // Mock zero wallet balances
    mockZeroWalletBalances(
      SDAI,
      getWalletAddressesForContract(SDAI, BLOCK_NUMBER));
    mockZeroWalletBalances(
      ERC4626_SUSDS,
      getWalletAddressesForContract(ERC4626_SUSDS, BLOCK_NUMBER));
  });

  test("handles contract revert", () => {
    // Ensure there is a price feed for the underlying token
    mockPriceFeed(DAI, BigDecimal.fromString("1"));

    // ERC4626 contract reverts
    mockERC4626Reverts(SDAI);
    mockERC4626Reverts(ERC4626_SUSDS);

    // Mock balance
    mockWalletBalance(SDAI, TREASURY_ADDRESS_V3, toBigInt(BigDecimal.fromString("100"), 18));

    // Call function
    const records = getAllERC4626Balances(BigInt.zero(), BigInt.zero());
    assert.i32Equals(0, records.length);
  });

  test("success - sDAI", () => {
    // Ensure there is a price feed for the underlying token
    mockPriceFeeds();

    // Set up ERC4626 tokens
    mockERC4626Tokens();

    // Mock balance
    mockWalletBalance(SDAI, TREASURY_ADDRESS_V3, toBigInt(BigDecimal.fromString("100"), 18));

    // Call function
    const records = getAllERC4626Balances(BigInt.zero(), BigInt.zero());

    const recordOne = records[0];
    assert.stringEquals(recordOne.tokenAddress.toLowerCase(), SDAI.toLowerCase());
    assert.stringEquals(recordOne.sourceAddress.toLowerCase(), TREASURY_ADDRESS_V3.toLowerCase());
    assert.stringEquals(recordOne.balance.toString(), "100");
    assert.stringEquals(recordOne.rate.toString(), SDAI_ASSETS_TO_SHARES.toString());

    assert.i32Equals(1, records.length);
  });

  test("success - sUSDS", () => {
    // Ensure there is a price feed for the underlying token
    mockPriceFeeds();

    // Set up ERC4626 tokens
    mockERC4626Tokens();

    // Mock balance
    mockWalletBalance(ERC4626_SUSDS, TREASURY_ADDRESS_V3, toBigInt(BigDecimal.fromString("100"), 18));

    // Call function
    const records = getAllERC4626Balances(BigInt.zero(), BigInt.zero());

    const recordOne = records[0];
    assert.stringEquals(recordOne.tokenAddress.toLowerCase(), ERC4626_SUSDS.toLowerCase());
    assert.stringEquals(recordOne.sourceAddress.toLowerCase(), TREASURY_ADDRESS_V3.toLowerCase());
    assert.stringEquals(recordOne.balance.toString(), "100");
    assert.stringEquals(recordOne.rate.toString(), SUSDS_ASSETS_TO_SHARES.toString());

    assert.i32Equals(1, records.length);
  });
});