import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { ContractNameLookup } from "../../src/contracts/ContractLookup";
import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { PriceHandlerUniswapV3 } from "../../src/price/PriceHandlerUniswapV3";
import { toBigInt } from "../../src/utils/Decimals";
import { addressesEqual } from "../../src/utils/StringHelper";

export const mockRateUniswapV3 = (
  pairAddress: string,
  sqrtPriceX96: BigInt,
  tick: i32,
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Balance: BigInt,
  token1Balance: BigInt,
): void => {
  const contractAddress = Address.fromString(pairAddress);
  // slot0
  createMockedFunction(
    contractAddress,
    "slot0",
    "slot0():(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(sqrtPriceX96),
    ethereum.Value.fromI32(tick),
    ethereum.Value.fromI32(1),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(0),
    ethereum.Value.fromBoolean(true),
  ]);

  // Tokens
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token0Address)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token1Address)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(token0Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token0Decimals)],
  );
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );

  // Balance
  createMockedFunction(
    Address.fromString(token0Address),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(contractAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(token0Balance)]);
  createMockedFunction(
    Address.fromString(token1Address),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(contractAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(token1Balance)]);
};

const UNISWAP_V3_POSITION_MANAGER = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1".toLowerCase();
const LP_UNISWAP_V3_FPIS_FRAX = "0x8fe536c7dc019455cce34746755c64bbe2aa163b".toLowerCase();
const ERC20_FRAX = "0x853d955acef822db058eb8505911ed77f175b99e".toLowerCase();
const ERC20_FPIS = "0xc2544a32872a91f4a553b404c6950e89de901fdb".toLowerCase();
const FPIS_FRAX_SQRTPRICEX96 = BigInt.fromString("74413935457348545615865577209"); // Copied from FPIS
const FPIS_FRAX_TICK: i32 = -57778;
const FRAX_BALANCE = BigDecimal.fromString("10");
const FPIS_BALANCE = BigDecimal.fromString("15");
const BLOCK = BigInt.fromString("1");

const WALLET_ADDRESS = "0x18a390bD45bCc92652b9A91AD51Aed7f1c1358f5".toLowerCase();

const ERC20_OHM = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5".toLowerCase();
const ERC20_WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
const ERC20_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();

const OHM_WETH_POOL = "0x88051b0eea095007d3bef21ab287be961f3d8598".toLowerCase();
const OHM_WETH_SQRTPRICEX96 = BigInt.fromString("198259033222864761237442349019430");
const OHM_WETH_TICK: i32 = 156507;
const OHM_WETH_POSITION_ID = BigInt.fromString("222");
const OHM_WETH_POSITION_TICK_LOWER: i32 = -887220;
const OHM_WETH_POSITION_TICK_UPPER: i32 = 887220;
const OHM_WETH_POSITION_LIQUIDITY = BigInt.fromString("346355586036686019");

const OHM_USDC_POOL = "0x183ea22691c54806FE96555436dd312b6BeFAc2F".toLowerCase();
const OHM_USDC_SQRTPRICEX96 = BigInt.fromString("11823183971744406029263508776");
const OHM_USDC_TICK: i32 = -38048;
const OHM_USDC_POSITION_ID = BigInt.fromString("1872809");
const OHM_USDC_POSITION_TICK_LOWER: i32 = -44200;
const OHM_USDC_POSITION_TICK_UPPER: i32 = 887220;
const OHM_USDC_POSITION_LIQUIDITY = BigInt.fromString("11264485942092");

export const mockFpisFraxPair = (): void => {
  mockRateUniswapV3(
    LP_UNISWAP_V3_FPIS_FRAX,
    FPIS_FRAX_SQRTPRICEX96,
    FPIS_FRAX_TICK,
    ERC20_FRAX,
    ERC20_FPIS,
    18,
    18,
    toBigInt(FRAX_BALANCE),
    toBigInt(FPIS_BALANCE),
  );
};

export const mockOhmWethPair = (): void => {
  mockRateUniswapV3(
    OHM_WETH_POOL,
    OHM_WETH_SQRTPRICEX96,
    OHM_WETH_TICK,
    ERC20_OHM,
    ERC20_WETH,
    9,
    18,
    toBigInt(BigDecimal.fromString("139219.0068728")),
    toBigInt(BigDecimal.fromString("871.50742434")),
  );
};

