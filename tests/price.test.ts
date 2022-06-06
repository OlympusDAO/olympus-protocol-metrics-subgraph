import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_OHM,
  ERC20_OHM_V2,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_WETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_TRIBE_ETH,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";
import {
  getBaseEthUsdRate,
  getBaseOhmUsdRate,
  getBaseTokenOrientation,
  getBaseTokenUSDRate,
  getUSDRate,
  PairTokenBaseOrientation,
} from "../src/utils/Price";

const ETH_TRIBE_RESERVE_TRIBE = BigInt.fromString("40963255589554358793575");
const ETH_TRIBE_RESERVE_ETH = BigInt.fromString("4956325030062526848");
const ETH_TRIBE_RESERVE_BLOCK = BigInt.fromString("1654504965");

const ETH_USD_RESERVE_USD = BigInt.fromString("51366826766840");
const ETH_USD_RESERVE_ETH = BigInt.fromString("27063460795012214253805");
const ETH_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");

const OHM_USD_RESERVE_USD = BigInt.fromString("18867842715859452534935831");
const OHM_USD_RESERVE_OHM = BigInt.fromString("994866147276819");
const OHM_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");

const OHM_V2_DECIMALS = 9;
const USDC_DECIMALS = 6;
const ERC20_STANDARD_DECIMALS = 18;

/**
 * 1898.01397375
 *
 * @returns
 */
const getEthUsdRate = (): BigDecimal => {
  return toDecimal(ETH_USD_RESERVE_USD, 6).div(toDecimal(ETH_USD_RESERVE_ETH, 18));
};

const mockEthUsdRate = (): void => {
  const contractAddress = Address.fromString(PAIR_UNISWAP_V2_USDC_ETH);
  createMockedFunction(
    contractAddress,
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(ETH_USD_RESERVE_USD),
    ethereum.Value.fromUnsignedBigInt(ETH_USD_RESERVE_ETH),
    ethereum.Value.fromUnsignedBigInt(ETH_USD_RESERVE_BLOCK),
  ]);

  // Token addresses
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_USDC)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_WETH)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(ERC20_USDC), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(USDC_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

/**
 * # ETH * price ETH / # TRIBE = price TRIBE (in USD)
 *
 * 4.956325030062526848 * 1898.01397375 / 40963.255589554358793575 = 0.22964909
 *
 * @returns
 */
const getTribeUsdRate = (): BigDecimal => {
  return toDecimal(ETH_TRIBE_RESERVE_ETH, 18)
    .times(getEthUsdRate())
    .div(toDecimal(ETH_TRIBE_RESERVE_TRIBE, 18));
};

const mockTribeEthRate = (): void => {
  const contractAddress = Address.fromString(PAIR_UNISWAP_V2_TRIBE_ETH);
  createMockedFunction(
    contractAddress,
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(ETH_TRIBE_RESERVE_ETH),
    ethereum.Value.fromUnsignedBigInt(ETH_TRIBE_RESERVE_TRIBE),
    ethereum.Value.fromUnsignedBigInt(ETH_TRIBE_RESERVE_BLOCK),
  ]);

  // Token addresses
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_WETH)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_TRIBE)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(ERC20_TRIBE), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

/**
 * 18.9652073
 *
 * @returns
 */
const getOhmUsdRate = (): BigDecimal => {
  return toDecimal(OHM_USD_RESERVE_USD, 18).div(toDecimal(OHM_USD_RESERVE_OHM, 9));
};

const mockUsdOhmRate = (): void => {
  const contractAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2);
  createMockedFunction(
    contractAddress,
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(OHM_USD_RESERVE_OHM),
    ethereum.Value.fromUnsignedBigInt(OHM_USD_RESERVE_USD),
    ethereum.Value.fromUnsignedBigInt(OHM_USD_RESERVE_BLOCK),
  ]);

  // Token addresses
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_OHM_V2)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_USDC)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(ERC20_OHM_V2), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(OHM_V2_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

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
    mockUsdOhmRate();

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
    mockUsdOhmRate();

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
    mockUsdOhmRate();

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
    mockUsdOhmRate();

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
    mockUsdOhmRate();

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
    mockUsdOhmRate();

    assert.stringEquals(
      getUSDRate(ERC20_OHM, OHM_USD_RESERVE_BLOCK).toString(),
      getOhmUsdRate().toString(),
    );
  });

  test("OHM V2 returns correct value", () => {
    mockUsdOhmRate();

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

    // There is a loss of precision, so we need to ensure that the value is close, but not equal
    assert.assertTrue(
      tribeUsdRate.minus(calculatedRate).lt(BigDecimal.fromString("0.000000000000000001")),
    );
  });

  // TODO Uniswap V3
});
