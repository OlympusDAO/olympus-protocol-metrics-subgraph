import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test, log } from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { UNISWAP_V3_POSITION_MANAGER, getUniswapV3OhmSupply, getUniswapV3POLRecords, getUniswapV3PairTotalValue } from "../src/liquidity/LiquidityUniswapV3";
import { ERC20_OHM_V2, ERC20_WETH, PAIR_UNISWAP_V3_FXS_ETH, PAIR_UNISWAP_V3_WETH_OHM } from "../src/utils/Constants";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20Balance } from "./erc20Helper";
import {
  ETH_PRICE,
  ETH_USD_RESERVE_BLOCK,
  FXS_ETH_BALANCE_ETH,
  FXS_ETH_BALANCE_FXS,
  OHM_V2_DECIMALS,
  getEthUsdRate,
  getFxsUsdRate,
  getOhmUsdRate,
  mockBalancerVaultZero,
  mockCurvePairZero,
  mockEthUsdRate,
  mockFraxLockedBalanceZero,
  mockFraxSwapPairZero,
  mockFxsEthRate,
  mockUniswapV2EthUsdRate,
  mockUniswapV2PairsZero,
  mockUniswapV3PairsZero,
  mockUsdOhmV2Rate,
} from "./pairHelper";
import { TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { TokenCategoryPOL } from "../../shared/src/contracts/TokenDefinition";
import { TYPE_LIQUIDITY } from "../../shared/src/utils/TokenSupplyHelper";
import { mockUniswapV3PositionsZero, mockUniswapV3Pair, mockUniswapV3Positions, mockUniswapV3Position } from "./uniswapV3Helper";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";

describe("UniswapV3 pair value", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    // Do at the start, as it can be used by mock functions
    mockTreasuryAddressNull();
    mockClearinghouseRegistryAddressNull();

    mockBalancerVaultZero();
    mockFraxSwapPairZero();
    mockFraxLockedBalanceZero();
    mockCurvePairZero();
    mockUniswapV3PairsZero();

    mockEthUsdRate();
    mockStablecoinsPriceFeeds();

    // This needs to be last, or the OHM-USD price will be set. Something in the stack above mocks the value otherwise.
    mockUniswapV2PairsZero();
  });

  test("FXS-ETH pair value is correct", () => {
    mockFxsEthRate();
    mockEthUsdRate();
    mockUniswapV2EthUsdRate();

    const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_FXS_ETH, false, ETH_USD_RESERVE_BLOCK);
    // # ETH * p ETH + # FXS * p FXS
    const calculatedValue = toDecimal(FXS_ETH_BALANCE_FXS, ERC20_STANDARD_DECIMALS)
      .times(getFxsUsdRate())
      .plus(toDecimal(FXS_ETH_BALANCE_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
    log.debug("calculated value: {}", [calculatedValue.toString()]);
    log.debug("pairValue: {}", [pairValue.toString()]);

    assert.stringEquals(calculatedValue.truncate(4).toString(), pairValue.truncate(4).toString());
  });

  test("wETH-OHM pair value is correct", () => {
    mockEthUsdRate();

    // Mock OHM price = 13.3791479512
    mockUniswapV3Pair(PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("210385600452651183274688532908673"), BigInt.fromI32(157695));
    mockUniswapV3Positions(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, [BigInt.fromString("1")]);
    mockUniswapV3Position(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, BigInt.fromString("1"), ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("346355586036686019"), BigInt.fromI32(-887220), BigInt.fromI32(887220));

    const ethBalance = BigDecimal.fromString("919.574080927");
    const ohmBalance = BigDecimal.fromString("130454.081369749");

    // Mock balances in the pair (used for determining price)
    mockERC20Balance(ERC20_OHM_V2, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ohmBalance, OHM_V2_DECIMALS));
    mockERC20Balance(ERC20_WETH, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ethBalance, ERC20_STANDARD_DECIMALS));

    // Call function
    const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_WETH_OHM, false, ETH_USD_RESERVE_BLOCK);

    // # ETH * p ETH + # OHM * p OHM
    const calculatedValue = ethBalance
      .times(BigDecimal.fromString(ETH_PRICE))
      .plus(ohmBalance.times(BigDecimal.fromString("13.3835")));
    log.debug("calculated value: {}", [calculatedValue.toString()]);
    log.debug("pairValue: {}", [pairValue.toString()]);


    // Check that the actual value is += 200 of the expected value
    const supportedDifference = BigDecimal.fromString("50");
    log.debug("expected value: {}", [calculatedValue.toString()]);
    log.debug("actual value: {}", [pairValue.toString()]);
    assert.assertTrue(
      pairValue.minus(calculatedValue) < supportedDifference &&
      pairValue.minus(calculatedValue) > supportedDifference.times(BigDecimal.fromString("-1")));
  });

  test("wETH-OHM pair value excluding OHM is correct", () => {
    mockEthUsdRate();

    // Mock OHM price = 13.3791479512
    mockUniswapV3Pair(PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("210385600452651183274688532908673"), BigInt.fromI32(157695));
    mockUniswapV3Positions(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, [BigInt.fromString("1")]);
    mockUniswapV3Position(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, BigInt.fromString("1"), ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("346355586036686019"), BigInt.fromI32(-887220), BigInt.fromI32(887220));

    const ethBalance = BigDecimal.fromString("919.574080927");
    const ohmBalance = BigDecimal.fromString("130454.081369749");

    // Mock balances in the pair (used for determining price)
    mockERC20Balance(ERC20_OHM_V2, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ohmBalance, OHM_V2_DECIMALS));
    mockERC20Balance(ERC20_WETH, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ethBalance, ERC20_STANDARD_DECIMALS));

    // Call function
    const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_WETH_OHM, true, ETH_USD_RESERVE_BLOCK);
    // # ETH * p ETH
    const calculatedValue = ethBalance
      .times(BigDecimal.fromString(ETH_PRICE));
    log.debug("calculated value: {}", [calculatedValue.toString()]);
    log.debug("pairValue: {}", [pairValue.toString()]);

    assert.stringEquals(calculatedValue.truncate(4).toString(), pairValue.truncate(4).toString());
  });

  // test("pair balance value is correct", () => {
  //   mockOhmEthPair();
  //   mockUsdOhmRate();
  //   mockEthUsdRate();

  //   const lpBalance = BigInt.fromString("1000000000000000000");
  //   const balanceValue = getUniswapV2PairBalanceValue(
  //     lpBalance,
  //     PAIR_UNISWAP_V2_OHM_ETH_V2,
  //     ETH_USD_RESERVE_BLOCK,
  //   );

  //   // (balance / total supply) * pair value
  //   const calculatedValue = getOhmEthPairValue().times(
  //     toDecimal(lpBalance, 18).div(toDecimal(OHM_ETH_TOTAL_SUPPLY, 18)),
  //   );
  //   // There is a loss of precision, so we need to ensure that the value is close, but not equal
  //   assert.assertTrue(
  //     balanceValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
  //   );
  // });
});