export const mockOhmUsdcPair = (): void => {
  mockRateUniswapV3(
    OHM_USDC_POOL,
    OHM_USDC_SQRTPRICEX96,
    OHM_USDC_TICK,
    ERC20_OHM,
    ERC20_USDC,
    9,
    6,
    toBigInt(BigDecimal.fromString("75504.35396532")),
    toBigInt(BigDecimal.fromString("445506.63314")),
  );
};

export const mockOhmWethPosition = (): void => {
  // positionManager.balanceOf()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(WALLET_ADDRESS))])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))]);

  // positionManager.tokenOfOwnerByIndex()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "tokenOfOwnerByIndex",
    "tokenOfOwnerByIndex(address,uint256):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(WALLET_ADDRESS)), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([ethereum.Value.fromUnsignedBigInt(OHM_WETH_POSITION_ID)]);

  // positionManager.positions()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "positions",
    "positions(uint256):(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(OHM_WETH_POSITION_ID)])
    .returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // nonce
      ethereum.Value.fromAddress(Address.zero()), // operator
      ethereum.Value.fromAddress(Address.fromString(ERC20_OHM)), // token0
      ethereum.Value.fromAddress(Address.fromString(ERC20_WETH)), // token1
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3000)), // fee
      ethereum.Value.fromI32(OHM_WETH_POSITION_TICK_LOWER), // tickLower
      ethereum.Value.fromI32(OHM_WETH_POSITION_TICK_UPPER), // tickUpper
      ethereum.Value.fromUnsignedBigInt(OHM_WETH_POSITION_LIQUIDITY), // liquidity
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // feeGrowthInside0X128
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // feeGrowthInside1X128
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // tokensOwed0
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // tokensOwed1
    ]);
};

export const mockOhmUsdcPosition = (): void => {
  // positionManager.balanceOf()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "balanceOf",
    "balanceOf(address):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(WALLET_ADDRESS))])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))]);

  // positionManager.tokenOfOwnerByIndex()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "tokenOfOwnerByIndex",
    "tokenOfOwnerByIndex(address,uint256):(uint256)",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(WALLET_ADDRESS)), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([ethereum.Value.fromUnsignedBigInt(OHM_USDC_POSITION_ID)]);

  // positionManager.positions()
  createMockedFunction(
    Address.fromString(UNISWAP_V3_POSITION_MANAGER),
    "positions",
    "positions(uint256):(uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(OHM_USDC_POSITION_ID)])
    .returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // nonce
      ethereum.Value.fromAddress(Address.zero()), // operator
      ethereum.Value.fromAddress(Address.fromString(ERC20_OHM)), // token0
      ethereum.Value.fromAddress(Address.fromString(ERC20_USDC)), // token1
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10000)), // fee
      ethereum.Value.fromI32(OHM_USDC_POSITION_TICK_LOWER), // tickLower
      ethereum.Value.fromI32(OHM_USDC_POSITION_TICK_UPPER), // tickUpper
      ethereum.Value.fromUnsignedBigInt(OHM_USDC_POSITION_LIQUIDITY), // liquidity
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // feeGrowthInside0X128
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // feeGrowthInside1X128
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // tokensOwed0
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // tokensOwed1
    ]);
};

const FPIS_RATE = BigDecimal.fromString("1.13357594386");

describe("getPrice", () => {
  test("price is correct when secondary token = $1", () => {
    const stablecoinPriceLookup: PriceLookup = (
      _tokenAddress: string,
      _block: BigInt,
    ): PriceLookupResult => {
      return {
        liquidity: BigDecimal.fromString("1"),
        price: BigDecimal.fromString("1"),
      };
    };

    const contractLookup: ContractNameLookup = (_tokenAddress: string): string => "FPIS";

    mockFpisFraxPair();

    const handler = new PriceHandlerUniswapV3(
      [ERC20_FPIS],
      LP_UNISWAP_V3_FPIS_FRAX,
      UNISWAP_V3_POSITION_MANAGER,
      contractLookup,
    );

    // Should return the price of FPIS
    const priceResult = handler.getPrice(ERC20_FPIS, stablecoinPriceLookup, BLOCK);
    assert.stringEquals(
      FPIS_RATE.toString(),
      priceResult ? priceResult.price.toString().slice(0, 13) : "",
    );
  });
});

