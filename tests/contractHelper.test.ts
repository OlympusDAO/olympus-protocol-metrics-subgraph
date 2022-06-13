import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  ALLOCATOR_CONVEX_FRAX_CONTRACTS,
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
  ERC20_CVX_FRAX_3CRV,
  ERC20_FRAX_3CRV,
  NATIVE_ETH,
} from "../src/utils/Constants";
import { getConvexStakedBalance, getConvexStakedRecords } from "../src/utils/ContractHelper";
import { toBigInt } from "../src/utils/Decimals";
import { ERC20_STANDARD_DECIMALS } from "./pairHelper";

const mockConvexStakedBalance = (
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

export const mockConvexStakedBalanceZero = (): void => {
  for (let i = 0; i < ALLOCATOR_CONVEX_FRAX_CONTRACTS.length; i++) {
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      ALLOCATOR_CONVEX_FRAX_CONTRACTS[i],
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.zero(),
    );
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
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR1,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("0"), ERC20_STANDARD_DECIMALS),
    );
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR2,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("0"), ERC20_STANDARD_DECIMALS),
    );
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const records = getConvexStakedRecords(ERC20_CVX_FRAX_3CRV, BigInt.fromString("1"));
    // 5 * $1
    assert.stringEquals("5", records.value.toString());
  });
});
