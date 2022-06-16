import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt, toDecimal } from "../src/utils/Decimals";
import { getLiquidityBalances } from "../src/utils/LiquidityCalculations";
import {
  getOhmUSDPairRiskFreeValue,
  getUniswapV2PairTokenQuantity,
  getUniswapV2PairTotalTokenQuantity,
  getUniswapV2PairTotalValue,
  getUniswapV2PairValue,
} from "../src/utils/LiquidityUniswapV2";
import { PairHandler, PairHandlerTypes } from "../src/utils/PairHandler";
import {
  ERC20_STANDARD_DECIMALS,
  ETH_USD_RESERVE_BLOCK,
  getOhmEthPairValue,
  getPairValue,
  mockEthUsdRate,
  mockOhmEthPair,
  mockUniswapV2Pair,
  mockUsdOhmV2Rate,
  OHM_ETH_TOTAL_SUPPLY,
  OHM_USD_RESERVE_BLOCK,
  OHM_USD_RESERVE_OHM,
  OHM_USD_RESERVE_USD,
  OHM_USD_TOTAL_SUPPLY,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

// Limits the search to the OHM-DAI pairs, otherwise other pairs will be iterated over
const pairArrayOverride: PairHandler[] = [
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI_V2),
];

describe("Token Quantity", () => {
  test("total quantity of OHM token in pool", () => {
    const token0Reserves = BigInt.fromString("1233838296976506");
    const token1Reserves = BigInt.fromString("15258719216508026301937394");
    const totalSupply = BigInt.fromString("133005392717808439119");
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_DAI,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      token0Reserves,
      token1Reserves,
      totalSupply,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_STANDARD_DECIMALS,
    );

    const totalTokenQuantity = getUniswapV2PairTotalTokenQuantity(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(
      totalTokenQuantity.toString(),
      toDecimal(token0Reserves, OHM_V2_DECIMALS).toString(),
    );
  });

  test("balance of OHM V2 token in pool", () => {
    mockUsdOhmV2Rate();

    // Mock total value
    const token0Reserves = BigInt.fromString("1233838296976506");
    const token0ReservesDecimal = toDecimal(token0Reserves, OHM_V2_DECIMALS);
    const token1Reserves = BigInt.fromString("15258719216508026301937394");
    const totalSupply = BigInt.fromString("133005392717808439119");
    const totalSupplyDecimal = toDecimal(totalSupply, ERC20_STANDARD_DECIMALS);
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_DAI,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      token0Reserves,
      token1Reserves,
      totalSupply,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock balances
    const expectedBalanceV3 = BigDecimal.fromString("3");
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    // total token quantity * balance / total supply
    const expectedTokenBalance = token0ReservesDecimal
      .times(expectedBalanceV3)
      .div(totalSupplyDecimal);
    log.debug("expected OHM balance: {}", [expectedTokenBalance.toString()]);

    const records = getUniswapV2PairTokenQuantity(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(records.balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(records.value.toString(), expectedTokenBalance.toString());
  });

  test("balance of OHM V1 token in OHM V2 pool", () => {
    mockUsdOhmV2Rate();

    // Mock total value
    const token0Reserves = BigInt.fromString("1233838296976506");
    const token1Reserves = BigInt.fromString("15258719216508026301937394");
    const totalSupply = BigInt.fromString("133005392717808439119");
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_DAI,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      token0Reserves,
      token1Reserves,
      totalSupply,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock balances
    const expectedBalanceV3 = BigDecimal.fromString("3");
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getUniswapV2PairTokenQuantity(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals("0", records.balance.toString());
    assert.stringEquals("0", records.value.toString());
    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.records.length);
  });
});

describe("records", () => {
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

describe("pair value", () => {
  test("OHM-DAI pair value is correct", () => {
    const token0Reserves = BigInt.fromString("1233838296976506");
    const token1Reserves = BigInt.fromString("15258719216508026301937394");
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_DAI,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      token0Reserves,
      token1Reserves,
      BigInt.fromString("133005392717808439119"),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_STANDARD_DECIMALS,
    );

    const pairValue = getUniswapV2PairTotalValue(PAIR_UNISWAP_V2_OHM_DAI_V2, ETH_USD_RESERVE_BLOCK);
    // 12.36687113
    const ohmRate = toDecimal(token1Reserves, ERC20_STANDARD_DECIMALS).div(
      toDecimal(token0Reserves, OHM_V2_DECIMALS),
    );
    const calculatedValue = getPairValue(
      toDecimal(token0Reserves, OHM_V2_DECIMALS),
      toDecimal(token1Reserves, ERC20_STANDARD_DECIMALS),
      ohmRate,
      BigDecimal.fromString("1"),
    );

    assert.stringEquals(calculatedValue.toString(), pairValue.toString());
  });

  test("OHM-ETH pair value is correct", () => {
    mockOhmEthPair();
    mockUsdOhmV2Rate();
    mockEthUsdRate();

    const pairValue = getUniswapV2PairTotalValue(PAIR_UNISWAP_V2_OHM_ETH_V2, ETH_USD_RESERVE_BLOCK);
    const calculatedValue = getOhmEthPairValue();
    log.debug("difference: {}", [pairValue.minus(calculatedValue).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });

  test("OHM-ETH pair balance value is correct", () => {
    mockOhmEthPair();
    mockUsdOhmV2Rate();
    mockEthUsdRate();

    const lpBalance = BigInt.fromString("1000000000000000000");
    const balanceValue = getUniswapV2PairValue(
      lpBalance,
      PAIR_UNISWAP_V2_OHM_ETH_V2,
      ETH_USD_RESERVE_BLOCK,
    );

    // (balance / total supply) * pair value
    const calculatedValue = getOhmEthPairValue().times(
      toDecimal(lpBalance, 18).div(toDecimal(OHM_ETH_TOTAL_SUPPLY, 18)),
    );
    log.debug("difference: {}", [balanceValue.minus(calculatedValue).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      balanceValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });
});

describe("risk-free pair value", () => {
  test("risk-free pair value is correct", () => {
    mockUsdOhmV2Rate();

    const lpBalance = BigInt.fromString("1000000000000000000");
    const pairValue = getOhmUSDPairRiskFreeValue(
      lpBalance,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      OHM_USD_RESERVE_BLOCK,
    );
    // (# LP tokens / LP total supply) * (2) * sqrt(# DAI * # OHM)
    const calculatedValue = toDecimal(lpBalance, 18)
      .div(toDecimal(OHM_USD_TOTAL_SUPPLY, 18))
      .times(BigDecimal.fromString("2"))
      .times(
        toDecimal(
          toDecimal(OHM_USD_RESERVE_USD, ERC20_STANDARD_DECIMALS)
            .times(toDecimal(OHM_USD_RESERVE_OHM, OHM_V2_DECIMALS))
            .truncate(0)
            .digits.sqrt(),
          0,
        ),
      );
    log.debug("calculated risk-free value: {}", [calculatedValue.toString()]);
    log.debug("difference: {}", [pairValue.minus(calculatedValue).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });
});