describe("getTotalValue", () => {
  test("total value is correct", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: FPIS_RATE,
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return "FRAX";
      }

      return "FPIS";
    };

    mockFpisFraxPair();

    const handler = new PriceHandlerUniswapV3(
      [ERC20_FRAX, ERC20_FPIS],
      LP_UNISWAP_V3_FPIS_FRAX,
      UNISWAP_V3_POSITION_MANAGER,
      contractLookup,
    );

    // # FRAX + # FPIS * FPIS price
    const expectedValue = FRAX_BALANCE.plus(FPIS_BALANCE.times(FPIS_RATE));

    const totalValue = handler.getTotalValue([], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });

  test("total value is correct without token1", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: FPIS_RATE,
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return "FRAX";
      }

      return "FPIS";
    };

    mockFpisFraxPair();

    const handler = new PriceHandlerUniswapV3(
      [ERC20_FRAX, ERC20_FPIS],
      LP_UNISWAP_V3_FPIS_FRAX,
      UNISWAP_V3_POSITION_MANAGER,
      contractLookup,
    );

    // # FPIS * FPIS price
    const expectedValue = FPIS_BALANCE.times(FPIS_RATE);

    const totalValue = handler.getTotalValue([ERC20_FRAX], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });
});

describe("getUnitPrice", () => {
  test("unit price is correct", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: FPIS_RATE,
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_FRAX)) {
        return "FRAX";
      }

      return "FPIS";
    };

    mockFpisFraxPair();

    const handler = new PriceHandlerUniswapV3(
      [ERC20_FRAX, ERC20_FPIS],
      LP_UNISWAP_V3_FPIS_FRAX,
      UNISWAP_V3_POSITION_MANAGER,
      contractLookup,
    );

    // # FRAX + # FPIS * FPIS price
    const expectedValue = FRAX_BALANCE.plus(FPIS_BALANCE.times(FPIS_RATE));

    // We can't count the unit price of a V3 pool (no total supply), so total supply is 1 and total value = unit price
    const unitPrice = handler.getUnitPrice(priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), unitPrice ? unitPrice.toString() : "");
  });
});

describe("getUnderlyingTokenBalance", () => {
  test("underlying token balance is correct", () => {
    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_WETH)) {
        return "wETH";
      }

      return "OHM";
    };

    mockOhmWethPair();
    mockOhmWethPosition();

    const handler = new PriceHandlerUniswapV3([ERC20_OHM, ERC20_WETH], OHM_WETH_POOL, UNISWAP_V3_POSITION_MANAGER, contractLookup);

    const ohmBalance = handler.getUnderlyingTokenBalance(WALLET_ADDRESS, ERC20_OHM, BLOCK);
    const wethBalance = handler.getUnderlyingTokenBalance(WALLET_ADDRESS, ERC20_WETH, BLOCK);

    assert.stringEquals("138410.423", ohmBalance.truncate(4).toString());
    assert.stringEquals("866.7135", wethBalance.truncate(4).toString());
  });

  test("OHM-USDC balances are correct", () => {
    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_USDC)) {
        return "USDC";
      }

      return "OHM";
    };

    mockOhmUsdcPair();
    mockOhmUsdcPosition();

    const handler = new PriceHandlerUniswapV3([ERC20_OHM, ERC20_USDC], OHM_USDC_POOL, UNISWAP_V3_POSITION_MANAGER, contractLookup);

    const ohmBalance = handler.getUnderlyingTokenBalance(WALLET_ADDRESS, ERC20_OHM, BLOCK);
    const usdcBalance = handler.getUnderlyingTokenBalance(WALLET_ADDRESS, ERC20_USDC, BLOCK);

    assert.stringEquals("75484.2794", ohmBalance.truncate(4).toString());
    assert.stringEquals("445136.3419", usdcBalance.truncate(4).toString());
  });
});
