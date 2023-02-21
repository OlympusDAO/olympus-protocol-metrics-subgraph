import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { getLiquidityBalances } from "../src/liquidity/LiquidityCalculations";
import {
  getUniswapV2PairTokenQuantity,
  getUniswapV2PairTotalTokenQuantity,
  getUniswapV2PairTotalValue,
  getUniswapV2PairValue,
} from "../src/liquidity/LiquidityUniswapV2";
import {
  ERC20_BTRFLY_V1,
  ERC20_DAI,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  getWalletAddressesForContract,
  PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
} from "../src/utils/Constants";
import { PairHandler, PairHandlerTypes } from "../src/utils/PairHandler";
import { ERC20_STANDARD_DECIMALS } from "./erc20Helper";
import {
  ETH_USD_RESERVE_BLOCK,
  getBtrflyV1UsdRate,
  getOhmEthPairValue,
  getOhmUsdRate,
  getPairValue,
  mockBalancerVaultZero,
  mockEthUsdRate,
  mockOhmEthPair,
  mockUniswapV2Pair,
  mockUniswapV2PairsZero,
  mockUsdOhmV2Rate,
  mockWEthBtrflyV1Rate,
  OHM_ETH_TOTAL_SUPPLY,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

// Limits the search to the OHM-DAI pairs, otherwise other pairs will be iterated over
const pairArrayOverride: PairHandler[] = [
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI_V2),
];

const TIMESTAMP = BigInt.fromString("1");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();
  mockBalancerVaultZero();
  mockUniswapV2PairsZero();
});

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
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    // total token quantity * balance / total supply
    const expectedTokenBalance = token0ReservesDecimal
      .times(expectedBalanceV3)
      .div(totalSupplyDecimal);
    log.debug("expected OHM balance: {}", [expectedTokenBalance.toString()]);

    const records = getUniswapV2PairTokenQuantity(
      TIMESTAMP,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(expectedTokenBalance.toString(), records[0].balance.toString());

    assert.i32Equals(1, records.length);
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
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getUniswapV2PairTokenQuantity(
      TIMESTAMP,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.length);
  });

  test("balance of OHM V2 token in pool before starting block", () => {
    mockUsdOhmV2Rate();

    // Mock total value
    const token0Reserves = BigInt.fromString("1233838296976506");
    const token1Reserves = BigInt.fromString("15258719216508026301937394");
    const totalSupply = BigInt.fromString("0"); // total supply is 0 before deployment
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
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

    const records = getUniswapV2PairTokenQuantity(
      TIMESTAMP,
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to starting block
    assert.i32Equals(0, records.length);
  });
});

