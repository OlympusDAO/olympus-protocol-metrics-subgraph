import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

import {
  ERC20_FXS,
  ERC20_OHM_V2,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_WETH,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  PAIR_UNISWAP_V2_TRIBE_ETH,
  PAIR_UNISWAP_V2_USDC_ETH,
  PAIR_UNISWAP_V3_FXS_ETH,
} from "../src/utils/Constants";
import { toDecimal } from "../src/utils/Decimals";

export const ETH_TRIBE_RESERVE_TRIBE = BigInt.fromString("40963255589554358793575");
export const ETH_TRIBE_RESERVE_ETH = BigInt.fromString("4956325030062526848");
export const ETH_TRIBE_RESERVE_BLOCK = BigInt.fromString("1654504965");

export const ETH_USD_RESERVE_USD = BigInt.fromString("51366826766840");
export const ETH_USD_RESERVE_ETH = BigInt.fromString("27063460795012214253805");
export const ETH_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");

export const OHM_USD_RESERVE_USD = BigInt.fromString("18867842715859452534935831");
export const OHM_USD_RESERVE_OHM = BigInt.fromString("994866147276819");
export const OHM_USD_RESERVE_BLOCK = BigInt.fromString("1654504965");
export const OHM_USD_DECIMALS = 18;
export const OHM_USD_TOTAL_SUPPLY = BigInt.fromString("132978245612511289049");

export const FXS_ETH_SLOT0_VALUE0 = BigInt.fromString("4408826845265778408963222405");
export const FXS_ETH_BALANCE_FXS = BigInt.fromString("58490501064965941270938");
export const FXS_ETH_BALANCE_ETH = BigInt.fromString("50384750611936405873");

export const OHM_V2_DECIMALS = 9;
export const USDC_DECIMALS = 6;
export const ERC20_STANDARD_DECIMALS = 18;

/**
 * 1898.01397375
 *
 * @returns
 */
export const getEthUsdRate = (): BigDecimal => {
  return toDecimal(ETH_USD_RESERVE_USD, 6).div(toDecimal(ETH_USD_RESERVE_ETH, 18));
};

export const mockEthUsdRate = (): void => {
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
export const getTribeUsdRate = (): BigDecimal => {
  return toDecimal(ETH_TRIBE_RESERVE_ETH, 18)
    .times(getEthUsdRate())
    .div(toDecimal(ETH_TRIBE_RESERVE_TRIBE, 18));
};

export const mockTribeEthRate = (): void => {
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
 * FXS in ETH * price ETH / 2^192 = price FXS (in USD)
 *
 *
 *
 * @returns
 */
export const getFxsUsdRate = (): BigDecimal => {
  return FXS_ETH_SLOT0_VALUE0.times(FXS_ETH_SLOT0_VALUE0)
    .toBigDecimal()
    .times(getEthUsdRate())
    .div(BigInt.fromString("2").pow(192).toBigDecimal());
};

export const mockFxsEthRate = (): void => {
  const contractAddress = Address.fromString(PAIR_UNISWAP_V3_FXS_ETH);
  // slot0
  createMockedFunction(
    contractAddress,
    "slot0",
    "slot0():(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(FXS_ETH_SLOT0_VALUE0),
    ethereum.Value.fromI32(-57778),
    ethereum.Value.fromI32(1),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(0),
    ethereum.Value.fromBoolean(true),
  ]);

  // Tokens
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_FXS)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_WETH)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(ERC20_FXS), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);

  // Balance
  createMockedFunction(Address.fromString(ERC20_FXS), "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(contractAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(FXS_ETH_BALANCE_FXS)]);
  createMockedFunction(Address.fromString(ERC20_WETH), "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(contractAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(FXS_ETH_BALANCE_ETH)]);
};

/**
 * 18.9652073
 *
 * @returns
 */
export const getOhmUsdRate = (): BigDecimal => {
  return toDecimal(OHM_USD_RESERVE_USD, 18).div(toDecimal(OHM_USD_RESERVE_OHM, 9));
};

export const mockUsdOhmRate = (): void => {
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
  // Decimals
  createMockedFunction(contractAddress, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(OHM_USD_DECIMALS),
  ]);
  // Total supply
  createMockedFunction(contractAddress, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(OHM_USD_TOTAL_SUPPLY),
  ]);

  // Token addresses
  createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_OHM_V2)),
  ]);
  createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_DAI)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(ERC20_OHM_V2), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(OHM_V2_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const OHM_ETH_RESERVES_OHM = BigInt.fromString("375628431674251");
export const OHM_ETH_RESERVES_ETH = BigInt.fromString("3697970940599119381327");
export const OHM_ETH_TOTAL_SUPPLY = BigInt.fromString("1088609680068180654");
export const OHM_ETH_DECIMALS = 18;

export const mockOhmEthPair = (): void => {
  // Pair
  const pairAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_ETH_V2);
  createMockedFunction(pairAddress, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_OHM_V2)),
  ]);
  createMockedFunction(pairAddress, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_WETH)),
  ]);
  // Token Decimals
  createMockedFunction(Address.fromString(ERC20_OHM_V2), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(OHM_V2_DECIMALS),
  ]);
  createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
  // Reserves
  createMockedFunction(
    pairAddress,
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(OHM_ETH_RESERVES_OHM),
    ethereum.Value.fromUnsignedBigInt(OHM_ETH_RESERVES_ETH),
    ethereum.Value.fromUnsignedBigInt(ETH_USD_RESERVE_BLOCK),
  ]);
  // Decimals
  createMockedFunction(pairAddress, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(OHM_ETH_DECIMALS),
  ]);
  // Total supply
  createMockedFunction(pairAddress, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(OHM_ETH_TOTAL_SUPPLY),
  ]);
};

// (token0 * price0 + token1 * price1) * (balance / total supply)
export const getOhmEthPairValue = (): BigDecimal => {
  return toDecimal(OHM_ETH_RESERVES_OHM, OHM_V2_DECIMALS)
    .times(getOhmUsdRate())
    .plus(toDecimal(OHM_ETH_RESERVES_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
};
