import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_OHM,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { getLiquidityBalances } from "../src/utils/LiquidityCalculations";
import { getOhmUSDPairRiskFreeValue, getUniswapV2PairValue } from "../src/utils/Price";
import { mockUniswapV2Pair, mockUsdOhmV2Rate, OHM_USD_RESERVE_BLOCK } from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

describe("liquidity balances", () => {
  describe("UniswapV2", () => {
    test("generates TokenRecords for the given token", () => {
      const expectedBalanceV2 = BigDecimal.fromString("2");
      const expectedBalanceV3 = BigDecimal.fromString("3");

      // OHM-DAI V1
      mockUniswapV2Pair(
        ERC20_OHM,
        ERC20_DAI,
        9,
        18,
        BigInt.fromString("382999881424"),
        BigInt.fromString("23566162832855719933607"),
        BigInt.fromString("76219775050984762"),
        PAIR_UNISWAP_V2_OHM_DAI,
        18,
      );
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

      // OHM-DAI V2
      mockUsdOhmV2Rate();
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V2,
        toBigInt(expectedBalanceV2),
      );
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V3,
        toBigInt(expectedBalanceV3),
      );

      const records = getLiquidityBalances(ERC20_DAI, false, false, OHM_USD_RESERVE_BLOCK);
      // We can call this because we are testing that the single-sided value is returned
      // Separate tests are there for the pair value verification
      const pairValue = getUniswapV2PairValue(
        toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        OHM_USD_RESERVE_BLOCK,
      );

      // Balance stays the same
      assert.stringEquals(
        expectedBalanceV2.plus(expectedBalanceV3).toString(),
        records.getBalance().toString(),
      );
      // Value multiplied by 0.5 due to being single-sided
      assert.stringEquals(pairValue.toString(), records.getValue().toString());
    });

    test("applies a multiplier when singleSidedValue is true", () => {
      const expectedBalanceV2 = BigDecimal.fromString("2");
      const expectedBalanceV3 = BigDecimal.fromString("3");

      // OHM-DAI V1
      mockUniswapV2Pair(
        ERC20_OHM,
        ERC20_DAI,
        9,
        18,
        BigInt.fromString("382999881424"),
        BigInt.fromString("23566162832855719933607"),
        BigInt.fromString("76219775050984762"),
        PAIR_UNISWAP_V2_OHM_DAI,
        18,
      );
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

      // OHM-DAI V2
      mockUsdOhmV2Rate();
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V2,
        toBigInt(expectedBalanceV2),
      );
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V3,
        toBigInt(expectedBalanceV3),
      );

      const records = getLiquidityBalances(ERC20_DAI, false, true, OHM_USD_RESERVE_BLOCK);
      // We can call this because we are testing that the single-sided value is returned
      // Separate tests are there for the pair value verification
      const pairValue = getUniswapV2PairValue(
        toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        OHM_USD_RESERVE_BLOCK,
      );

      // Balance stays the same
      assert.stringEquals(
        expectedBalanceV2.plus(expectedBalanceV3).toString(),
        records.getBalance().toString(),
      );
      // Value multiplied by 0.5 due to being single-sided
      assert.stringEquals(
        pairValue.times(BigDecimal.fromString("0.5")).toString(),
        records.getValue().toString(),
      );
    });

    test("returns risk-free value when riskFree is true", () => {
      const expectedBalanceV2 = BigDecimal.fromString("2");
      const expectedBalanceV3 = BigDecimal.fromString("3");

      // OHM-DAI V1
      mockUniswapV2Pair(
        ERC20_OHM,
        ERC20_DAI,
        9,
        18,
        BigInt.fromString("382999881424"),
        BigInt.fromString("23566162832855719933607"),
        BigInt.fromString("76219775050984762"),
        PAIR_UNISWAP_V2_OHM_DAI,
        18,
      );
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI, WALLET_ADDRESSES);

      // OHM-DAI V2
      mockUsdOhmV2Rate();
      mockZeroWalletBalances(PAIR_UNISWAP_V2_OHM_DAI_V2, WALLET_ADDRESSES);
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V2,
        toBigInt(expectedBalanceV2),
      );
      mockWalletBalance(
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        TREASURY_ADDRESS_V3,
        toBigInt(expectedBalanceV3),
      );

      const records = getLiquidityBalances(ERC20_DAI, true, false, OHM_USD_RESERVE_BLOCK);
      // We can call this because we are testing that the risk-free value is returned
      // Separate tests are there for the risk-free value verification
      const pairValue = getOhmUSDPairRiskFreeValue(
        toBigInt(expectedBalanceV2.plus(expectedBalanceV3)),
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        OHM_USD_RESERVE_BLOCK,
      );

      // Balance stays the same
      assert.stringEquals(
        expectedBalanceV2.plus(expectedBalanceV3).toString(),
        records.getBalance().toString(),
      );
      // Value is the risk-free value
      assert.stringEquals(pairValue.toString(), records.getValue().toString());
    });
  });
});