describe("POL records", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    mockBalancerVaultZero();
    mockUniswapV2PairsZero();
    mockFraxSwapPairZero();
    mockFraxLockedBalanceZero();
    mockCurvePairZero();
    mockUniswapV3PairsZero();

    mockEthUsdRate();
    mockStablecoinsPriceFeeds();
  });

  test("generates TokenRecord array for wETH-OHM POL", () => {
    // Ignore other wallets
    mockUniswapV3PositionsZero(UNISWAP_V3_POSITION_MANAGER);

    // Mock OHM price
    mockUsdOhmV2Rate();

    // Mock ETH price
    mockEthUsdRate();

    // Mock POL balance
    mockUniswapV3Pair(PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("210385600452651183274688532908673"), BigInt.fromI32(157695));
    mockUniswapV3Positions(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, [BigInt.fromString("1")]);
    mockUniswapV3Position(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, BigInt.fromString("1"), ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("346355586036686019"), BigInt.fromI32(-887220), BigInt.fromI32(887220));

    // Call function
    const records = getUniswapV3POLRecords(BigInt.zero(), PAIR_UNISWAP_V3_WETH_OHM, null, BigInt.zero());

    // Check that the correct number of records were generated
    assert.i32Equals(1, records.length);

    // Values derived from: https://revert.finance/#/account/0x245cc372C84B3645Bf0Ffe6538620B04a217988B
    const expectedEthBalance = BigDecimal.fromString("919.726340");
    const expectedEthValue = expectedEthBalance.times(BigDecimal.fromString(ETH_PRICE));
    const expectedOhmBalance = BigDecimal.fromString("130432.485");
    const expectedOhmValue = expectedOhmBalance.times(getOhmUsdRate());
    const expectedValue = expectedOhmValue.plus(expectedEthValue);
    const expectedMultiplier = expectedEthValue.div(expectedValue);

    // Check that the correct values were generated
    assert.stringEquals("1", records[0].balance.toString());
    assert.stringEquals(PAIR_UNISWAP_V3_WETH_OHM, records[0].tokenAddress);
    assert.stringEquals(TokenCategoryPOL, records[0].category);

    // Check that the actual value is += 200 of the expected value
    const supportedDifference = BigDecimal.fromString("200");
    log.debug("expected value: {}", [expectedValue.toString()]);
    log.debug("actual value: {}", [records[0].value.toString()]);
    assert.assertTrue(
      records[0].value.minus(expectedValue) < supportedDifference &&
      records[0].value.minus(expectedValue) > supportedDifference.times(BigDecimal.fromString("-1")));

    // Check that the actual multiplier is += 0.0001 of the expected multiplier
    const supportedMultiplierDifference = BigDecimal.fromString("0.0001");
    log.debug("expected multiplier: {}", [expectedMultiplier.toString()]);
    log.debug("actual multiplier: {}", [records[0].multiplier.toString()]);
    assert.assertTrue(
      records[0].multiplier.minus(expectedMultiplier) < supportedMultiplierDifference &&
      records[0].multiplier.minus(expectedMultiplier) > supportedMultiplierDifference.times(BigDecimal.fromString("-1")));
  });
});

