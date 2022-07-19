import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import {
  CONVEX_ALLOCATOR3,
  CONVEX_ALLOCATORS,
  CONVEX_STAKING_CONTRACTS,
  CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
  DAO_WALLET,
  ERC20_ALCX,
  ERC20_CVX_FRAX_3CRV,
  ERC20_CVX_OHMETH,
  ERC20_FRAX_3CRV,
  ERC20_TOKE,
  ERC20_WETH,
  getWalletAddressesForContract,
  NATIVE_ETH,
  TOKE_STAKING,
  TREASURY_ADDRESS_V3,
} from "../src/utils/Constants";
import {
  getConvexStakedBalance,
  getConvexStakedRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getTokeStakedBalancesFromWallets,
} from "../src/utils/ContractHelper";
import { toBigInt } from "../src/utils/Decimals";
import { ERC20_STANDARD_DECIMALS } from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

export const mockConvexStakedBalance = (
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "stakingToken", "stakingToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(allocatorAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockConvexStakedBalanceZero = (allocators: string[] = CONVEX_ALLOCATORS): void => {
  for (let i = 0; i < allocators.length; i++) {
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      mockConvexStakedBalance(
        ERC20_CVX_FRAX_3CRV,
        allocators[i],
        CONVEX_STAKING_CONTRACTS[j],
        BigInt.zero(),
      );
      mockConvexStakedBalance(
        ERC20_CVX_OHMETH,
        allocators[i],
        CONVEX_STAKING_CONTRACTS[j],
        BigInt.zero(),
      );
    }
  }
};

export const mockTokeStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "tokeToken", "tokeToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockTokeStakedBalanceZero = (wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    mockTokeStakedBalance(ERC20_TOKE, wallets[i], TOKE_STAKING, BigInt.zero());
  }
};

describe("Staked Convex", () => {
  test("ignores invalid address", () => {
    const calculatedBalance = getConvexStakedBalance(
      NATIVE_ETH,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance ? false : true);
  });

  test("stakingToken reverts", () => {
    createMockedFunction(
      Address.fromString(CONVEX_STAKING_FRAX_3CRV_REWARD_POOL),
      "stakingToken",
      "stakingToken():(address)",
    ).reverts();

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance === null);
  });

  test("cvxFRAX3CRV balance", () => {
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.stringEquals("5", calculatedBalance ? calculatedBalance.toString() : "");
  });

  test("different token to reward pool staking token", () => {
    mockConvexStakedBalance(
      ERC20_FRAX_3CRV, // Different token
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance ? false : true);
  });

  test("cvxFRAX3CRV token records", () => {
    mockConvexStakedBalanceZero();
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const records = getConvexStakedRecords("metric", ERC20_CVX_FRAX_3CRV, BigInt.fromString("1"));
    // 5 * $1
    assert.stringEquals("5", records.value.toString());
  });
});

describe("get ERC20 token records from wallets", () => {
  test("excludes token not on whitelist", () => {
    mockZeroWalletBalances(ERC20_ALCX, getWalletAddressesForContract(ERC20_ALCX));

    // Set balance of the non-whitelist token
    mockWalletBalance(ERC20_ALCX, DAO_WALLET, toBigInt(BigDecimal.fromString("10")));
    createMockedFunction(
      Address.fromString(ERC20_ALCX.toLowerCase()),
      "decimals",
      "decimals():(uint8)",
    ).returns([ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS)]);

    const blockNumber = BigInt.fromString("1");
    const contract = getERC20("ALCX", ERC20_ALCX, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      "metric",
      ERC20_ALCX,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    assert.i32Equals(0, records.records.length);
  });

  test("includes token in DAO wallet on whitelist", () => {
    mockZeroWalletBalances(ERC20_WETH, getWalletAddressesForContract(ERC20_WETH));

    // Set balance of the whitelist token
    const tokenBalance = "10";
    mockWalletBalance(ERC20_WETH, DAO_WALLET, toBigInt(BigDecimal.fromString(tokenBalance)));
    createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
      ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
    ]);

    const blockNumber = BigInt.fromString("1");
    const contract = getERC20("wETH", ERC20_WETH, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      "metric",
      ERC20_WETH,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals(tokenBalance, record ? record.balance.toString() : "");
    assert.i32Equals(1, records.records.length);
  });
});

describe("get TOKE staked records", () => {
  test("passed token does not match tokeToken", () => {
    // There is a balance
    mockTokeStakedBalance(
      ERC20_TOKE,
      TREASURY_ADDRESS_V3,
      TOKE_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    // Ignored as the token does not match the staking contract
    const records = getTokeStakedBalancesFromWallets(
      "metric",
      ERC20_ALCX,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    assert.i32Equals(0, records.records.length);
  });

  test("staking contract reverts", () => {
    createMockedFunction(
      Address.fromString(TOKE_STAKING),
      "tokeToken",
      "tokeToken():(address)",
    ).reverts();

    const records = getTokeStakedBalancesFromWallets(
      "metric",
      ERC20_TOKE,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    // Returns no records as the staking contract reverted
    assert.i32Equals(0, records.records.length);
  });

  test("staking contract returns balance", () => {
    mockTokeStakedBalanceZero(getWalletAddressesForContract(ERC20_TOKE));
    // There is a balance
    mockTokeStakedBalance(
      ERC20_TOKE,
      TREASURY_ADDRESS_V3,
      TOKE_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    const records = getTokeStakedBalancesFromWallets(
      "metric",
      ERC20_TOKE,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    const recordOne = TokenRecord.load(records.records[0]);
    assert.stringEquals("10", recordOne ? recordOne.balance.toString() : "");
    assert.stringEquals("2", recordOne ? recordOne.rate.toString() : "");
    assert.i32Equals(1, records.records.length);
  });
});
