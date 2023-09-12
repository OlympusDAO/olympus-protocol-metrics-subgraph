import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { toDecimal } from "../../shared/src/utils/Decimals";
import { UNISWAP_V3_POSITION_MANAGER, getUniswapV3OhmSupply, getUniswapV3POLRecords, getUniswapV3PairTotalValue } from "../src/liquidity/LiquidityUniswapV3";
import { ERC20_OHM_V2, ERC20_WETH, PAIR_UNISWAP_V3_FXS_ETH, PAIR_UNISWAP_V3_WETH_OHM, getWalletAddressesForContract } from "../src/utils/Constants";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS } from "./erc20Helper";
import {
  ETH_PRICE,
  ETH_USD_RESERVE_BLOCK,
  FXS_ETH_BALANCE_ETH,
  FXS_ETH_BALANCE_FXS,
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

describe("UniswapV3 pair value", () => {
  test("FXS-ETH pair value is correct", () => {
    mockFxsEthRate();
    mockEthUsdRate();
    mockUniswapV2EthUsdRate();

    const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_FXS_ETH, ETH_USD_RESERVE_BLOCK);
    // # ETH * p ETH + # FXS * p FXS
    const calculatedValue = toDecimal(FXS_ETH_BALANCE_FXS, ERC20_STANDARD_DECIMALS)
      .times(getFxsUsdRate())
      .plus(toDecimal(FXS_ETH_BALANCE_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
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

function mockUniswapV3Positions(
  positionManager: string,
  walletAddress: string,
  positions: BigInt[],
): void {
  // Mock the position count
  createMockedFunction(
    Address.fromString(positionManager),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(positions.length))]);

  // Mock the position
  for (let i = 0; i < positions.length; i++) {
    createMockedFunction(
      Address.fromString(positionManager),
      "tokenOfOwnerByIndex",
      "tokenOfOwnerByIndex(address,uint256):(uint256)",
    ).withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress)), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(i))]).
      returns([ethereum.Value.fromUnsignedBigInt(positions[i])]);
  }
}

function mockUniswapV3PositionsZero(
  positionManager: string,
): void {
  // Get all wallets
  const wallets = getWalletAddressesForContract(positionManager);

  for (let i = 0; i < wallets.length; i++) {
    mockUniswapV3Positions(positionManager, wallets[i], []);
  }
}

function mockUniswapV3Pair(
  pairAddress: string,
  token0: string,
  token1: string,
  sqrtPriceX96: BigInt,
  tick: BigInt,
): void {
  // Mock the pair
  createMockedFunction(
    Address.fromString(pairAddress),
    "slot0",
    "slot0():(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(sqrtPriceX96),
    ethereum.Value.fromSignedBigInt(tick),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ethereum.Value.fromBoolean(false),
  ]);

  // Mock the token0
  createMockedFunction(
    Address.fromString(pairAddress),
    "token0",
    "token0():(address)",
  ).returns([ethereum.Value.fromAddress(Address.fromString(token0))]);

  // Mock the token1
  createMockedFunction(
    Address.fromString(pairAddress),
    "token1",
    "token1():(address)",
  ).returns([ethereum.Value.fromAddress(Address.fromString(token1))]);
}

const MIN_TICK = -887272;
const MAX_TICK = 887272;

function mockUniswapV3Position(
  positionManager: string,
  walletAddress: string,
  position: BigInt,
  token0: string,
  token1: string,
  liquidity: BigInt,
  tickLower: BigInt,
  tickUpper: BigInt,
): void {
  // Mock the position
  createMockedFunction(
    Address.fromString(positionManager),
    "positions",
    "positions(uint256):(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  ).withArgs([ethereum.Value.fromUnsignedBigInt(position)]).
    returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // Nonce
      ethereum.Value.fromAddress(Address.zero()), // Operator
      ethereum.Value.fromAddress(Address.fromString(token0)), // Token0
      ethereum.Value.fromAddress(Address.fromString(token1)), // Token1
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // Fee
      ethereum.Value.fromSignedBigInt(tickLower), // TickLower
      ethereum.Value.fromSignedBigInt(tickUpper), // TickUpper
      ethereum.Value.fromUnsignedBigInt(liquidity), // Liquidity
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // FeeGrowthInside0LastX128
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // FeeGrowthInside1LastX128
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // TokensOwed0
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()), // TokensOwed1
    ]);
};

describe("POL records", () => {
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
