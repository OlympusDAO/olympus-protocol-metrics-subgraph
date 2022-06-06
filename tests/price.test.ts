import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";
import { getBaseETHUSDRate, getBaseOHMUSDRate } from "../src/utils/Price";

describe("ETH-USD rate", () => {
  test("rate calculation is correct", () => {
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

  test(
    "should throw an error when the pair cannot be accessed",
    () => {
      // UniswapV2Pair will return null if the pair doesn't exist at the current block
      const contractAddress = Address.fromString(PAIR_UNISWAP_V2_USDC_ETH);
      createMockedFunction(
        contractAddress,
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).returns([]);

      getBaseETHUSDRate();
    },
    true,
  );
});

describe("OHM-USD rate", () => {
  test("rate calculation is correct", () => {
    const contractAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2);

    const ohmReserve = BigInt.fromString("994866147276819");
    const usdReserve = BigInt.fromString("18867842715859452534935831");
    // Real values from the LP contract
    createMockedFunction(
      contractAddress,
      "getReserves",
      "getReserves():(uint112,uint112,uint32)",
    ).returns([
      ethereum.Value.fromUnsignedBigInt(ohmReserve),
      ethereum.Value.fromUnsignedBigInt(usdReserve),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1654504965")),
    ]);

    // We expect the rate to be calculated as USD/OHM (value1/value0)
    const ohm = toDecimal(ohmReserve, 9);
    const usd = toDecimal(usdReserve, 18);
    const rate = usd.div(ohm);

    assert.stringEquals(
      getBaseOHMUSDRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
      rate.toString(),
    );
  });

  test(
    "should throw an error when the pair cannot be accessed",
    () => {
      // UniswapV2Pair will return null if the pair doesn't exist at the current block
      const contractAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2);
      createMockedFunction(
        contractAddress,
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).returns([]);

      getBaseOHMUSDRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      );
    },
    true,
  );
});
