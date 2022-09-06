import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, test } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { LUSD_ALLOCATOR } from "../../shared/src/Wallets";
import { ERC20_LQTY, ERC20_LUSD, ERC20_TRIBE, ERC20_WETH } from "../src/utils/Constants";
import {
  getLiquityStabilityPoolBalance,
  getLiquityStabilityPoolRecords,
} from "../src/utils/ContractHelper";
import { ERC20_STANDARD_DECIMALS, OHM_USD_RESERVE_BLOCK } from "./pairHelper";

const LUSD_BALANCE = "100";
const LUSD_BALANCE_INT = toBigInt(BigDecimal.fromString(LUSD_BALANCE), ERC20_STANDARD_DECIMALS);
const WETH_BALANCE = "10";
const WETH_BALANCE_INT = toBigInt(BigDecimal.fromString(WETH_BALANCE), ERC20_STANDARD_DECIMALS);
const LQTY_BALANCE = "20";
const LQTY_BALANCE_INT = toBigInt(BigDecimal.fromString(LQTY_BALANCE), ERC20_STANDARD_DECIMALS);

const TIMESTAMP = BigInt.fromString("1");

function mockLiquityAllocator(
  lusdAmountAllocated: BigInt,
  wEthBalance: BigInt,
  lqtyBalance: BigInt,
): void {
  const allocatorAddress = Address.fromString(LUSD_ALLOCATOR);

  // LUSD balance
  createMockedFunction(allocatorAddress, "amountAllocated", "amountAllocated(uint256):(uint256)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
    .returns([ethereum.Value.fromUnsignedBigInt(lusdAmountAllocated)]);

  // wETH balance
  createMockedFunction(allocatorAddress, "getETHRewards", "getETHRewards():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(wEthBalance),
  ]);

  // LQTY balance
  createMockedFunction(allocatorAddress, "getLQTYRewards", "getLQTYRewards():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(lqtyBalance),
  ]);
}

test("LUSD balance", () => {
  mockLiquityAllocator(LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);

  const allocatorBalance = getLiquityStabilityPoolBalance(
    LUSD_ALLOCATOR,
    ERC20_LUSD,
    OHM_USD_RESERVE_BLOCK,
  );

  assert.stringEquals(LUSD_BALANCE, allocatorBalance ? allocatorBalance.toString() : "");
});

test("wETH rewards", () => {
  mockLiquityAllocator(LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);

  const allocatorBalance = getLiquityStabilityPoolBalance(
    LUSD_ALLOCATOR,
    ERC20_WETH,
    OHM_USD_RESERVE_BLOCK,
  );

  assert.stringEquals(WETH_BALANCE, allocatorBalance ? allocatorBalance.toString() : "");
});

test("LQTY rewards", () => {
  mockLiquityAllocator(LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);

  const allocatorBalance = getLiquityStabilityPoolBalance(
    LUSD_ALLOCATOR,
    ERC20_LQTY,
    OHM_USD_RESERVE_BLOCK,
  );

  assert.stringEquals(LQTY_BALANCE, allocatorBalance ? allocatorBalance.toString() : "");
});

test("other token", () => {
  mockLiquityAllocator(LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);

  const allocatorBalance = getLiquityStabilityPoolBalance(
    LUSD_ALLOCATOR,
    ERC20_TRIBE,
    OHM_USD_RESERVE_BLOCK,
  );

  assert.assertNull(allocatorBalance ? "" : null);
});

test("LUSD records", () => {
  mockLiquityAllocator(LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_LUSD,
    rate,
    OHM_USD_RESERVE_BLOCK,
  );

  assert.stringEquals(
    rate.times(BigDecimal.fromString(LUSD_BALANCE)).toString(),
    allocatorRecords[0].value.toString(),
  );
  assert.i32Equals(1, allocatorRecords.length);
});
