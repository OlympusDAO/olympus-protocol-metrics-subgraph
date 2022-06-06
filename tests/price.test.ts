import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { PAIR_UNISWAP_V2_USDC_ETH } from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";
import { getBaseETHUSDRate } from "../src/utils/Price";

describe("getBaseETHUSDRate()", () => {
  test("Should return a rate", () => {
    const contractAddress = Address.fromString(PAIR_UNISWAP_V2_USDC_ETH);

    const usdReserve = BigInt.fromString("51366826766840");
    const ethReserve = BigInt.fromString("27063460795012214253805");
    // Real values from the LP contract
    createMockedFunction(
      contractAddress,
      "getReserves",
      "getReserves():(uint112,uint112,uint32)",
    ).returns([
      ethereum.Value.fromUnsignedBigInt(usdReserve),
      ethereum.Value.fromUnsignedBigInt(ethReserve),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1654504965")),
    ]);

    // We expect the rate to be calculated as USD/ETH (value0/value1)
    const usd = toDecimal(usdReserve, 6);
    const eth = toDecimal(ethReserve, 18);
    const rate = usd.div(eth);

    assert.stringEquals(getBaseETHUSDRate().toString(), rate.toString());
  });
});
