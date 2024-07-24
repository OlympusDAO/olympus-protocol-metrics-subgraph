import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  test,
  log,
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
  PAIR_UNISWAP_V3_WETH_OHM,
  POOL_BALANCER_OHM_DAI,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_WETH_FDT_ID,
} from "../src/utils/Constants";
import { getUSDRate, getUSDRateBalancer } from "../src/utils/Price";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20Balance } from "./erc20Helper";
import {
  getERC20UsdRate,
  getEthUsdRate,
  getOhmUsdRate,
  getTribeUsdRate,
  mockBalancerGaugeBalanceZero,
  mockBalancerVaultAuraWeth,
  mockBalancerVaultGraviAuraBalWeth,
  mockBalancerVaultOhmDaiEth,
  mockBalancerVaultWethFdt,
  mockBalancerVaultZero,
  mockEthUsdRate,
  mockFxsEthRate,
  mockRateUniswapV3,
  mockTribeEthRate,
  mockUniswapV2Pair,
  mockUniswapV2PairsZero,
  mockUniswapV3PairsZero,
  mockUsdOhmV2Rate,
  OHM_DAI_ETH_BALANCE_DAI,
  OHM_DAI_ETH_BALANCE_OHM,
  OHM_DAI_ETH_WEIGHT_DAI,
  OHM_DAI_ETH_WEIGHT_OHM,
  OHM_V2_DECIMALS,
  USDC_DECIMALS,
} from "./pairHelper";
import { TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import { UNISWAP_V3_POSITION_MANAGER } from "../src/liquidity/LiquidityUniswapV3";
import { mockUniswapV3Pair, mockUniswapV3Positions, mockUniswapV3Position } from "./uniswapV3Helper";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { mockTreasuryAddressNull } from "./bophadesHelper";

const BLOCK_NUMBER: BigInt = BigInt.fromString("14000000");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();

  mockEthUsdRate();
  mockStablecoinsPriceFeeds();
  mockBalancerVaultZero();
  mockUniswapV2PairsZero();
  mockUniswapV3PairsZero();
  mockBalancerGaugeBalanceZero(getWalletAddressesForContract(ERC20_BALANCER_WETH_FDT, BLOCK_NUMBER));
});

describe("OHM-USD rate", () => {
  test("Sushi OHM-DAI rate calculation is correct", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).truncate(4).toString(),
      getOhmUsdRate().truncate(4).toString(),
    );
  });

  test("Sushi OHM-DAI rate is used when greater than Balancer", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate();
    mockBalancerVaultOhmDaiEth(
      BigDecimal.fromString("1"),
      BigDecimal.fromString("0.5"),
      BigDecimal.fromString("0.25"),
      BigDecimal.fromString("0.25"),
    ); // Total value is small, so Sushi OHM-DAI is used

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).truncate(4).toString(),
      getOhmUsdRate().truncate(4).toString(),
    );
  });

  test("Balancer OHM-DAI-ETH rate is used when Sushi is empty", () => {
    mockEthUsdRate();
    mockUsdOhmV2Rate(
      toBigInt(BigDecimal.fromString("1"), 9),
      toBigInt(BigDecimal.fromString("1"), 18),
    ); // Total value is small, so Balancer OHM-DAI-ETH is used
    mockBalancerVaultOhmDaiEth();

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(
      calculatedRate.truncate(4).toString(),
      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).truncate(4).toString(),
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
    mockBalancerVaultOhmDaiEth();

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(
      calculatedRate.truncate(4).toString(),
      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).truncate(4).toString(),
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
      getOhmUsdRate().truncate(4).toString(), // OHM-DAI rate is used
      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).truncate(4).toString(),
    );
  });

  test("Uniswap V3 wETH-OHM rate is used when non-OHM reserves are greater than Sushi", () => {
    mockEthUsdRate(); // ETH = 1898.01397374
    mockUsdOhmV2Rate(
      toBigInt(BigDecimal.fromString("10"), 9),
      toBigInt(BigDecimal.fromString("100"), 18),
    );

    // Mock OHM price = 13.3791479512
    mockUniswapV3Pair(PAIR_UNISWAP_V3_WETH_OHM, ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("210385600452651183274688532908673"), BigInt.fromI32(157695));
    mockUniswapV3Positions(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, [BigInt.fromString("1")]);
    mockUniswapV3Position(UNISWAP_V3_POSITION_MANAGER, TREASURY_ADDRESS_V3, BigInt.fromString("1"), ERC20_OHM_V2, ERC20_WETH, BigInt.fromString("346355586036686019"), BigInt.fromI32(-887220), BigInt.fromI32(887220));

    const ethBalance = BigDecimal.fromString("919.574080927");
    const ohmBalance = BigDecimal.fromString("130454.081369749");

    // Mock balances in the pair (used for determining price)
    mockERC20Balance(ERC20_OHM_V2, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ohmBalance, OHM_V2_DECIMALS));
    mockERC20Balance(ERC20_WETH, PAIR_UNISWAP_V3_WETH_OHM, toBigInt(ethBalance, ERC20_STANDARD_DECIMALS));

    // 919.574080927401380445 * 1898.01397374 / 130454.081369749 = 13.3791479512
    const calculatedRate = BigDecimal.fromString("13.3835");

    assert.stringEquals(
      calculatedRate.truncate(4).toString(),
      getUSDRate(ERC20_OHM_V2, BigInt.zero()).truncate(4).toString(),
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
      getUSDRate(ERC20_OHM_V2,
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

      getUSDRate(ERC20_OHM_V2,
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      );
    },
    true,
  );
});

