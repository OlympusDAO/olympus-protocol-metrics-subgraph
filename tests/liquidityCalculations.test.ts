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
import { toBigInt, toDecimal } from "../src/utils/Decimals";
import { getLiquidityBalances } from "../src/utils/LiquidityCalculations";
import {
  getOhmUsdV2PairTotalValue,
  mockUniswapV2Pair,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_USD_TOTAL_SUPPLY,
} from "./pairHelper";
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
      const pairTotalValue = getOhmUsdV2PairTotalValue();

      assert.stringEquals(
        expectedBalanceV2.plus(expectedBalanceV3).toString(),
        records.getBalance().toString(),
      );
      assert.stringEquals(
        expectedBalanceV2
          .plus(expectedBalanceV3)
          .div(toDecimal(OHM_USD_TOTAL_SUPPLY))
          .times(pairTotalValue)
          .toString(),
        records.getValue().toString(),
      );
    });

    test(
      "applies a multiplier when singleSidedValue is true",
      () => {
        // TODO
      },
      true,
    );

    test(
      "returns risk-free value when riskFree is true",
      () => {
        // TODO
      },
      true,
    );
  });
});
