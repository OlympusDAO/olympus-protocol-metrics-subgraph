import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, log, test } from "matchstick-as";

import {
  ERC20_DAI,
  ERC20_FXS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_WETH,
  PAIR_UNISWAP_V2_USDC_ETH,
} from "../src/utils/Constants";
import {
  getBaseEthUsdRate,
  getBaseTokenOrientation,
  getBaseTokenUSDRate,
  PairTokenBaseOrientation,
} from "../src/utils/PriceBase";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import {
  getEthUsdRate,
  mockEthUsdRate,
  mockUniswapV2EthUsdRate,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
} from "./pairHelper";
import { mockTreasuryAddressNull } from "./bophadesHelper";

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();

  // mockEthUsdRate();
  mockStablecoinsPriceFeeds();
});

describe("ETH-USD rate", () => {
  test("rate calculation is correct", () => {
    mockEthUsdRate();
    mockUniswapV2EthUsdRate();

    assert.stringEquals(getBaseEthUsdRate().truncate(4).toString(), getEthUsdRate().truncate(4).toString());
  });

  test(
    "should return 0 when the pair cannot be accessed",
    () => {
      // UniswapV2Pair will return null if the pair doesn't exist at the current block
      const contractAddress = Address.fromString(PAIR_UNISWAP_V2_USDC_ETH);
      createMockedFunction(
        contractAddress,
        "getReserves",
        "getReserves():(uint112,uint112,uint32)",
      ).reverts();

      assert.stringEquals(getBaseEthUsdRate().toString(), "0");
    },
    true,
  );
});

describe("base token", () => {
  test("token0 == OHM V1", () => {
    const token0Address = Address.fromString(ERC20_OHM_V1);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.i32Equals(
      PairTokenBaseOrientation.UNKNOWN,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0 == OHM V2", () => {
    const token0Address = Address.fromString(ERC20_OHM_V2);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.i32Equals(
      PairTokenBaseOrientation.UNKNOWN,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0 == ETH", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_TRIBE);

    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN0,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token1 == ETH", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_FXS);

    // Matches DAI for token0
    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN1,
      getBaseTokenOrientation(token1Address, token0Address),
    );
  });

  test("token0 == USDC, token1 == WETH", () => {
    const token0Address = Address.fromString(ERC20_USDC);
    const token1Address = Address.fromString(ERC20_WETH);

    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN0,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0 == WETH, token1 == USDC", () => {
    const token0Address = Address.fromString(ERC20_WETH);
    const token1Address = Address.fromString(ERC20_USDC);

    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN0, // Defaults to token0
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0 == DAI, token1 == OHM V2", () => {
    const token0Address = Address.fromString(ERC20_DAI);
    const token1Address = Address.fromString(ERC20_OHM_V2);

    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN0,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0 == OHM V2, token1 == DAI", () => {
    const token0Address = Address.fromString(ERC20_OHM_V2);
    const token1Address = Address.fromString(ERC20_DAI);

    assert.i32Equals(
      PairTokenBaseOrientation.TOKEN1,
      getBaseTokenOrientation(token0Address, token1Address),
    );
  });

  test("token0-token1 non-base pair", () => {
    const fxsAddress = Address.fromString(ERC20_FXS);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.i32Equals(
      PairTokenBaseOrientation.UNKNOWN,
      getBaseTokenOrientation(tribeAddress, fxsAddress),
    );
  });

  test("token1-token0 non-base pair", () => {
    const fxsAddress = Address.fromString(ERC20_FXS);
    const tribeAddress = Address.fromString(ERC20_TRIBE);

    assert.i32Equals(
      PairTokenBaseOrientation.UNKNOWN,
      getBaseTokenOrientation(fxsAddress, tribeAddress),
    );
  });
});

describe("base token USD rate", () => {
  test(
    "token0 == OHM V1, token1 == TRIBE",
    () => {
      mockUsdOhmV2Rate();

      // Throws as OHM is not a base token
      getBaseTokenUSDRate(
        Address.fromString(ERC20_OHM_V1),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      );
    },
    true,
  );

  test(
    "token0 == OHM V2, token1 == TRIBE",
    () => {
      mockUsdOhmV2Rate();

      // Throws as OHM is not a base token
      getBaseTokenUSDRate(
        Address.fromString(ERC20_OHM_V2),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      );
    },
    true,
  );

  test("token0 == ETH, token1 == TRIBE", () => {
    mockEthUsdRate();

    assert.stringEquals(
      getBaseTokenUSDRate(
        Address.fromString(ERC20_WETH),
        Address.fromString(ERC20_TRIBE),
        PairTokenBaseOrientation.TOKEN0,
        OHM_USD_RESERVE_BLOCK,
      ).truncate(4).toString(),
      getEthUsdRate().truncate(4).toString(),
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
      ).truncate(4).toString(),
      getEthUsdRate().truncate(4).toString(),
    );
  });
});
