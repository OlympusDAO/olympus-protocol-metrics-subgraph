import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test, log } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { DAO_WALLET, TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { getOwnedLiquidityPoolValue } from "../src/liquidity/LiquidityCalculations";
import {
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_CRV_OHMETH,
  ERC20_CVX_OHMETH,
  ERC20_DAI,
  ERC20_OHM_V2,
  ERC20_WETH,
  PAIR_CURVE_OHM_ETH,
  PAIR_FRAXSWAP_V1_OHM_FRAX,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
} from "../src/utils/Constants";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20TotalSupply } from "./erc20Helper";
import {
  mockBalancerVaultOhmDaiEth,
  mockBalancerVaultZero,
  mockConvexStakedBalanceZero,
  mockCurvePairTotalValue,
  mockCurvePairZero,
  mockEthUsdRate,
  mockFraxLockedBalanceZero,
  mockFraxSwapPairOhmFrax,
  mockFraxSwapPairZero,
  mockUniswapV2Pair,
  mockUniswapV2PairsZero,
  mockUniswapV3PairsZero,
  mockUsdOhmV2Rate,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";

const PAIR_CURVE_OHM_ETH_TOTAL_SUPPLY = BigDecimal.fromString("100");
const TIMESTAMP = BigInt.fromString("1");
const BLOCK_NUMBER: BigInt = BigInt.fromString("14000000");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();
  mockClearinghouseRegistryAddressNull();

  // Mock other liquidity pools
  mockBalancerVaultZero();
  mockUniswapV2PairsZero();
  mockFraxSwapPairZero();
  mockFraxLockedBalanceZero();
  mockCurvePairZero();
  mockUniswapV3PairsZero();

  mockEthUsdRate();
  mockStablecoinsPriceFeeds();
})

describe("getLiquidityPoolValue", () => {
  test("curve pool", () => {
    mockUsdOhmV2Rate();

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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockWalletBalance(
      ERC20_CRV_OHMETH,
      TREASURY_ADDRESS_V3,
      toBigInt(crvBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, BLOCK_NUMBER);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("FraxSwap pool", () => {
    mockFraxSwapPairOhmFrax();

    // Mock balance
    const balance = BigDecimal.fromString("10");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(balance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, BLOCK_NUMBER);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("curve pool includes DAO wallet", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

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
    mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockZeroWalletBalances(ERC20_CVX_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));
    mockConvexStakedBalanceZero(getWalletAddressesForContract(PAIR_CURVE_OHM_ETH, BLOCK_NUMBER));

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

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, BLOCK_NUMBER);

    const recordOne = records[0]; // DAO wallet
    assert.stringEquals("11", recordOne.balance.toString());
    const recordTwo = records[1]; // Treasury
    assert.stringEquals("10", recordTwo.balance.toString());
    assert.i32Equals(2, records.length);
  });

  test("uniswapv2 pool", () => {
    mockUsdOhmV2Rate();

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
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2, BLOCK_NUMBER),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, BLOCK_NUMBER);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });

  test("balancer pool", () => {
    // Mock pool
    mockBalancerVaultOhmDaiEth();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2, BLOCK_NUMBER),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getOwnedLiquidityPoolValue(TIMESTAMP, BLOCK_NUMBER);

    // We already know that the individual pool values are tested
    // We just want to test the inputs against the outputs
    assert.i32Equals(1, records.length);
  });
});
