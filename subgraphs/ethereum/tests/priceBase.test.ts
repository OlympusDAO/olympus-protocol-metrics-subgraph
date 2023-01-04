import { Address } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as";

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
import {
  getEthUsdRate,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
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
      PairTokenBaseOrientation.TOKEN1,
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
      ).toString(),
      getEthUsdRate().toString(),
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
