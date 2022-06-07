import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_FXS,
  ERC20_OHM,
  ERC20_OHM_V2,
  ERC20_TRIBE,
  ERC20_WETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  PAIR_UNISWAP_V2_USDC_ETH,
  PAIR_UNISWAP_V3_FXS_ETH,
} from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";
import {
  getBaseEthUsdRate,
  getBaseOhmUsdRate,
  getBaseTokenOrientation,
  getBaseTokenUSDRate,
  getOhmUSDPairRiskFreeValue,
  getUniswapV2PairTotalValue,
  getUniswapV2PairValue,
  getUniswapV3PairTotalValue,
  getUSDRate,
  PairTokenBaseOrientation,
} from "../src/utils/Price";
import {
  ERC20_STANDARD_DECIMALS,
  ETH_USD_RESERVE_BLOCK,
  FXS_ETH_BALANCE_ETH,
  FXS_ETH_BALANCE_FXS,
  getEthUsdRate,
  getFxsUsdRate,
  getOhmEthPairValue,
  getOhmUsdRate,
  getTribeUsdRate,
  mockEthUsdRate,
  mockFxsEthRate,
  mockOhmEthPair,
  mockTribeEthRate,
  mockUsdOhmV2Rate,
  OHM_ETH_TOTAL_SUPPLY,
  OHM_USD_RESERVE_BLOCK,
  OHM_USD_RESERVE_OHM,
  OHM_USD_RESERVE_USD,
  OHM_USD_TOTAL_SUPPLY,
  OHM_V2_DECIMALS,
} from "./pairHelper";

describe("ETH-USD rate", () => {
  test("rate calculation is correct", () => {
    mockEthUsdRate();

    assert.stringEquals(getBaseEthUsdRate().toString(), getEthUsdRate().toString());
  });

  test(
    "should throw an error when the pair cannot be accessed",
    () => {
      // UniswapV2Pair will return null if the pair doesn't exist at the current block
      const contractAddress = Address.fromString(PAIR_UNISWAP_V2_USDC_ETH);
      createMockedFunction(
        contractAddress,
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).returns([]);

      getBaseEthUsdRate();
    },
    true,
  );
});

describe("OHM-USD rate", () => {
  test("rate calculation is correct", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test(
    "should throw an error when the pair cannot be accessed",
    () => {
      // UniswapV2Pair will return null if the pair doesn't exist at the current block
      const contractAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2);
      createMockedFunction(
        contractAddress,
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).returns([]);

      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      );
    },
    true,
  );
});

describe("base token", () => {
  test("token0 == OHM V1", () => {
    const ohmV1Address = Address.fromString(ERC20_OHM);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(ohmV1Address, daiAddress) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token0 == OHM V2", () => {
    const ohmV2Address = Address.fromString(ERC20_OHM_V2);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(ohmV2Address, daiAddress) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token0 == ETH", () => {
    const wethAddress = Address.fromString(ERC20_WETH);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(wethAddress, daiAddress) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token1 == OHM V1", () => {
    const ohmV1Address = Address.fromString(ERC20_OHM);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(daiAddress, ohmV1Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == OHM V2", () => {
    const ohmV2Address = Address.fromString(ERC20_OHM_V2);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(daiAddress, ohmV2Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == ETH", () => {
    const wethAddress = Address.fromString(ERC20_WETH);
    const daiAddress = Address.fromString(ERC20_DAI);

    assert.assertTrue(
      getBaseTokenOrientation(daiAddress, wethAddress) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token0-token1 non-base pair", () => {
    const daiAddress = Address.fromString(ERC20_DAI);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(tribeAddress, daiAddress) === PairTokenBaseOrientation.UNKNOWN,
    );
  });

  test("token1-token0 non-base pair", () => {
    const daiAddress = Address.fromString(ERC20_DAI);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(daiAddress, tribeAddress) === PairTokenBaseOrientation.UNKNOWN,
    );
  });
});

describe("base token USD rate", () => {
  test("token0 == OHM V1, token1 == TRIBE", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_OHM),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("token0 == OHM V2, token1 == TRIBE", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_OHM_V2),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("token0 == ETH, token1 == TRIBE", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_WETH),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getEthUsdRate().toString(),
    );
  });

  test("token0 == TRIBE, token0 == OHM V1", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_TRIBE),
        Address.fromString(ERC20_OHM),
        PairTokenBaseOrientation.TOKEN1,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("token0 == TRIBE, token1 == OHM V2", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_TRIBE),
        Address.fromString(ERC20_OHM_V2),
        PairTokenBaseOrientation.TOKEN1,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("token0 == TRIBE, token1 == ETH", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_TRIBE),
        Address.fromString(ERC20_WETH),
        PairTokenBaseOrientation.TOKEN1,
        OHM_USD_RESERVE_BLOCK,
      ).toString(),
      getEthUsdRate().toString(),
    );
  });
});

