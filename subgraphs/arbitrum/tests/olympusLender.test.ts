import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { TYPE_LENDING } from "../../shared/src/utils/TokenSupplyHelper";
import { OLYMPUS_LENDER } from "../src/contracts/Constants";
import { getLendingAMOOHMRecords } from "../src/treasury/OhmCalculations";

function mockLenderAMOCount(lenderAddress: string, count: i64): void {
  createMockedFunction(
    Address.fromString(lenderAddress),
    "activeAMOCount",
    "activeAMOCount():(uint256)",
  ).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(count))]);
}

function mockLenderActiveAMOs(lenderAddress: string, amoAddresses: string[]): void {
  for (let i = 0; i < amoAddresses.length; i++) {
    createMockedFunction(
      Address.fromString(lenderAddress),
      "activeAMOs",
      "activeAMOs(uint256):(address)",
    ).
      withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(i))]).
      returns([ethereum.Value.fromAddress(Address.fromString(amoAddresses[i]))]);
  }
}

function mockLenderDeployedOhm(lenderAddress: string, amoAddress: string, deployedOhm: BigDecimal): void {
  const ohmBigInt: BigInt = toBigInt(deployedOhm, 9);

  createMockedFunction(
    Address.fromString(lenderAddress),
    "getDeployedOhm",
    "getDeployedOhm(address):(uint256)",
  ).
    withArgs([ethereum.Value.fromAddress(Address.fromString(amoAddress))]).
    returns([ethereum.Value.fromUnsignedBigInt(ohmBigInt)]);
}

const amoOne = "0xA8578c9A73C2b4F75968EC76d6689045ff68B97C".toLowerCase();
const amoTwo = "0x5a6A4D54456819380173272A5E8E9B9904BdF41B".toLowerCase();

describe("olympus lender", () => {
  test("resolves lending AMO records", () => {
    mockLenderAMOCount(OLYMPUS_LENDER, 2);
    mockLenderActiveAMOs(OLYMPUS_LENDER, [amoOne, amoTwo]);

    const amoOneBalance = BigDecimal.fromString("100.1");
    const amoTwoBalance = BigDecimal.fromString("200.2");

    mockLenderDeployedOhm(OLYMPUS_LENDER, amoOne, amoOneBalance);
    mockLenderDeployedOhm(OLYMPUS_LENDER, amoTwo, amoTwoBalance);

    // Grab records
    const records = getLendingAMOOHMRecords(BigInt.fromI32(1), BigInt.fromI32(1));

    // Verify
    const recordOne = records[0];
    assert.stringEquals(recordOne.source!.toString(), `Olympus Lender - ${amoOne}`);
    assert.stringEquals(recordOne.sourceAddress!.toString(), amoOne);
    assert.stringEquals(recordOne.type, TYPE_LENDING);
    assert.stringEquals(recordOne.balance.toString(), amoOneBalance.toString());
    assert.stringEquals(recordOne.supplyBalance.toString(), `-${amoOneBalance.toString()}`);

    const recordTwo = records[1];
    assert.stringEquals(recordTwo.source!.toString(), `Olympus Lender - ${amoTwo}`);
    assert.stringEquals(recordTwo.sourceAddress!.toString(), amoTwo);
    assert.stringEquals(recordTwo.type, TYPE_LENDING);
    assert.stringEquals(recordTwo.balance.toString(), amoTwoBalance.toString());
    assert.stringEquals(recordTwo.supplyBalance.toString(), `-${amoTwoBalance.toString()}`);

    assert.i32Equals(records.length, 2);
  });

  test("handles revert on AMO count", () => {
    createMockedFunction(
      Address.fromString(OLYMPUS_LENDER),
      "activeAMOCount",
      "activeAMOCount():(uint256)",
    ).reverts();

    // Grab records
    const records = getLendingAMOOHMRecords(BigInt.fromI32(1), BigInt.fromI32(1));

    // Verify
    assert.i32Equals(records.length, 0);
  });

  test("handles revert on AMO address", () => {
    mockLenderAMOCount(OLYMPUS_LENDER, 1);

    createMockedFunction(
      Address.fromString(OLYMPUS_LENDER),
      "activeAMOs",
      "activeAMOs(uint256):(address)",
    ).
      withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(0))]).
      reverts();

    // Grab records
    const records = getLendingAMOOHMRecords(BigInt.fromI32(1), BigInt.fromI32(1));

    // Verify
    assert.i32Equals(records.length, 0);
  });

  test("handles revert on deployed OHM", () => {
    mockLenderAMOCount(OLYMPUS_LENDER, 1);
    mockLenderActiveAMOs(OLYMPUS_LENDER, [amoOne]);

    createMockedFunction(
      Address.fromString(OLYMPUS_LENDER),
      "getDeployedOhm",
      "getDeployedOhm(address):(uint256)",
    ).
      withArgs([ethereum.Value.fromAddress(Address.fromString(amoOne))]).
      reverts();

    // Grab records
    const records = getLendingAMOOHMRecords(BigInt.fromI32(1), BigInt.fromI32(1));

    // Verify
    assert.i32Equals(records.length, 0);
  });
});