describe("OHM supply records", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    mockBalancerVaultZero();
    mockUniswapV2PairsZero();
    mockFraxSwapPairZero();
    mockFraxLockedBalanceZero();
    mockCurvePairZero();
    mockUniswapV3PairsZero();

    mockEthUsdRate();
    mockStablecoinsPriceFeeds();
  });

  test("generates TokenSupply array for wETH-OHM POL", () => {
    // Ignore other wallets
    mockUniswapV3PositionsZero(UNISWAP_V3_POSITION_MANAGER);

    // Mock OHM price
    mockUsdOhmV2Rate();

    // Mock ETH price
    mockEthUsdRate();

    // Mock POL balance
    mockUniswapV3Pair(PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("210385600452651183274688532908673"), BigInt.fromI32(157695));
    mockUniswapV3Positions(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, [BigInt.fromString("1")]);
    mockUniswapV3Position(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, BigInt.fromString("1"), ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("346355586036686019"), BigInt.fromI32(-887220), BigInt.fromI32(887220));

    // Call function
    const records = getUniswapV3OhmSupply(BigInt.zero(), PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, BigInt.zero());

    // Check that the correct number of records were generated
    assert.i32Equals(1, records.length);

    assert.stringEquals(ERC20_OHM_V2.toLowerCase(), records[0].tokenAddress.toLowerCase());
    assert.stringEquals(TYPE_LIQUIDITY, records[0].type);
    assert.stringEquals(PAIR_UNISWAP_V3_WETH_OHM.toLowerCase(), records[0].poolAddress!.toLowerCase());
    assert.stringEquals(ERC20_OHM_V2.toLowerCase(), records[0].tokenAddress.toLowerCase());
    assert.stringEquals(TREASURY_ADDRESS_V3.toLowerCase(), records[0].sourceAddress!.toLowerCase());

    // Values derived from: https://revert.finance/#/account/0x245cc372C84B3645Bf0Ffe6538620B04a217988B
    const expectedOhmBalance = BigDecimal.fromString("-130432.485");

    const supportedDifference = BigDecimal.fromString("30");
    log.debug("expected value: {}", [expectedOhmBalance.toString()]);
    log.debug("actual value: {}", [records[0].supplyBalance.toString()]);
    assert.assertTrue(
      records[0].supplyBalance.minus(expectedOhmBalance) < supportedDifference &&
      records[0].supplyBalance.minus(expectedOhmBalance) > supportedDifference.times(BigDecimal.fromString("-1")));
  });
});
