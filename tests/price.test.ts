import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeAll,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly/index";

import {
  ERC20_DAI,
  ERC20_OHM,
  ERC20_OHM_V2,
  ERC20_TRIBE,
  ERC20_WETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";
import {
  getBaseEthUsdRate,
  getBaseTokenOrientation,
  getBaseUsdOhmRate,
  PairTokenBaseOrientation,
} from "../src/utils/Price";

const ETH_USD_RESERVE_USD = BigInt.fromString("51366826766840");
const ETH_USD_RESERVE_ETH = BigInt.fromString("27063460795012214253805");
const ETH_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");

const OHM_USD_RESERVE_USD = BigInt.fromString("18867842715859452534935831");
const OHM_USD_RESERVE_OHM = BigInt.fromString("994866147276819");
const OHM_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");

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
};

const getUsdOhmRate = (): BigDecimal => {
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
      getBaseUsdOhmRate(
        BigInt.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK).plus(BigInt.fromString("1")),
      ).toString(),
      getUsdOhmRate().toString(),
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

      getBaseUsdOhmRate(
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
