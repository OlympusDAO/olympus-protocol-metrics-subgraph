import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, test } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { DAO_WALLET } from "../../shared/src/Wallets";
import { ERC20_LQTY, ERC20_LUSD, ERC20_TRIBE, ERC20_WETH, LIQUITY_STABILITY_POOL } from "../src/utils/Constants";
import {
  getLiquityStabilityPoolRecords,
} from "../src/utils/ContractHelper";
import { ERC20_STANDARD_DECIMALS, mockERC20TotalSupply } from "./erc20Helper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";

const LUSD_BALANCE = "100";
const LUSD_BALANCE_INT = toBigInt(BigDecimal.fromString(LUSD_BALANCE), ERC20_STANDARD_DECIMALS);
const WETH_BALANCE = "10";
const WETH_BALANCE_INT = toBigInt(BigDecimal.fromString(WETH_BALANCE), ERC20_STANDARD_DECIMALS);
const LQTY_BALANCE = "20";
const LQTY_BALANCE_INT = toBigInt(BigDecimal.fromString(LQTY_BALANCE), ERC20_STANDARD_DECIMALS);

const TIMESTAMP = BigInt.fromString("1");
const BLOCK_NUMBER: BigInt = BigInt.fromString("14000000");

function mockLiquityAllocator(
  address: string,
  lusdAmountAllocated: BigInt,
  wEthBalance: BigInt,
  lqtyBalance: BigInt,
): void {
  const stabilityPoolAddress = Address.fromString(LIQUITY_STABILITY_POOL);

  // LUSD balance
  createMockedFunction(stabilityPoolAddress, "deposits", "deposits(address):(uint256,address)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(address))])
    .returns([ethereum.Value.fromUnsignedBigInt(lusdAmountAllocated), ethereum.Value.fromAddress(Address.zero())]);

  // wETH balance
  createMockedFunction(stabilityPoolAddress, "getDepositorETHGain", "getDepositorETHGain(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(address))])
    .returns([
      ethereum.Value.fromUnsignedBigInt(wEthBalance),
    ]);

  // LQTY balance
  createMockedFunction(stabilityPoolAddress, "getDepositorLQTYGain", "getDepositorLQTYGain(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(address))])
    .returns([
      ethereum.Value.fromUnsignedBigInt(lqtyBalance),
    ]);
}

function mockLiquityBalanceZero(): void {
  const wallets = getWalletAddressesForContract(LIQUITY_STABILITY_POOL, BLOCK_NUMBER);
  for (let i = 0; i < wallets.length; i++) {
    mockLiquityAllocator(wallets[i], BigInt.fromString("0"), BigInt.fromString("0"), BigInt.fromString("0"));
  }

  mockERC20TotalSupply(ERC20_LUSD, ERC20_STANDARD_DECIMALS, BigInt.fromI32(1));
  mockERC20TotalSupply(ERC20_WETH, ERC20_STANDARD_DECIMALS, BigInt.fromI32(1));
  mockERC20TotalSupply(ERC20_LQTY, ERC20_STANDARD_DECIMALS, BigInt.fromI32(1));
}

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();
  mockLiquityBalanceZero();
});

test("LUSD balance", () => {
  mockLiquityAllocator(DAO_WALLET, LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_LUSD,
    rate,
    BLOCK_NUMBER,
  );

  assert.stringEquals(LUSD_BALANCE, allocatorRecords[0].balance.toString());
  assert.i32Equals(1, allocatorRecords.length);
});

test("wETH rewards", () => {
  mockLiquityAllocator(DAO_WALLET, LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_WETH,
    rate,
    BLOCK_NUMBER,
  );

  assert.stringEquals(WETH_BALANCE, allocatorRecords[0].balance.toString());
  assert.i32Equals(1, allocatorRecords.length);
});

test("LQTY rewards", () => {
  mockLiquityAllocator(DAO_WALLET, LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_LQTY,
    rate,
    BLOCK_NUMBER,
  );

  assert.stringEquals(LQTY_BALANCE, allocatorRecords[0].balance.toString());
  assert.i32Equals(1, allocatorRecords.length);
});

test("other token", () => {
  mockLiquityAllocator(DAO_WALLET, LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  mockERC20TotalSupply(ERC20_TRIBE, ERC20_STANDARD_DECIMALS, BigInt.fromI32(1));
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_TRIBE,
    rate,
    BLOCK_NUMBER,
  );

  assert.i32Equals(0, allocatorRecords.length);
});

test("LUSD records", () => {
  mockLiquityAllocator(DAO_WALLET, LUSD_BALANCE_INT, WETH_BALANCE_INT, LQTY_BALANCE_INT);
  const rate = BigDecimal.fromString("2");

  const allocatorRecords = getLiquityStabilityPoolRecords(
    TIMESTAMP,
    ERC20_LUSD,
    rate,
    BLOCK_NUMBER,
  );

  assert.stringEquals(
    rate.times(BigDecimal.fromString(LUSD_BALANCE)).toString(),
    allocatorRecords[0].value.toString(),
  );
  assert.i32Equals(1, allocatorRecords.length);
});
