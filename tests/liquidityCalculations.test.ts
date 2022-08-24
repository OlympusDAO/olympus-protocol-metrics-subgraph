import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { getOwnedLiquidityPoolValue } from "../src/liquidity/LiquidityCalculations";
import {
  DAO_WALLET,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_CRV_OHMETH,
  ERC20_CVX_OHMETH,
  ERC20_DAI,
  ERC20_OHM_V2,
  ERC20_WETH,
  getWalletAddressesForContract,
  PAIR_CURVE_OHM_ETH,
  PAIR_FRAXSWAP_OHM_FRAX,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  TREASURY_ADDRESS_V3,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { mockConvexStakedBalanceZero } from "./contractHelper.test";
import { mockBalanceVaultOhmDaiEth, mockBalanceVaultZero } from "./liquidityBalancer.test";
import { mockFraxSwapPairOhmFrax, mockFraxSwapPairZero } from "./liquidityFraxSwap.test";
import {
  ERC20_STANDARD_DECIMALS,
  ETH_USD_RESERVE_BLOCK,
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
const TIMESTAMP = BigInt.fromString("1");

describe("getLiquidityPoolValue", () => {
  test("curve pool", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock other liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockFraxSwapPairZero();

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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("FraxSwap pool", () => {
    // Mock other liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockCurvePairZero();

    mockFraxSwapPairOhmFrax();

    // Mock balance
    const balance = BigDecimal.fromString("10");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_OHM_FRAX),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(balance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("curve pool includes DAO wallet", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockFraxSwapPairZero();

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
    const crvBalanceTwo = BigDecimal.fromString("11");
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));

    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock balance in the DAO wallet, which should be whitelisted
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      DAO_WALLET,
      toBigInt(crvBalanceTwo, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, ETH_USD_RESERVE_BLOCK);

    const record = records[0];
    assert.stringEquals("10", record.balance.toString());
    const recordTwo = records[1];
    assert.stringEquals("11", recordTwo.balance.toString());
    assert.i32Equals(2, records.length);
  });

  test("uniswapv2 pool", () => {
    mockUsdOhmV2Rate();

    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockCurvePairZero();
    mockFraxSwapPairZero();

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
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("balancer pool", () => {
    // Mock liquidity pools
    mockBalanceVaultZero();
    mockUniswapV2PairsZero();
    mockCurvePairZero();
    mockFraxSwapPairZero();

    // Mock pool
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, ETH_USD_RESERVE_BLOCK);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });
});
