import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, test, log } from "matchstick-as/assembly/index";

import { TokenCategoryStable } from "../../shared/src/contracts/TokenDefinition";
import { toBigInt } from "../../shared/src/utils/Decimals";
import { CONVEX_STAKING_PROXY_FRAXBP, TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { getLiquidityBalances } from "../src/liquidity/LiquidityCalculations";
import {
  getCurvePairRecords,
  getCurvePairTokenQuantityRecords,
  getCurvePairTotalTokenQuantity,
  getCurvePairTotalValue,
} from "../src/liquidity/LiquidityCurve";
import {
  CONVEX_STAKING_FRAX_USDC_REWARD_POOL,
  CONVEX_STAKING_OHM_ETH_REWARD_POOL,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_CRV_FRAX_USDC,
  ERC20_CRV_OHMETH,
  ERC20_CVX_FRAX_USDC,
  ERC20_CVX_FRAX_USDC_STAKED,
  ERC20_CVX_OHMETH,
  ERC20_FRAX,
  ERC20_FRAX_BP,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_USDC,
  ERC20_WETH,
  FRAX_LOCKING_FRAX_USDC,
  getContractAbbreviation,
  getContractName,
  NATIVE_ETH,
  PAIR_CURVE_FRAX_USDC,
  PAIR_CURVE_OHM_ETH,
  PAIR_CURVE_OHM_FRAXBP,
  POOL_BALANCER_OHM_DAI_WETH_ID,
} from "../src/utils/Constants";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20TotalSupply } from "./erc20Helper";
import {
  getEthUsdRate,
  getOhmUsdRate,
  getPairValue,
  mockBalancerVaultZero,
  mockConvexStakedBalance,
  mockConvexStakedBalanceZero,
  mockCurvePairTotalValue,
  mockCurvePairZero,
  mockEthUsdRate,
  mockFraxLockedBalance,
  mockFraxLockedBalanceZero,
  mockFraxSwapPairZero,
  mockUniswapV2PairsZero,
  mockUniswapV3PairsZero,
  mockUsdOhmV2Rate,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { mockTreasuryAddressNull } from "./bophadesHelper";

const PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY = BigDecimal.fromString("100");
const TIMESTAMP = BigInt.fromString("1");
const BLOCK_NUMBER: BigInt = BigInt.fromString("14000000");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();

  mockBalancerVaultZero();
  mockUniswapV2PairsZero();
  mockFraxSwapPairZero();
  mockFraxLockedBalanceZero();
  mockCurvePairZero();
  mockUniswapV3PairsZero();

  mockEthUsdRate();
  mockStablecoinsPriceFeeds();
});

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
      BLOCK_NUMBER,
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockFraxLockedBalanceZero();
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getCurvePairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V1,
      BLOCK_NUMBER,
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockFraxLockedBalanceZero();
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    // total token quantity * balance / total supply
    const expectedTokenBalance = ohmReserves.times(crvBalance).div(crvTotalSupply);

    const records = getCurvePairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_CURVE_OHM_ETH,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
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
      expectedValue.truncate(4).toString(),
      getCurvePairTotalValue(PAIR_CURVE_OHM_ETH, false, BLOCK_NUMBER).truncate(4).toString(),
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
      expectedValue.truncate(4).toString(),
      getCurvePairTotalValue(PAIR_CURVE_OHM_ETH, true, BLOCK_NUMBER).truncate(4).toString(),
    );
  });

  test("OHM-ETH pair value is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalancerVaultZero();
    mockFraxLockedBalanceZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID, BLOCK_NUMBER),
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(TIMESTAMP, NATIVE_ETH, BLOCK_NUMBER);

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
    assert.stringEquals(expectedValue.truncate(4).toString(), records[0].value.truncate(4).toString());
    assert.stringEquals(expectedMultiplier.truncate(4).toString(), records[0].multiplier.truncate(4).toString());
    assert.stringEquals(expectedNonOhmValue.truncate(4).toString(), records[0].valueExcludingOhm.truncate(4).toString());
    assert.i32Equals(1, records.length);
  });

  test("OHM-ETH pair value before starting block", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalancerVaultZero();
    mockFraxLockedBalanceZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID, BLOCK_NUMBER),
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(TIMESTAMP, NATIVE_ETH, BLOCK_NUMBER);

    assert.i32Equals(0, records.length);
  });

  test("staked OHM-ETH pair value is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalancerVaultZero();
    mockFraxLockedBalanceZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID, BLOCK_NUMBER),
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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalance(
      ERC20_CVX_OHMETH,
      TREASURY_ADDRESS_V3,
      CONVEX_STAKING_OHM_ETH_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    const records = getLiquidityBalances(TIMESTAMP, NATIVE_ETH, BLOCK_NUMBER);

    const totalValueExpected = getPairValue(
      ohmReserves,
      wethReserves,
      getOhmUsdRate(),
      getEthUsdRate(),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    assert.stringEquals(expectedValue.truncate(4).toString(), records[0].value.truncate(4).toString());

    // The token name will have a suffix, making it hard to match, so search for the abbreviation
    const contractAbbreviation = getContractAbbreviation(ERC20_CVX_OHMETH);
    assert.assertTrue(records[0].token.includes(contractAbbreviation === null ? "abbreviation not found" : contractAbbreviation) == true); // cvxOHMETH should be mentioned in the id
    assert.i32Equals(1, records.length);
  });

  test("staked FRAX-USDC pair value is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalancerVaultZero();
    mockCurvePairZero();
    mockFraxSwapPairZero();
    mockFraxLockedBalanceZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID, BLOCK_NUMBER),
    );

    // Mock total value
    const fraxReserves = BigDecimal.fromString("100");
    const usdcReserves = BigDecimal.fromString("100");
    mockCurvePairTotalValue(
      PAIR_CURVE_FRAX_USDC,
      ERC20_CRV_FRAX_USDC,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_FRAX,
      ERC20_USDC,
      toBigInt(fraxReserves, ERC20_STANDARD_DECIMALS),
      toBigInt(usdcReserves, ERC20_STANDARD_DECIMALS),
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_FRAX_USDC,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    mockZeroWalletBalances(ERC20_CRV_FRAX_USDC, getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_FRAX_USDC, getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockFraxLockedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_USDC,
      CONVEX_STAKING_PROXY_FRAXBP,
      CONVEX_STAKING_FRAX_USDC_REWARD_POOL,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the staked Curve token

    const records = getLiquidityBalances(TIMESTAMP, ERC20_FRAX, BLOCK_NUMBER);

    const totalValueExpected = getPairValue(
      fraxReserves,
      usdcReserves,
      BigDecimal.fromString("1"),
      BigDecimal.fromString("1"),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    const record = records[0];
    assert.stringEquals(expectedValue.truncate(4).toString(), record.value.truncate(4).toString());
    assert.assertTrue(record.token.includes(getContractName(ERC20_CVX_FRAX_USDC)) == true); // Contract name should be mentioned in the id
    assert.stringEquals(TokenCategoryStable, record.category);
    assert.i32Equals(1, records.length);
  });

  test("Pair Value of FRAX-USDC staked in Convex and locked in Frax is correct", () => {
    // Mock liquidity
    mockUniswapV2PairsZero();
    mockBalancerVaultZero();
    mockCurvePairZero();
    mockFraxSwapPairZero();
    mockFraxLockedBalanceZero();
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID, BLOCK_NUMBER),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock total value
    const fraxReserves = BigDecimal.fromString("100");
    const usdcReserves = BigDecimal.fromString("100");
    mockCurvePairTotalValue(
      PAIR_CURVE_FRAX_USDC,
      ERC20_CRV_FRAX_USDC,
      ERC20_STANDARD_DECIMALS,
      PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY,
      ERC20_FRAX,
      ERC20_USDC,
      toBigInt(fraxReserves, ERC20_STANDARD_DECIMALS),
      toBigInt(usdcReserves, ERC20_STANDARD_DECIMALS),
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Total supply
    const crvTotalSupply = BigDecimal.fromString("20");
    mockERC20TotalSupply(
      ERC20_CRV_FRAX_USDC,
      ERC20_STANDARD_DECIMALS,
      toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
    );
    // Mock balance
    const crvBalance = BigDecimal.fromString("10");
    mockZeroWalletBalances(ERC20_CRV_FRAX_USDC, getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_FRAX_USDC, getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockFraxLockedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC, BLOCK_NUMBER));
    mockFraxLockedBalance(
      ERC20_CVX_FRAX_USDC_STAKED,
      CONVEX_STAKING_PROXY_FRAXBP,
      FRAX_LOCKING_FRAX_USDC,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    ); // Balance for the locked token

    const records = getLiquidityBalances(TIMESTAMP, ERC20_FRAX, BLOCK_NUMBER);

    const totalValueExpected = getPairValue(
      fraxReserves,
      usdcReserves,
      BigDecimal.fromString("1"),
      BigDecimal.fromString("1"),
    );
    const expectedValue = crvBalance.div(crvTotalSupply).times(totalValueExpected);
    const record = records[0];
    assert.stringEquals(expectedValue.truncate(4).toString(), record.value.truncate(4).toString());
    assert.assertTrue(record.token.includes(getContractName(ERC20_CVX_FRAX_USDC_STAKED)) == true);
    assert.stringEquals(TokenCategoryStable, record.category);
    assert.i32Equals(1, records.length);
  });
});

describe("pair records", () => {
  test("OHM-FRAXBP, OHM contract revert", () => {
    // Mock token0 reverting
    createMockedFunction(Address.fromString(ERC20_OHM_V2), "decimals", "decimals():(uint8)").reverts();
    // token1 OK
    mockERC20TotalSupply(ERC20_FRAX_BP, 18, BigInt.fromString("1000"));

    const expectedRecords = getCurvePairRecords(TIMESTAMP, PAIR_CURVE_OHM_FRAXBP, null, BLOCK_NUMBER);

    assert.i32Equals(0, expectedRecords.length);
  });

  test("OHM-FRAXBP, FRAXBP contract revert", () => {
    // token0 OK
    mockERC20TotalSupply(ERC20_OHM_V2, OHM_V2_DECIMALS, BigInt.fromString("1000"));
    // Mock token1 reverting
    createMockedFunction(Address.fromString(ERC20_FRAX_BP), "decimals", "decimals():(uint8)").reverts();

    const expectedRecords = getCurvePairRecords(TIMESTAMP, PAIR_CURVE_OHM_FRAXBP, null, BLOCK_NUMBER);

    assert.i32Equals(0, expectedRecords.length);
  });
});