describe("get USD rate", () => {
  test("DAI returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_DAI, BLOCK_NUMBER).toString(), "1");
  });

  test("FRAX returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX, BLOCK_NUMBER).toString(), "1");
  });

  test("FRAX3CRV returns 1", () => {
    assert.stringEquals(getUSDRate(ERC20_FRAX_3CRV, BLOCK_NUMBER).toString(), "1");
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
      getUSDRate(NATIVE_ETH, BLOCK_NUMBER).truncate(4).toString(),
      getEthUsdRate().truncate(4).toString(),
    );
  });

  test("wETH returns correct value", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getUSDRate(ERC20_WETH, BLOCK_NUMBER).truncate(4).toString(),
      getEthUsdRate().truncate(4).toString(),
    );
  });

  test("OHM V1 returns correct value", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V1, BLOCK_NUMBER).truncate(4).toString(),
      getOhmUsdRate().truncate(4).toString(),
    );
  });

  test("OHM V2 returns correct value", () => {
    mockUsdOhmV2Rate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM_V2, BLOCK_NUMBER).truncate(4).toString(),
      getOhmUsdRate().truncate(4).toString(),
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

    const synUsdRate = getUSDRate(ERC20_SYN, BLOCK_NUMBER);
    log.debug("SYN USD rate {}", [synUsdRate.toString()]);
    const calculatedRate = getERC20UsdRate(fraxReserve, synReserve, BigDecimal.fromString("1"));
    log.debug("difference: {}", [synUsdRate.minus(calculatedRate).toString()]);

    assert.stringEquals(synUsdRate.truncate(4).toString(), calculatedRate.truncate(4).toString());
  });

  test("TRIBE (UniswapV2) returns correct value", () => {
    mockEthUsdRate();
    mockTribeEthRate();

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, BLOCK_NUMBER);
    const calculatedRate = getTribeUsdRate();
    log.debug("difference: {}", [tribeUsdRate.minus(calculatedRate).toString()]);

    assert.stringEquals(tribeUsdRate.truncate(4).toString(), calculatedRate.truncate(4).toString());
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

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, BLOCK_NUMBER);

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

    const tribeUsdRate = getUSDRate(ERC20_TRIBE, BLOCK_NUMBER);

    assert.stringEquals("0", tribeUsdRate.toString());
  });

  test(
    "ERC20 without liquidity pool mapping returns error",
    () => {
      // BOTTO
      getUSDRate("0x9dfad1b7102d46b1b197b90095b5c4e9f5845bba", BLOCK_NUMBER);
    },
    true,
  );

  test("OHM-DAI-ETH (Balancer) returns correct value", () => {
    mockEthUsdRate();
    mockBalancerVaultOhmDaiEth();

    const usdRate = getUSDRateBalancer(
      ERC20_OHM_V2,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      BLOCK_NUMBER,
    );

    // ((1932155.145566782258916959/0.25)/(221499.733846818/0.5)) = 17.44611709
    const calculatedRate = OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
      OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
    );

    assert.stringEquals(calculatedRate.truncate(4).toString(), usdRate.truncate(4).toString());
  });

  test("auraBAL (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultGraviAuraBalWeth();

    const usdRate = getUSDRate(ERC20_AURA_BAL, BLOCK_NUMBER);
    // (51484525313020258856*10^-18/0.3333)/(4789103758014220845986*10^-18/0.3334))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.truncate(4).toString(), usdRate.truncate(4).toString());
  });

  test("aura (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultAuraWeth();

    const usdRate = getUSDRate(ERC20_AURA, BLOCK_NUMBER);
    // (51484525313020258856*10^-18/0.5)/(4789103758014220845986*10^-18/0.5))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.truncate(4).toString(), usdRate.truncate(4).toString());
  });

  test("vlAura (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultAuraWeth();

    const usdRate = getUSDRate(ERC20_AURA_VL, BLOCK_NUMBER);
    // (51484525313020258856*10^-18/0.5)/(4789103758014220845986*10^-18/0.5))*1898
    const calculatedRate = BigDecimal.fromString("20.40430807376620776594455756154979");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.truncate(4).toString(), usdRate.truncate(4).toString());
  });

  test("FDT (Balancer) returns correct value", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultWethFdt();

    const usdRate = getUSDRate(ERC20_FDT, BLOCK_NUMBER);
    const calculatedRate = BigDecimal.fromString("0.02459313077010308743409892482569878");

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.stringEquals(calculatedRate.truncate(4).toString(), usdRate.truncate(4).toString());
  });

  test("FDT (Balancer) handles empty reserves", () => {
    mockEthUsdRate();

    // Mock the balancer
    mockBalancerVaultWethFdt(BigDecimal.zero(), BigDecimal.zero());

    const usdRate = getUSDRate(ERC20_FDT, BLOCK_NUMBER);

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

    const usdRate = getUSDRate(ERC20_FDT, BLOCK_NUMBER);

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

    const usdRate = getUSDRate(ERC20_FDT, BLOCK_NUMBER);

    // Revert, so 0 is returned
    assert.stringEquals("0", usdRate.toString());
  });

  test("FXS (UniswapV3) returns correct value for FXS", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    const fxsUsdRate = getUSDRate(ERC20_FXS, BLOCK_NUMBER);
    const calculatedRate = BigDecimal.fromString("5.877414538282582611"); // 5.87741453828258261098431099338906

    assert.stringEquals(fxsUsdRate.truncate(4).toString(), calculatedRate.truncate(4).toString());
  });

  test("FXS (UniswapV3) returns correct value for ETH", () => {
    mockEthUsdRate();
    mockFxsEthRate();

    const ethUsdRate = getUSDRate(ERC20_WETH, BLOCK_NUMBER);
    const calculatedRate = BigDecimal.fromString("1898.013973745253121667");
    log.debug("difference: {}", [ethUsdRate.minus(calculatedRate).toString()]);

    assert.stringEquals(ethUsdRate.truncate(4).toString(), calculatedRate.truncate(4).toString());
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

    const fxsUsdRate = getUSDRate(ERC20_FXS, BLOCK_NUMBER);
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
      expectedRate.truncate(4).toString(),
      getUSDRate(ERC20_FPIS, BLOCK_NUMBER).truncate(4).toString(),
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
      expectedRate.truncate(4).toString(),
      getUSDRate(ERC20_CRV_3POOL, BLOCK_NUMBER).truncate(4).toString(),
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

    const usdRate = getUSDRate(ERC20_BTRFLY_V1, BLOCK_NUMBER);

    // (1/(18438610691616111025325107*18438610691616111025325107/(2^192)))*(1/(10^9))*1898.01397374525312166748106658611
    assert.stringEquals("35.043", usdRate.truncate(4).toString());
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

    const usdRate = getUSDRate(ERC20_BTRFLY_V2, BLOCK_NUMBER);

    assert.stringEquals(expectedRate.truncate(4).toString(), usdRate.truncate(4).toString());
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
  //     getUSDRate(ERC20_CRV_OHMETH, BLOCK_NUMBER).toString(),
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
  //     getUSDRate(ERC20_CVX_OHMETH, BLOCK_NUMBER).toString(),
  //   );
  // });
});

// TODO risk-free value
