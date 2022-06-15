import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_CRV_3POOL,
  ERC20_DAI,
  ERC20_FPIS,
  ERC20_FRAX,
  ERC20_FRAX_3CRV,
  ERC20_FXS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_SYN,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_WETH,
  NATIVE_ETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_SYN_FRAX,
  PAIR_UNISWAP_V2_USDC_ETH,
  PAIR_UNISWAP_V3_3CRV_USD,
  PAIR_UNISWAP_V3_FPIS_FRAX,
} from "../src/utils/Constants";
import { DEFAULT_DECIMALS } from "../src/utils/Decimals";
import {
  getBaseEthUsdRate,
  getBaseOhmUsdRate,
  getBaseTokenOrientation,
  getBaseTokenUSDRate,
  getUSDRate,
  PairTokenBaseOrientation,
} from "../src/utils/Price";
import {
  ERC20_STANDARD_DECIMALS,
  getERC20UsdRate,
  getEthUsdRate,
  getOhmUsdRate,
  getTribeUsdRate,
  mockEthUsdRate,
  mockFxsEthRate,
  mockRateUniswapV3,
  mockTribeEthRate,
  mockUniswapV2Pair,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  USDC_DECIMALS,
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
    const token0Address = Address.fromString(ERC20_OHM_V1);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(token0Address, token1Address) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token0 == OHM V2", () => {
    const token0Address = Address.fromString(ERC20_OHM_V2);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(token0Address, token1Address) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token0 == ETH", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.assertTrue(
      getBaseTokenOrientation(token0Address, token1Address) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token1 == OHM V1", () => {
    const token0Address = Address.fromString(ERC20_OHM_V1);
    const token1Address = Address.fromString(ERC20_FXS);

    assert.assertTrue(
      getBaseTokenOrientation(token1Address, token0Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == OHM V2", () => {
    const token0Address = Address.fromString(ERC20_OHM_V2);
    const token1Address = Address.fromString(ERC20_FXS);

    assert.assertTrue(
      getBaseTokenOrientation(token1Address, token0Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token1 == ETH", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_FXS);

    // Matches DAI for token0
    assert.assertTrue(
      getBaseTokenOrientation(token1Address, token0Address) === PairTokenBaseOrientation.TOKEN1,
    );
  });

  test("token0 == USDC, token1 == WETH", () => {
    const token0Address = Address.fromString(ERC20_USDC);
    const token1Address = Address.fromString(ERC20_WETH);

    assert.assertTrue(
      getBaseTokenOrientation(token0Address, token1Address) === PairTokenBaseOrientation.TOKEN0,
    );
  });

  test("token0 == WETH, token1 == USDC", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_USDC);

    assert.assertTrue(
      getBaseTokenOrientation(token0Address, token1Address) === PairTokenBaseOrientation.TOKEN1,
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
  test("DAI returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_DAI, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("FRAX returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("FRAX3CRV returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX_3CRV, OHM_USD_RESERVE_BLOCK).toString(), "1");
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

  test("FPIS (UniswapV3) returns correct rate", () => {
    const FPIS_SLOT0 = "74413935457348545615865577209";
    mockRateUniswapV3(
      PAIR_UNISWAP_V3_FPIS_FRAX,
      BigInt.fromString(FPIS_SLOT0),
      ERC20_FRAX,
      ERC20_FPIS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      BigInt.zero(),
      BigInt.zero(),
    );

    const expectedRate = BigDecimal.fromString("1.13357594386");

    // The calculated rate has greater precision than what is expected (through manual calculations),
    // so we trim the calculated rate to 11 decimal places.
    assert.stringEquals(
      expectedRate.toString(),
      getUSDRate(ERC20_FPIS, OHM_USD_RESERVE_BLOCK).toString().substring(0, 13),
    );
  });

  test("3CRV (UniswapV3) returns correct rate", () => {
    const CRV_SLOT0 = "79902581118842652024896";
    mockRateUniswapV3(
      PAIR_UNISWAP_V3_3CRV_USD,
      BigInt.fromString(CRV_SLOT0),
      ERC20_CRV_3POOL,
      ERC20_USDC,
      ERC20_STANDARD_DECIMALS,
      USDC_DECIMALS,
      BigInt.zero(),
      BigInt.zero(),
    );

    const expectedRate = BigDecimal.fromString("1.017097179333821703508152585419657");

    // The calculated rate has greater precision than what is expected (through manual calculations),
    // so we trim the calculated rate to 11 decimal places.
    assert.stringEquals(
      expectedRate.toString(),
      getUSDRate(ERC20_CRV_3POOL, OHM_USD_RESERVE_BLOCK).toString(),
    );
  });

  // test("Curve OHM-ETH returns correct rate", () => {
  //   mockEthUsdRate();
  //   mockUsdOhmV2Rate();

  //   // Mock total value
  //   const ohmReserves = BigDecimal.fromString("100");
  //   const wethReserves = BigDecimal.fromString("105");
  //   mockCurvePairTotalValue(
  //     PAIR_CURVE_OHM_ETH,
  //     ERC20_CRV_OHMETH,
  //     ERC20_OHM_V2,
  //     ERC20_WETH,
  //     toBigInt(ohmReserves, OHM_V2_DECIMALS),
  //     toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
  //     OHM_V2_DECIMALS,
  //     ERC20_STANDARD_DECIMALS,
  //   );
  //   // Total supply
  //   const crvTotalSupply = BigDecimal.fromString("20");
  //   mockERC20TotalSupply(
  //     ERC20_CRV_OHMETH,
  //     ERC20_STANDARD_DECIMALS,
  //     toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
  //   );

  //   // Unit rate = total value / total supply
  //   const totalValue = getPairValue(ohmReserves, wethReserves, getOhmUsdRate(), getEthUsdRate());
  //   const unitRate = totalValue.div(crvTotalSupply);

  //   assert.stringEquals(
  //     unitRate.toString(),
  //     getUSDRate(ERC20_CRV_OHMETH, OHM_USD_RESERVE_BLOCK).toString(),
  //   );
  // });

  // test("cvxOHM-ETH returns correct rate", () => {
  //   mockEthUsdRate();
  //   mockUsdOhmV2Rate();

  //   // Mock total value
  //   const ohmReserves = BigDecimal.fromString("100");
  //   const wethReserves = BigDecimal.fromString("105");
  //   mockCurvePairTotalValue(
  //     PAIR_CURVE_OHM_ETH,
  //     ERC20_CRV_OHMETH,
  //     ERC20_OHM_V2,
  //     ERC20_WETH,
  //     toBigInt(ohmReserves, OHM_V2_DECIMALS),
  //     toBigInt(wethReserves, ERC20_STANDARD_DECIMALS),
  //     OHM_V2_DECIMALS,
  //     ERC20_STANDARD_DECIMALS,
  //   );
  //   // Total supply
  //   const crvTotalSupply = BigDecimal.fromString("20");
  //   mockERC20TotalSupply(
  //     ERC20_CRV_OHMETH,
  //     ERC20_STANDARD_DECIMALS,
  //     toBigInt(crvTotalSupply, ERC20_STANDARD_DECIMALS),
  //   );

  //   // Unit rate = total value / total supply
  //   const totalValue = getPairValue(ohmReserves, wethReserves, getOhmUsdRate(), getEthUsdRate());
  //   const unitRate = totalValue.div(crvTotalSupply);

  //   assert.stringEquals(
  //     unitRate.toString(),
  //     getUSDRate(ERC20_CVX_OHMETH, OHM_USD_RESERVE_BLOCK).toString(),
  //   );
  // });
});

// TODO risk-free value