describe("records", () => {
  test("generates TokenRecord array for the given token", () => {
    const expectedBalanceV2 = BigDecimal.fromString("2");

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
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );

    // OHM-DAI V2
    mockUsdOhmV2Rate();
    mockZeroWalletBalances(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
    );
    mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V2, toBigInt(expectedBalanceV2));

    const records = getLiquidityBalances(
      TIMESTAMP,
      ERC20_DAI,
      OHM_USD_RESERVE_BLOCK,
      pairArrayOverride,
    );
    // We can call this because we are testing that the single-sided value is returned
    // Separate tests are there for the pair value verification
    const pairValue = getUniswapV2PairValue(
      toBigInt(expectedBalanceV2),
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance stays the same
    const recordOne = records[0];
    assert.stringEquals(expectedBalanceV2.toString(), recordOne.balance.toString());
    assert.stringEquals("0.5", recordOne.multiplier.toString());
    assert.stringEquals(pairValue.toString().slice(0, 18), recordOne.value.toString().slice(0, 18));
    assert.stringEquals(
      pairValue.times(BigDecimal.fromString("0.5")).toString().slice(0, 18),
      recordOne.valueExcludingOhm.toString().slice(0, 18),
    );

    assert.i32Equals(1, records.length);
  });

  // RFV is deprecated
  // test("returns risk-free value when riskFree is true", () => {
  //   const expectedBalanceV2 = BigDecimal.fromString("2");
  //   const expectedBalanceV3 = BigDecimal.fromString("3");

  //   // OHM-DAI V1
  //   mockUniswapV2Pair(
  //     ERC20_OHM_V1,
  //     ERC20_DAI,
  //     9,
  //     18,
  //     BigInt.fromString("382999881424"),
  //     BigInt.fromString("23566162832855719933607"),
  //     BigInt.fromString("76219775050984762"),
  //     PAIR_UNISWAP_V2_OHM_DAI,
  //     18,
  //   );
  //   mockZeroWalletBalances(
  //     PAIR_UNISWAP_V2_OHM_DAI,
  //     getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
  //   );

  //   // OHM-DAI V2
  //   mockUsdOhmV2Rate();
  //   mockZeroWalletBalances(
  //     PAIR_UNISWAP_V2_OHM_DAI_V2,
  //     getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
  //   );
  //   mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V2, toBigInt(expectedBalanceV2));
  //   mockWalletBalance(PAIR_UNISWAP_V2_OHM_DAI_V2, TREASURY_ADDRESS_V3, toBigInt(expectedBalanceV3));

  //   const records = getLiquidityBalances(
  //     TIMESTAMP,
  //     ERC20_DAI,
  //     true,
  //     false,
  //     false,
  //     OHM_USD_RESERVE_BLOCK,
  //     pairArrayOverride,
  //   );
  //   // We can call this because we are testing that the risk-free value is returned
  //   // Separate tests are there for the risk-free value verification
  //   const pairValue = getOhmUSDPairRiskFreeValue(
  //     toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
  //     PAIR_UNISWAP_V2_OHM_DAI_V2,
  //     OHM_USD_RESERVE_BLOCK,
  //   );

  //   // Balance stays the same
  //   const recordOne = records[0];
  //   assert.stringEquals(expectedBalanceV2.toString(), recordOne.balance.toString());
  //   const recordTwo = records[1];
  //   assert.stringEquals(expectedBalanceV3.toString(), recordTwo.balance.toString());
  //   // Value is the risk-free value
  //   assert.stringEquals(pairValue.toString(), recordOne.value.plus(recordTwo.value).toString());

  //   assert.i32Equals(2, records.length);
  // });
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

    const pairValue = getUniswapV2PairTotalValue(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      false,
      ETH_USD_RESERVE_BLOCK,
    );
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

  test("OHM-DAI pair value is correct, excluding OHM", () => {
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

    const pairValue = getUniswapV2PairTotalValue(
      PAIR_UNISWAP_V2_OHM_DAI_V2,
      true,
      ETH_USD_RESERVE_BLOCK,
    );

    // # DAI * 1
    const calculatedValue = toDecimal(token1Reserves, ERC20_STANDARD_DECIMALS);

    assert.stringEquals(calculatedValue.toString(), pairValue.toString());
  });

  test("OHM-ETH pair value is correct", () => {
    mockOhmEthPair();
    mockUsdOhmV2Rate();
    mockEthUsdRate();

    const pairValue = getUniswapV2PairTotalValue(
      PAIR_UNISWAP_V2_OHM_ETH_V2,
      false,
      ETH_USD_RESERVE_BLOCK,
    );
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

  test("OHM-BTRFLY V1 pair value is correct", () => {
    mockUsdOhmV2Rate();
    mockEthUsdRate();

    // UniswapV3 pair will be used for price lookup
    mockWEthBtrflyV1Rate();

    const token0Reserves = BigInt.fromString("463282541348");
    const token1Reserves = BigInt.fromString("198002629046");
    mockUniswapV2Pair(
      ERC20_OHM_V2,
      ERC20_BTRFLY_V1,
      OHM_V2_DECIMALS,
      9, // BTRFLY V1 is 9
      token0Reserves,
      token1Reserves,
      BigInt.fromString("240068018264"),
      PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
      ERC20_STANDARD_DECIMALS,
    );

    const pairValue = getUniswapV2PairTotalValue(
      PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
      false,
      ETH_USD_RESERVE_BLOCK,
    );

    const ohmRate = getOhmUsdRate();
    // 463.282541348 * 18.9652073 + 198.002629046 * 35.0430729991629573703709430194278 = 15,724.8700188208
    const calculatedValue = getPairValue(
      toDecimal(token0Reserves, OHM_V2_DECIMALS),
      toDecimal(token1Reserves, 9),
      ohmRate,
      getBtrflyV1UsdRate(),
    );

    assert.stringEquals(calculatedValue.toString(), pairValue.toString());
    assert.stringEquals("15724.8700", pairValue.toString().slice(0, 10));
  });
});
