import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { getLiquidityBalances } from "../src/liquidity/LiquidityCalculations";
import {
  getCurvePairTokenQuantity,
  getCurvePairTotalTokenQuantity,
  getCurvePairTotalValue,
} from "../src/liquidity/LiquidityCurve";
import {
  CONVEX_STAKING_OHM_ETH_REWARD_POOL,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_CRV_OHMETH,
  ERC20_CVX_OHMETH,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_WETH,
  getContractName,
  getWalletAddressesForContract,
  NATIVE_ETH,
  PAIR_CURVE_OHM_ETH,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  TREASURY_ADDRESS_V3,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { mockConvexStakedBalance, mockConvexStakedBalanceZero } from "./contractHelper.test";
import { mockBalanceVaultZero } from "./liquidityBalancer.test";
import {
  ERC20_STANDARD_DECIMALS,
  getEthUsdRate,
  getOhmUsdRate,
  getPairValue,
  mockCurvePairTotalValue,
  mockERC20TotalSupply,
  mockEthUsdRate,
  mockUniswapV2PairsZero,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY = BigDecimal.fromString("100");
const TIMESTAMP = BigInt.fromString("1");

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

  test("balance of OHM V2 token in OMH V2 pool prior to starting block", () => {
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

    // Total supply is 0 prior to starting block
    const crvTotalSupply = BigDecimal.fromString("0");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantity(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to starting block
    assert.i32Equals(0, records.length);
  });

  test("balance of OHM V2 token in OMH V2 pool, token call reverts", () => {
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

    // Total supply is 0 prior to starting block
    const crvTotalSupply = BigDecimal.fromString("0");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );

    // The Curve pair token may also revert
    createMockedFunction(
      Address.fromString(PAIR_CURVE_OHM_ETH),
      "token",
      "token():(address)",
    ).reverts();

    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantity(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to starting block
    assert.i32Equals(0, records.length);
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantity(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(expectedTokenBalance.toString(), records[0].balance.toString());
    assert.i32Equals(1, records.length);
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantity(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.length);
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantity(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(expectedTokenBalance.toString(), records[0].balance.toString());
    assert.i32Equals(1, records.length);
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
      getCurvePairTotalValue(PAIR_CURVE_OHM_ETH, false, OHM_USD_RESERVE_BLOCK).toString(),
    );
  });

  test("OHM-ETH pair total value, exclude OHM", () => {
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

    const expectedValue = wethBalance.times(getEthUsdRate());
    assert.stringEquals(
      expectedValue.toString(),
      getCurvePairTotalValue(PAIR_CURVE_OHM_ETH, true, OHM_USD_RESERVE_BLOCK).toString(),
    );
  });

  test("OHM-ETH pair value is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalanceVaultZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );

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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(
      TIMESTAMP,
      NATIVE_ETH,
      false,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    const expectedNonOhmTotalValue = wethReserves.times(getEthUsdRate());
    const expectedTotalValue = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    const expectedMultiplier = expectedNonOhmTotalValue.div(expectedTotalValue);
    const expectedValue = crvBalance.div(crvTotalSupply).times(expectedTotalValue);
    const expectedNonOhmValue = crvBalance
      .div(crvTotalSupply)
      .times(expectedTotalValue)
      .times(expectedMultiplier);
    assert.stringEquals(expectedValue.toString(), records[0].value.toString());
    assert.stringEquals(expectedMultiplier.toString(), records[0].multiplier.toString());
    assert.stringEquals(expectedNonOhmValue.toString(), records[0].valueExcludingOhm.toString());
    assert.i32Equals(1, records.length);
  });

  test("OHM-ETH pair value before starting block", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalanceVaultZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );

    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const ohmReserves = BigDecimal.fromString("100");
    const wethReserves = BigDecimal.fromString("105");
    mockCurvePairTotalValue(
      PAIR_CURVE_OHM_ETH,
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      BigDecimal.fromString("0"), // before starting block
      ERC20_OHM_V2,
      ERC20_WETH,
      toBigInt(ohmReserves, OHM_V2_DECIMALS),
      toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("0");
    mockERC20TotalSupply(
      ERC20_CRV_OHMETH,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(
      TIMESTAMP,
      NATIVE_ETH,
      false,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.i32Equals(0, records.length);
  });

  test("staked OHM-ETH pair value is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalanceVaultZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );

    // Mock price lookup
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    const records = getLiquidityBalances(
      TIMESTAMP,
      NATIVE_ETH,
      false,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    const totalValueExpected = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    assert.stringEquals(expectedValue.toString(), records[0].value.toString());
    assert.assertTrue(records[0].token.includes(getContractName(ERC20_CVX_OHMETH)) == true); // cvxOHMETH should be mentioned in the id
    assert.i32Equals(1, records.length);
  });
});