describe("get USD rate", () => {
  test("stablecoin returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_DAI, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("ETH returns correct value", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getUSDRate(ERC20_WETH, OHM_USD_RESERVE_BLOCK).toString(),
      getEthUsdRate().toString(),
    );
  });

  test("OHM V1 returns correct value", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM, OHM_USD_RESERVE_BLOCK).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("OHM V2 returns correct value", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V2, OHM_USD_RESERVE_BLOCK).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("TRIBE (UniswapV2) returns correct value", () => {
    mockEthUsdRate();
    mockTribeEthRate();

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, OHM_USD_RESERVE_BLOCK);
    const calculatedRate = getTribeUsdRate();
    log.debug("difference: {}", [tribeUsdRate.minus(calculatedRate).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      tribeUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });

  test("FXS (UniswapV3) returns correct value", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    const fxsUsdRate = getUSDRate(ERC20_FXS, OHM_USD_RESERVE_BLOCK);
    const calculatedRate = getFxsUsdRate();
    log.debug("difference: {}", [fxsUsdRate.minus(calculatedRate).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      fxsUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });
});

describe("UniswapV2 pair value", () => {
  describe("OHM-ETH", () => {
    test("pair value is correct", () => {
      mockOhmEthPair();
      mockUsdOhmV2Rate();
      mockEthUsdRate();

      const pairValue = getUniswapV2PairTotalValue(
        PAIR_UNISWAP_V2_OHM_ETH_V2,
        ETH_USD_RESERVE_BLOCK,
      );
      const calculatedValue = getOhmEthPairValue();
      log.debug("difference: {}", [pairValue.minus(calculatedValue).toString()]);

      // There is a loss of precision, so we need to ensure that the value is close, but not equal
      assert.assertTrue(
        pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
      );
    });

    test("pair balance value is correct", () => {
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
  });
});

describe("UniswapV2 risk-free pair value", () => {
  describe("OHM-DAI", () => {
    test("risk-free pair value is correct", () => {
      mockUsdOhmV2Rate();

      const lpBalance = BigInt.fromString("1000000000000000000");
      const pairValue = getOhmUSDPairRiskFreeValue(
        lpBalance,
        PAIR_UNISWAP_V2_OHM_DAI_V2,
        OHM_USD_RESERVE_BLOCK,
      );
      // (# LP tokens / LP total supply) * (2) * sqrt(# DAI * # OHM)
      const calculatedValue = toDecimal(lpBalance, 18)
        .div(toDecimal(OHM_USD_TOTAL_SUPPLY, 18))
        .times(BigDecimal.fromString("2"))
        .times(
          toDecimal(
            toDecimal(OHM_USD_RESERVE_USD, ERC20_STANDARD_DECIMALS)
              .times(toDecimal(OHM_USD_RESERVE_OHM, OHM_V2_DECIMALS))
              .truncate(0)
              .digits.sqrt(),
            0,
          ),
        );
      log.debug("calculated risk-free value: {}", [calculatedValue.toString()]);
      log.debug("difference: {}", [pairValue.minus(calculatedValue).toString()]);

      // There is a loss of precision, so we need to ensure that the value is close, but not equal
      assert.assertTrue(
        pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
      );
    });
  });
});

describe("UniswapV3 pair value", () => {
  describe("FXS-ETH", () => {
    test("pair value is correct", () => {
      mockFxsEthRate();
      mockEthUsdRate();

      const pairValue = getUniswapV3PairTotalValue(PAIR_UNISWAP_V3_FXS_ETH, ETH_USD_RESERVE_BLOCK);
      // # ETH * p ETH + # FXS * p FXS
      const calculatedValue = toDecimal(FXS_ETH_BALANCE_FXS, ERC20_STANDARD_DECIMALS)
        .times(getFxsUsdRate())
        .plus(toDecimal(FXS_ETH_BALANCE_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
      log.debug("calculated value: {}", [calculatedValue.toString()]);
      log.debug("difference: {}", [pairValue.minus(calculatedValue).toString()]);

      // There is a loss of precision, so we need to ensure that the value is close, but not equal
      assert.assertTrue(
        pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")),
      );
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
});

// TODO uniswap v3 pair value
// TODO risk-free value
