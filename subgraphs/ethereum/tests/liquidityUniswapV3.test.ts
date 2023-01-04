import { log } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";

import { toDecimal } from "../../../common/src/utils/Decimals";
import { getUniswapV3PairTotalValue } from "../src/liquidity/LiquidityUniswapV3";
import { PAIR_UNISWAP_V3_FXS_ETH } from "../src/utils/Constants";
import {
  ERC20_STANDARD_DECIMALS,
  ETH_USD_RESERVE_BLOCK,
  FXS_ETH_BALANCE_ETH,
  FXS_ETH_BALANCE_FXS,
  getEthUsdRate,
  getFxsUsdRate,
  mockEthUsdRate,
  mockFxsEthRate,
} from "./pairHelper";

describe("UniswapV3 pair value", () => {
  test("FXS-ETH pair value is correct", () => {
    mockFxsEthRate();
    mockEthUsdRate();

    const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_FXS_ETH, ETH_USD_RESERVE_BLOCK);
    // # ETH * p ETH + # FXS * p FXS
    const calculatedValue = toDecimal(FXS_ETH_BALANCE_FXS, ERC20_STANDARD_DECIMALS)
      .times(getFxsUsdRate())
      .plus(toDecimal(FXS_ETH_BALANCE_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
    log.debug("calculated value: {}", [calculatedValue.toString()]);
    log.debug("pairValue: {}", [pairValue.toString()]);

    assert.stringEquals(calculatedValue.toString().slice(0, 18), pairValue.toString().slice(0, 18));
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
