import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_FRAX,
  ERC20_FXS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_SYN,
  ERC20_TRIBE,
  ERC20_WETH,
  NATIVE_ETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  PAIR_UNISWAP_V2_SYN_FRAX,
  PAIR_UNISWAP_V2_USDC_ETH,
  PAIR_UNISWAP_V3_FXS_ETH,
} from "../src/utils/Constants";
import { DEFAULT_DECIMALS, toDecimal } from "../src/utils/Decimals";
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
  getERC20UsdRate,
  getEthUsdRate,
  getFxsUsdRate,
  getOhmEthPairValue,
  getOhmUsdRate,
  getTribeUsdRate,
  mockEthUsdRate,
  mockFxsEthRate,
  mockOhmEthPair,
  mockTribeEthRate,
  mockUniswapV2Pair,
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
    const ohmV1Address = Address.fromString(ERC20_OHM_V1);
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
    const ohmV1Address = Address.fromString(ERC20_OHM_V1);
    const fxsAddress = Address.fromString(ERC20_FXS);

    assert.assertTrue(
      getBaseTokenOrientation(fxsAddress, ohmV1Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == OHM V2", () => {
    const ohmV2Address = Address.fromString(ERC20_OHM_V2);
    const fxsAddress = Address.fromString(ERC20_FXS);

    assert.assertTrue(
      getBaseTokenOrientation(fxsAddress, ohmV2Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == ETH", () => {
    const wethAddress = Address.fromString(ERC20_WETH);
    const fxsAddress = Address.fromString(ERC20_FXS);

    // Matches DAI for token0
    assert.assertTrue(
      getBaseTokenOrientation(fxsAddress, wethAddress) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token0-token1 non-base pair", () => {
    const fxsAddress = Address.fromString(ERC20_FXS);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(tribeAddress, fxsAddress) === PairTokenBaseOrientation.UNKNOWN,
    );
  });

  test("token1-token0 non-base pair", () => {
    const fxsAddress = Address.fromString(ERC20_FXS);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(fxsAddress, tribeAddress) === PairTokenBaseOrientation.UNKNOWN,
    );
  });
});

describe("base token USD rate", () => {
  test("token0 == OHM V1, token1 == TRIBE", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_OHM_V1),
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
        Address.fromString(ERC20_OHM_V1),
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
      getUSDRate(NATIVE_ETH, OHM_USD_RESERVE_BLOCK).toString(),
      getEthUsdRate().toString(),
    );
  });

  test("wETH returns correct value", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getUSDRate(ERC20_WETH, OHM_USD_RESERVE_BLOCK).toString(),
      getEthUsdRate().toString(),
    );
  });

  test("OHM V1 returns correct value", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V1, OHM_USD_RESERVE_BLOCK).toString(),
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

  test("SYN (UniswapV2 with FRAX pair) returns correct value", () => {
    const synReserve = BigInt.fromString("9206045749798035188572518");
    const fraxReserve = BigInt.fromString("9400621025789582788346605");
    mockUniswapV2Pair(
      ERC20_SYN,
      ERC20_FRAX,
      DEFAULT_DECIMALS,
      DEFAULT_DECIMALS,
      synReserve,
      fraxReserve,
      BigInt.fromString("9117929467985260492733795"),
      PAIR_UNISWAP_V2_SYN_FRAX,
      18,
    );

    const synUsdRate = getUSDRate(ERC20_SYN, OHM_USD_RESERVE_BLOCK);
    log.debug("SYN USD rate {}", [synUsdRate.toString()]);
    const calculatedRate = getERC20UsdRate(fraxReserve, synReserve, BigDecimal.fromString("1"));
    log.debug("difference: {}", [synUsdRate.minus(calculatedRate).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      synUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")) &&
        synUsdRate.minus(calculatedRate).gt(BigDecimal.fromString("-0.000000000000000001")),
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

  test(
    "ERC20 without liquidity pool mapping returns error",
    () => {
      // BOTTO
      getUSDRate("0x9dfad1b7102d46b1b197b90095b5c4e9f5845bba", OHM_USD_RESERVE_BLOCK);
    },
    true,
  );

  test("FXS (UniswapV3) returns correct value for FXS", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    const fxsUsdRate = getUSDRate(ERC20_FXS, OHM_USD_RESERVE_BLOCK);
    const calculatedRate = BigDecimal.fromString("5.877414538282582611"); // 5.87741453828258261098431099338906

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      fxsUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")) &&
        fxsUsdRate.minus(calculatedRate).gt(BigDecimal.fromString("-0.000000000000000001")),
    );
  });

  test("FXS (UniswapV3) returns correct value for ETH", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    const ethUsdRate = getUSDRate(ERC20_WETH, OHM_USD_RESERVE_BLOCK);
    const calculatedRate = BigDecimal.fromString("1898.013973745253121667");
    log.debug("difference: {}", [ethUsdRate.minus(calculatedRate).toString()]);

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      ethUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")) &&
        ethUsdRate.minus(calculatedRate).gt(BigDecimal.fromString("-0.000000000000000001")),
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
      // TODO improve assertion
      assert.assertTrue(
        pairValue.minus(calculatedValue).lt(BigDecimal.fromString("0.000000000000000001")) &&
          pairValue.minus(calculatedValue).gt(BigDecimal.fromString("-0.000000000000000001")),
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
