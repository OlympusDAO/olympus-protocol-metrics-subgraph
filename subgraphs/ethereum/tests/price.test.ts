import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { DEFAULT_DECIMALS, toBigInt } from "../../shared/src/utils/Decimals";
import {
  BALANCER_VAULT,
  ERC20_AURA,
  ERC20_AURA_BAL,
  ERC20_AURA_VL,
  ERC20_BALANCER_WETH_FDT,
  ERC20_BTRFLY_V1,
  ERC20_BTRFLY_V2,
  ERC20_CRV_3POOL,
  ERC20_DAI,
  ERC20_FDT,
  ERC20_FPIS,
  ERC20_FRAX,
  ERC20_FRAX_3CRV,
  ERC20_FXS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_SYN,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_UST,
  ERC20_WETH,
  getWalletAddressesForContract,
  NATIVE_ETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_SYN_FRAX,
  PAIR_UNISWAP_V2_TRIBE_ETH,
  PAIR_UNISWAP_V3_3CRV_USD,
  PAIR_UNISWAP_V3_FPIS_FRAX,
  PAIR_UNISWAP_V3_FXS_ETH,
  PAIR_UNISWAP_V3_WETH_BTRFLY_V1,
  PAIR_UNISWAP_V3_WETH_BTRFLY_V2,
  POOL_BALANCER_OHM_DAI,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_WETH_FDT_ID,
} from "../src/utils/Constants";
import { getBaseOhmUsdRate, getUSDRate, getUSDRateBalancer } from "../src/utils/Price";
import { mockBalancerGaugeBalanceZero } from "./contractHelper.test";
import {
  mockBalancerVaultAuraWeth,
  mockBalancerVaultGraviAuraBalWeth,
  mockBalancerVaultZero,
  mockBalanceVaultOhmDaiEth,
  mockBalanceVaultWethFdt,
  OHM_DAI_ETH_BALANCE_DAI,
  OHM_DAI_ETH_BALANCE_OHM,
  OHM_DAI_ETH_WEIGHT_DAI,
  OHM_DAI_ETH_WEIGHT_OHM,
} from "./liquidityBalancer.test";
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

describe("OHM-USD rate", () => {
  test("Sushi OHM-DAI rate calculation is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();
    mockBalancerVaultZero(); // Ensures that the OHM-DAI-ETH Balancer pool is not used for price lookup

    assert.stringEquals(
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("Sushi OHM-DAI rate is used when greater than Balancer", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();
    mockBalanceVaultOhmDaiEth(
      BigDecimal.fromString("1"),
      BigDecimal.fromString("0.5"),
      BigDecimal.fromString("0.25"),
      BigDecimal.fromString("0.25"),
    ); // Total value is small, so Sushi OHM-DAI is used

    assert.stringEquals(
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("Balancer OHM-DAI-ETH rate is used when Sushi is empty", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate(
      toBigInt(BigDecimal.fromString("1"), 9),
      toBigInt(BigDecimal.fromString("1"), 18),
    ); // Total value is small, so Balancer OHM-DAI-ETH is used
    mockBalanceVaultOhmDaiEth();

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(
      calculatedRate.toString(),
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
    );
  });

  test("Balancer OHM-DAI-ETH rate is used when DAI-ETH reserves are greater than Sushi", () => {
    mockEthUsdRate(); // ETH = 1898.01397375
    mockUsdOhmV2Rate(
      toBigInt(BigDecimal.fromString("200000"), 9),
      toBigInt(BigDecimal.fromString("2000000"), 18),
    );
    // OHM_DAI_ETH_BALANCE_DAI < Sushi USD reserves (2,000,000)
    // OHM_DAI_ETH_BALANCE_WETH * ETH price + OHM_DAI_ETH_BALANCE_DAI > Sushi USD reserves
    mockBalanceVaultOhmDaiEth();

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(
      calculatedRate.toString(),
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
    );
  });

  test("Sushi OHM-DAI is used when Balancer pool reverts", () => {
    mockUsdOhmV2Rate();

    // Balancer vault reverts
    createMockedFunction(
      Address.fromString(BALANCER_VAULT),
      "getPoolTokens",
      "getPoolTokens(bytes32):(address[],uint256[],uint256)",
    )
      .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(POOL_BALANCER_OHM_DAI_WETH_ID))])
      .reverts();

    assert.stringEquals(
      getOhmUsdRate().toString(), // OHM-DAI rate is used
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
    );
  });

  test(
    "Throws error when no price can be determined",
    () => {
      createMockedFunction(
        Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2),
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).reverts();

      // Balancer vault reverts
      createMockedFunction(
        Address.fromString(BALANCER_VAULT),
        "getPoolTokens",
        "getPoolTokens(bytes32):(address[],uint256[],uint256)",
      )
        .withArgs([
          ethereum.Value.fromFixedBytes(Bytes.fromHexString(POOL_BALANCER_OHM_DAI_WETH_ID)),
        ])
        .reverts();

      createMockedFunction(
        Address.fromString(BALANCER_VAULT),
        "getPoolTokens",
        "getPoolTokens(bytes32):(address[],uint256[],uint256)",
      )
        .withArgs([
          ethereum.Value.fromFixedBytes(Bytes.fromHexString(POOL_BALANCER_OHM_DAI)),
        ])
        .reverts();

      // Throws an error
      getBaseOhmUsdRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      );
    },
    true,
  );

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

