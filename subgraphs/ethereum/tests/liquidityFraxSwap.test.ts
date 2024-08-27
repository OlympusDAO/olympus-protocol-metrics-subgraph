import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test, log } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { getLiquidityBalances } from "../src/liquidity/LiquidityCalculations";
import {
  getFraxSwapPairRecords,
  getFraxSwapPairTokenQuantity,
  getFraxSwapPairTokenQuantityRecords,
  getFraxSwapPairTotalValue,
} from "../src/liquidity/LiquidityFraxSwap";
import {
  ERC20_FRAX,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_USDC,
  PAIR_FRAXSWAP_V1_OHM_FRAX,
} from "../src/utils/Constants";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS } from "./erc20Helper";
import {
  FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES,
  FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES,
  FRAXSWAP_OHM_FRAX_TOTAL_SUPPLY,
  FRAXSWAP_OHM_FRAX_TOTAL_VALUE,
  FRAXSWAP_OHM_FRAX_UNIT_RATE,
  mockBalancerVaultZero,
  mockCurvePairZero,
  mockEthUsdRate,
  mockFraxLockedBalanceZero,
  mockFraxSwapPairOhmFrax,
  mockFraxSwapPairZero,
  mockUniswapV2PairsZero,
  mockUniswapV3PairsZero,
  mockUsdOhmV2Rate,
  mockWEthBtrflyV1Rate,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";

const TIMESTAMP = BigInt.fromString("1");
const BLOCK_NUMBER: BigInt = BigInt.fromString("14000000");


beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();
  mockClearinghouseRegistryAddressNull();

  mockBalancerVaultZero();
  mockUniswapV2PairsZero();
  mockFraxSwapPairZero();
  mockFraxLockedBalanceZero();
  mockCurvePairZero();
  mockUniswapV3PairsZero();

  mockEthUsdRate();
  mockStablecoinsPriceFeeds();
});

describe("pool total value", () => {
  test("OHM-FRAX pool total value, all tokens", () => {
    mockFraxSwapPairOhmFrax();

    const totalValue = getFraxSwapPairTotalValue(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      false,
      BLOCK_NUMBER,
    );

    assert.stringEquals(FRAXSWAP_OHM_FRAX_TOTAL_VALUE.toString(), totalValue.toString());
  });

  test("OHM-FRAX pool total value, excluding OHM", () => {
    mockFraxSwapPairOhmFrax();
    mockUsdOhmV2Rate();

    const totalValue = getFraxSwapPairTotalValue(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      true,
      BLOCK_NUMBER,
    );

    // # FRAX * rate
    const expectedValue = FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES;
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });
});

describe("token quantity", () => {
  test("total quantity of OHM token in pool", () => {
    mockFraxSwapPairOhmFrax();

    const ohm = getFraxSwapPairTokenQuantity(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
    );

    assert.stringEquals(ohm.toString(), FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES.toString());
  });

  test("balance of OHM V2 token in OHM V2 pool", () => {
    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance = FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES.times(expectedWalletBalance).div(
      FRAXSWAP_OHM_FRAX_TOTAL_SUPPLY,
    );

    const records = getFraxSwapPairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
    );

    assert.stringEquals(records[0].balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(
      records[0].supplyBalance.toString(),
      expectedTokenBalance.times(BigDecimal.fromString("-1")).toString(),
    ); // Being taken out of circulation
    assert.i32Equals(1, records.length);
  });

  test("balance of OHM V1 token in OHM V2 pool", () => {
    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      ERC20_OHM_V1,
      BLOCK_NUMBER,
    );

    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.length);
  });

  test("balance of OHM V2 token in OHM V2 pool before starting block", () => {
    // 0 total supply
    mockFraxSwapPairOhmFrax(BigDecimal.fromString("0"));

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairTokenQuantityRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      ERC20_OHM_V2,
      BLOCK_NUMBER,
    );

    // Should be empty records due to starting block
    assert.i32Equals(0, records.length);
  });
});

describe("get token records", () => {
  test("OHM-FRAX pool balance, all tokens", () => {
    mockUsdOhmV2Rate();
    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      BLOCK_NUMBER,
      null,
    );

    const expectedNonOhmTotalValue = FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES.times(
      BigDecimal.fromString("1"),
    );
    const expectedMultiplier = expectedNonOhmTotalValue.div(FRAXSWAP_OHM_FRAX_TOTAL_VALUE);
    const expectedValue = expectedWalletBalance.times(FRAXSWAP_OHM_FRAX_UNIT_RATE);
    const expectedValueNonOhm = expectedValue.times(expectedMultiplier);

    assert.stringEquals(expectedValue.toString(), records[0].value.toString());
    assert.stringEquals(expectedValueNonOhm.toString(), records[0].valueExcludingOhm.toString());
    assert.stringEquals(expectedMultiplier.toString(), records[0].multiplier.toString());
    assert.i32Equals(1, records.length);
  });

  test("getLiquidityBalances", () => {
    // Needed for BTRFLY
    mockWEthBtrflyV1Rate();

    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getLiquidityBalances(TIMESTAMP, null, BLOCK_NUMBER);

    const expectedValue = expectedWalletBalance.times(FRAXSWAP_OHM_FRAX_UNIT_RATE);
    assert.stringEquals(expectedValue.toString(), records[0].value.toString());
    assert.i32Equals(1, records.length);
  });

  test("OHM-FRAX pool balance before starting block", () => {
    // total supply 0 before starting block
    mockFraxSwapPairOhmFrax(BigDecimal.fromString("0"));

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      BLOCK_NUMBER,
      null,
    );

    assert.i32Equals(0, records.length);
  });

  test("OHM-FRAX pool with matching tokenAddress", () => {
    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      BLOCK_NUMBER,
      ERC20_FRAX,
    );

    const expectedValue = expectedWalletBalance.times(FRAXSWAP_OHM_FRAX_UNIT_RATE);
    assert.stringEquals(expectedValue.toString(), records[0].value.toString());
    assert.i32Equals(1, records.length);
  });

  test("OHM-FRAX pool with different tokenAddress", () => {
    mockFraxSwapPairOhmFrax();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      getWalletAddressesForContract(PAIR_FRAXSWAP_V1_OHM_FRAX, BLOCK_NUMBER),
    );
    mockWalletBalance(
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getFraxSwapPairRecords(
      TIMESTAMP,
      PAIR_FRAXSWAP_V1_OHM_FRAX,
      BLOCK_NUMBER,
      ERC20_USDC,
    );

    assert.i32Equals(0, records.length);
  });
});
