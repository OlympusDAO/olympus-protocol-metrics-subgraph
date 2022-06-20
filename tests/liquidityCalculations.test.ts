import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import {
  BALANCER_VAULT,
  DAO_WALLET,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_CRV_OHMETH,
  ERC20_CVX_OHMETH,
  ERC20_DAI,
  ERC20_OHM_V2,
  ERC20_WETH,
  PAIR_CURVE_OHM_ETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { getOwnedLiquidityPoolValue } from "../src/utils/LiquidityCalculations";
import { mockConvexStakedBalanceZero } from "./contractHelper.test";
import { mockBalancerVault, mockBalanceVaultZero } from "./liquidityBalancer.test";
import {
  ERC20_STANDARD_DECIMALS,
  ETH_USD_RESERVE_BLOCK,
  getEthUsdRate,
  getOhmUsdRate,
  getPairValue,
  mockCurvePairTotalValue,
  mockCurvePairZero,
  mockERC20TotalSupply,
  mockEthUsdRate,
  mockUniswapV2Pair,
  mockUniswapV2PairsZero,
  mockUsdOhmV2Rate,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY = BigDecimal.fromString("100");

describe("getLiquidityPoolValue", () => {
  test("exclude OHM value false, curve pool", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();

    // Mock pair
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

    const records = getOwnedLiquidityPoolValue(false, false, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals("1", record ? record.multiplier.toString() : "");
    assert.i32Equals(1, records.records.length);
  });

  test("exclude OHM value false, uniswapv2 pool", () => {
    mockUsdOhmV2Rate();

    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockCurvePairZero();

    // Mock pair
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_DAI,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      BigInt.fromString("1"),
      BigInt.fromString("1"),
      BigInt.fromString("1"),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock balance
    const expectedBalanceV3 = BigDecimal.fromString("3");
    mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getOwnedLiquidityPoolValue(false, false, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals("1", record ? record.multiplier.toString() : "");
    assert.i32Equals(1, records.records.length);
  });

  test("exclude OHM value false, balancer pool", () => {
    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockCurvePairZero();

    // Mock pool
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      BigDecimal.fromString("1"),
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BigDecimal.fromString("1"),
      BigDecimal.fromString("1"),
      BigDecimal.fromString("1"),
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(ERC20_BALANCER_OHM_DAI_WETH, WALLET_ADDRESSES);
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(false, false, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals("1", record ? record.multiplier.toString() : "");
    assert.i32Equals(1, records.records.length);
  });
});