describe("get USD rate", () => {
  beforeEach(() => {
    mockBalancerGaugeBalanceZero(getWalletAddressesForContract(ERC20_BALANCER_WETH_FDT));
  });

  test("DAI returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_DAI, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("FRAX returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("FRAX3CRV returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX_3CRV, OHM_USD_RESERVE_BLOCK).toString(), "1");
  });

  test("UST returns 1 before May 9th", () => {
    assert.stringEquals(getUSDRate(ERC20_UST, BigInt.fromString("14720000")).toString(), "1");
  });

  test("UST returns 0 after May 9th", () => {
    assert.stringEquals(getUSDRate(ERC20_UST, BigInt.fromString("14800000")).toString(), "0");
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

  test("TRIBE (UniswapV2) handles contract revert on token1", () => {
    mockEthUsdRate();
    mockTribeEthRate();

    // Mock contract revert
    createMockedFunction(
      Address.fromString(PAIR_UNISWAP_V2_TRIBE_ETH),
      "token1",
      "token1():(address)",
    ).reverts();

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, OHM_USD_RESERVE_BLOCK);

    assert.stringEquals("0", tribeUsdRate.toString());
  });

  test("TRIBE (UniswapV2) handles contract revert on token0", () => {
    mockEthUsdRate();
    mockTribeEthRate();

    // Mock contract revert
    createMockedFunction(
      Address.fromString(PAIR_UNISWAP_V2_TRIBE_ETH),
      "token0",
      "token0():(address)",
    ).reverts();

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, OHM_USD_RESERVE_BLOCK);

    assert.stringEquals("0", tribeUsdRate.toString());
  });

  test(
    "ERC20 without liquidity pool mapping returns error",
    () => {
      // BOTTO
      getUSDRate("0x9dfad1b7102d46b1b197b90095b5c4e9f5845bba", OHM_USD_RESERVE_BLOCK);
    },
    true,
  );

  test("OHM-DAI-ETH (Balancer) returns correct value", () => {
    mockEthUsdRate();
    mockBalanceVaultOhmDaiEth();

    const usdRate = getUSDRateBalancer(
      ERC20_OHM_V2,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
    );

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(calculatedRate.toString(), usdRate.toString());
  });

  test("auraBAL (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultGraviAuraBalWeth();

    const usdRate = getUSDRate(ERC20_AURA_BAL, OHM_USD_RESERVE_BLOCK);
    // (51484525313020258856*10^-18/0.3333)/(4789103758014220845986*10^-18/0.3334))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.toString(), usdRate.toString());
  });

  test("aura (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultAuraWeth();

    const usdRate = getUSDRate(ERC20_AURA, OHM_USD_RESERVE_BLOCK);
    // (51484525313020258856*10^-18/0.5)/(4789103758014220845986*10^-18/0.5))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.toString(), usdRate.toString());
  });

  test("vlAura (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultAuraWeth();

    const usdRate = getUSDRate(ERC20_AURA_VL, OHM_USD_RESERVE_BLOCK);
    // (51484525313020258856*10^-18/0.5)/(4789103758014220845986*10^-18/0.5))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.toString(), usdRate.toString());
  });

  test("FDT (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalanceVaultWethFdt();

    const usdRate = getUSDRate(ERC20_FDT, OHM_USD_RESERVE_BLOCK);
    const calculatedRate = BigDecimal.fromString("0.02459313077010308743409892482569878");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.toString(), usdRate.toString());
  });

  test("FDT (Balancer) handles empty reserves", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalanceVaultWethFdt(BigDecimal.zero(), BigDecimal.zero());

    const usdRate = getUSDRate(ERC20_FDT, OHM_USD_RESERVE_BLOCK);

    assert.stringEquals("0", usdRate.toString());
  });

  test("FDT (Balancer) handles vault contract revert", () => {
    mockEthUsdRate();

    // Handle revert
    createMockedFunction(
      Address.fromString(BALANCER_VAULT),
      "getPoolTokens",
      "getPoolTokens(bytes32):(address[],uint256[],uint256)",
    )
      .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(POOL_BALANCER_WETH_FDT_ID))])
      .reverts();

    const usdRate = getUSDRate(ERC20_FDT, OHM_USD_RESERVE_BLOCK);

    // Revert, so 0 is returned
    assert.stringEquals("0", usdRate.toString());
  });

  test("FDT (Balancer) handles getPool contract revert", () => {
    mockEthUsdRate();

    // Handle revert
    createMockedFunction(
      Address.fromString(ERC20_BALANCER_WETH_FDT),
      "getPool",
      "getPool(bytes32):(address,uint8)",
    )
      .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(POOL_BALANCER_WETH_FDT_ID))])
      .reverts();

    const usdRate = getUSDRate(ERC20_FDT, OHM_USD_RESERVE_BLOCK);

    // Revert, so 0 is returned
    assert.stringEquals("0", usdRate.toString());
  });

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

  test("FXS (UniswapV3) handles contract revert", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    // Mock contract revert
    createMockedFunction(
      Address.fromString(PAIR_UNISWAP_V3_FXS_ETH),
      "token0",
      "token0():(address)",
    ).reverts();

    const fxsUsdRate = getUSDRate(ERC20_FXS, OHM_USD_RESERVE_BLOCK);
    assert.stringEquals("0", fxsUsdRate.toString());
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

  test("BTRFLY V1 (UniswapV3) returns correct value", () => {
    mockEthUsdRate();

    const SLOT0 = "18438610691616111025325107";
    mockRateUniswapV3(
      PAIR_UNISWAP_V3_WETH_BTRFLY_V1,
      BigInt.fromString(SLOT0),
      ERC20_WETH,
      ERC20_BTRFLY_V1,
      ERC20_STANDARD_DECIMALS,
      9,
      BigInt.zero(),
      BigInt.zero(),
    );

    const usdRate = getUSDRate(ERC20_BTRFLY_V1, OHM_USD_RESERVE_BLOCK);

    // (1/(18438610691616111025325107*18438610691616111025325107/(2^192)))*(1/(10^9))*1898.01397374525312166748106658611
    assert.stringEquals("35.043072999", usdRate.toString().slice(0, 12));
  });

  test("BTRFLY V2 (UniswapV3) returns correct value", () => {
    mockEthUsdRate();

    const SLOT0 = "201047635549140265156647342605";
    mockRateUniswapV3(
      PAIR_UNISWAP_V3_WETH_BTRFLY_V2,
      BigInt.fromString(SLOT0),
      ERC20_WETH,
      ERC20_BTRFLY_V2,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      BigInt.zero(),
      BigInt.zero(),
    );

    const slot0Decimal = BigDecimal.fromString(SLOT0);
    const expectedRate = BigDecimal.fromString("1")
      .div(slot0Decimal.times(slot0Decimal).div(BigInt.fromI32(2).pow(192).toBigDecimal()))
      .times(getEthUsdRate()); // 294.7546283139931202627807530029295

    const usdRate = getUSDRate(ERC20_BTRFLY_V2, OHM_USD_RESERVE_BLOCK);

    assert.stringEquals(expectedRate.toString(), usdRate.toString());
    assert.stringEquals("294.75462831", usdRate.toString().slice(0, 12));
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
