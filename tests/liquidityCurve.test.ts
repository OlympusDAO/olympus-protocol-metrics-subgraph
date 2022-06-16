import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import {
  CONVEX_STAKING_OHM_ETH_REWARD_POOL,
  DAO_WALLET,
  ERC20_CRV_OHMETH,
  ERC20_CVX_OHMETH,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_WETH,
  getContractName,
  NATIVE_ETH,
  PAIR_CURVE_OHM_ETH,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { getLiquidityBalances } from "../src/utils/LiquidityCalculations";
import {
  getCurvePairTokenQuantity,
  getCurvePairTotalTokenQuantity,
  getCurvePairTotalValue,
} from "../src/utils/LiquidityCurve";
import { mockConvexStakedBalance, mockConvexStakedBalanceZero } from "./contractHelper.test";
import {
  ERC20_STANDARD_DECIMALS,
  getEthUsdRate,
  getOhmUsdRate,
  getPairValue,
  mockCurvePairTotalValue,
  mockERC20TotalSupply,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY = BigDecimal.fromString("100");

describe("Token Quantity", () => {
  test("total quantity of OHM token in pool", () => {
    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    const totalTokenQuantity = getCurvePairTotalTokenQuantity(
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(totalTokenQuantity.toString(), ohmReserves.toString());
  });

  test("balance of OHM V2 token in OMH V2 pool", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantity(
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(records.balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(records.value.toString(), expectedTokenBalance.toString());
  });

  test("balance of OHM V1 token in OMH V2 pool", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantity(
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals("0", records.balance.toString());
    assert.stringEquals("0", records.value.toString());
    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.records.length);
  });

  test("balance of OHM V2 token in OMH V2 pool in DAO wallet", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockWalletBalance(ERC20_CRV_OHMETH, DAO_WALLET, toBigInt(crvBalance, ERC20_STANDARD_DECIMALS));

    const records = getCurvePairTokenQuantity(
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals("0", records.balance.toString());
    assert.stringEquals("0", records.value.toString());
    // Should be empty records due to 0 balance of OHM V2
    assert.i32Equals(0, records.records.length);
  });

  test("balance of OHM token in staked pool", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantity(
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(records.balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(records.value.toString(), expectedTokenBalance.toString());
  });
});

describe("Pair Value", () => {
  test("OHM-ETH pair total value is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock balance
    const ohmBalance = BigDecimal.fromString("100");
    const wethBalance = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmBalance, OHM_V2_DECIMALS),
      toBigInt(wethBalance, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    const expectedValue = getPairValue(ohmBalance, wethBalance, getOhmUsdRate(), getEthUsdRate());
    assert.stringEquals(
      expectedValue.toString(),
      getCurvePairTotalValue(PAIR_CURVE_OHM_ETH, OHM_USD_RESERVE_BLOCK).toString(),
    );
  });

  test("OHM-ETH pair value is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(NATIVE_ETH, false, false, OHM_USD_RESERVE_BLOCK);

    const totalValueExpected = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-ETH pair value, exclude OHM value", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock balance
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(NATIVE_ETH, false, true, OHM_USD_RESERVE_BLOCK);

    const totalValueExpected = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    // 0.5 * total value
    const expectedValue = crvBalance
      .div(crvTotalSupply)
      .times(totalValueExpected)
      .times(BigDecimal.fromString("0.5"));
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("staked OHM-ETH pair value is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    const allocators = WALLET_ADDRESSES.concat([DAO_WALLET]);
    mockZeroWalletBalances(ERC20_CRV_OHMETH, allocators);
    mockZeroWalletBalances(ERC20_CVX_OHMETH, allocators);
    mockConvexStakedBalanceZero(allocators);
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    const records = getLiquidityBalances(NATIVE_ETH, false, false, OHM_USD_RESERVE_BLOCK);

    const totalValueExpected = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
    assert.assertTrue(records.records[0].includes(getContractName(ERC20_CVX_OHMETH)) == true); // cvxOHMETH should be mentioned in the id
    assert.i32Equals(records.records.length, 1);
  });
});
