import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_OHM_V1,
  NATIVE_ETH,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { getLiquidityBalances } from "../src/utils/LiquidityCalculations";
import { PairHandler, PairHandlerTypes } from "../src/utils/PairHandler";
import { getOhmUSDPairRiskFreeValue, getUniswapV2PairValue } from "../src/utils/Price";
import {
  getOhmUsdRate,
  mockCurveOhmEthPair,
  mockEthUsdRate,
  mockUniswapV2Pair,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

// Limits the search to the OHM-DAI pairs, otherwise other pairs will be iterated over
const pairArrayOverride: PairHandler[] = [
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI_V2),
];

describe("UniswapV2", () => {
  test("generates TokenRecords for the given token", () => {
    const expectedBalanceV2 = BigDecimal.fromString("2");
    const expectedBalanceV3 = BigDecimal.fromString("3");

    // OHM-DAI V1
    mockUniswapV2Pair(
      ERC20_OHM_V1,
      ERC20_DAI,
      9,
      18,
      BigInt.fromString("382999881424"),
      BigInt.fromString("23566162832855719933607"),
      BigInt.fromString("76219775050984762"),
      PAIR_UNISWAP_V2_OHM_DAI,
      18,
    );
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

    // OHM-DAI V2
    mockUsdOhmV2Rate();
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V2, toBigInt(expectedBalanceV2));
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getLiquidityBalances(
      ERC20_DAI,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
      pairArrayOverride,
    );
    // We can call this because we are testing that the single-sided value is returned
    // Separate tests are there for the pair value verification
    const pairValue = getUniswapV2PairValue(
      toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance stays the same
    assert.stringEquals(
      expectedBalanceV2.plus(expectedBalanceV3).toString(),
      records.balance.toString(),
    );
    // Value multiplied by 0.5 due to being single-sided
    assert.stringEquals(pairValue.toString(), records.value.toString());
  });

  test("applies a multiplier when singleSidedValue is true", () => {
    const expectedBalanceV2 = BigDecimal.fromString("2");
    const expectedBalanceV3 = BigDecimal.fromString("3");

    // OHM-DAI V1
    mockUniswapV2Pair(
      ERC20_OHM_V1,
      ERC20_DAI,
      9,
      18,
      BigInt.fromString("382999881424"),
      BigInt.fromString("23566162832855719933607"),
      BigInt.fromString("76219775050984762"),
      PAIR_UNISWAP_V2_OHM_DAI,
      18,
    );
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

    // OHM-DAI V2
    mockUsdOhmV2Rate();
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V2, toBigInt(expectedBalanceV2));
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getLiquidityBalances(
      ERC20_DAI,
      false,
      true,
      OHM_USD_RESERVE_BLOCK,
      pairArrayOverride,
    );
    // We can call this because we are testing that the single-sided value is returned
    // Separate tests are there for the pair value verification
    const pairValue = getUniswapV2PairValue(
      toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance stays the same
    assert.stringEquals(
      expectedBalanceV2.plus(expectedBalanceV3).toString(),
      records.balance.toString(),
    );
    // Value multiplied by 0.5 due to being single-sided
    assert.stringEquals(
      pairValue.times(BigDecimal.fromString("0.5")).toString(),
      records.value.toString(),
    );
  });

  test("returns risk-free value when riskFree is true", () => {
    const expectedBalanceV2 = BigDecimal.fromString("2");
    const expectedBalanceV3 = BigDecimal.fromString("3");

    // OHM-DAI V1
    mockUniswapV2Pair(
      ERC20_OHM_V1,
      ERC20_DAI,
      9,
      18,
      BigInt.fromString("382999881424"),
      BigInt.fromString("23566162832855719933607"),
      BigInt.fromString("76219775050984762"),
      PAIR_UNISWAP_V2_OHM_DAI,
      18,
    );
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

    // OHM-DAI V2
    mockUsdOhmV2Rate();
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V2, toBigInt(expectedBalanceV2));
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getLiquidityBalances(
      ERC20_DAI,
      true,
      false,
      OHM_USD_RESERVE_BLOCK,
      pairArrayOverride,
    );
    // We can call this because we are testing that the risk-free value is returned
    // Separate tests are there for the risk-free value verification
    const pairValue = getOhmUSDPairRiskFreeValue(
      toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance stays the same
    assert.stringEquals(
      expectedBalanceV2.plus(expectedBalanceV3).toString(),
      records.balance.toString(),
    );
    // Value is the risk-free value
    assert.stringEquals(pairValue.toString(), records.value.toString());
  });
});

describe("Curve", () => {
  test("OHM-ETH pair value is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock balance
    const ohmBalance = BigDecimal.fromString("100");
    mockCurveOhmEthPair(toBigInt(ohmBalance, OHM_V2_DECIMALS));
    // 100 OHM @ ~19
    // 1 ETH @ ~1898

    const records = getLiquidityBalances(NATIVE_ETH, false, false, OHM_USD_RESERVE_BLOCK);

    // Total value = OHM rate * OHM balance + ETH rate * ETH balance
    // OHM value = ETH value, we can just double the OHM value
    const expectedValue = ohmBalance.times(getOhmUsdRate()).times(BigDecimal.fromString("2"));
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });
});
