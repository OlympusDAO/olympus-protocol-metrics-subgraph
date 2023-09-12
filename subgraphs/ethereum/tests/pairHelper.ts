import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction, log } from "matchstick-as";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { DAO_WALLET } from "../../shared/src/Wallets";
import {
  AURA_REWARDS_CONTRACTS,
  AURA_STAKING_AURA_BAL,
  AURA_STAKING_OHM_DAI,
  AURA_STAKING_OHM_DAI_WETH,
  AURA_STAKING_OHM_WETH,
  AURA_STAKING_OHM_WSTETH,
  BALANCER_LIQUIDITY_GAUGE_OHM_DAI,
  BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH,
  BALANCER_LIQUIDITY_GAUGE_OHM_WETH,
  BALANCER_LIQUIDITY_GAUGE_OHM_WSTETH,
  BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
  BALANCER_LIQUIDITY_GAUGES,
  BALANCER_VAULT,
  CONVEX_ALLOCATORS,
  CONVEX_STAKING_CONTRACTS,
  ERC20_AURA,
  ERC20_AURA_BAL,
  ERC20_AURA_GRAVI,
  ERC20_AURA_VL,
  ERC20_BALANCER_AURA_WETH,
  ERC20_BALANCER_GRAVIAURA_AURABAL_WETH,
  ERC20_BALANCER_OHM_BTRFLY_V2,
  ERC20_BALANCER_OHM_DAI,
  ERC20_BALANCER_OHM_DAI_AURA,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_BALANCER_OHM_DAI_WETH_AURA,
  ERC20_BALANCER_OHM_WETH,
  ERC20_BALANCER_OHM_WETH_AURA,
  ERC20_BALANCER_OHM_WSTETH,
  ERC20_BALANCER_OHM_WSTETH_AURA,
  ERC20_BALANCER_WETH_FDT,
  ERC20_BTRFLY_V1,
  ERC20_BTRFLY_V2,
  ERC20_CRV_FRAX_USDC,
  ERC20_CRV_OHMETH,
  ERC20_CRV_OHMFRAXBP,
  ERC20_CVX_FRAX_3CRV,
  ERC20_CVX_FRAX_USDC_STAKED,
  ERC20_CVX_OHMETH,
  ERC20_DAI,
  ERC20_FDT,
  ERC20_FEI,
  ERC20_FPIS,
  ERC20_FRAX,
  ERC20_FRAX_3CRV,
  ERC20_FRAX_BP,
  ERC20_FXS,
  ERC20_LQTY,
  ERC20_LUSD,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_TOKE,
  ERC20_TRIBE,
  ERC20_USDC,
  ERC20_WETH,
  ERC20_WSTETH,
  FRAX_LOCKING_CONTRACTS,
  getContractName,
  getWalletAddressesForContract,
  LQTY_STAKING,
  PAIR_CURVE_FRAX_USDC,
  PAIR_CURVE_OHM_ETH,
  PAIR_CURVE_OHM_FRAXBP,
  PAIR_FRAXSWAP_V1_OHM_FRAX,
  PAIR_FRAXSWAP_V2_OHM_FRAX,
  PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
  PAIR_UNISWAP_V2_OHM_DAI,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
  PAIR_UNISWAP_V2_OHM_ETH,
  PAIR_UNISWAP_V2_OHM_ETH_V2,
  PAIR_UNISWAP_V2_OHM_LUSD,
  PAIR_UNISWAP_V2_OHM_LUSD_V2,
  PAIR_UNISWAP_V2_TRIBE_ETH,
  PAIR_UNISWAP_V2_USDC_ETH,
  PAIR_UNISWAP_V3_3CRV_USD,
  PAIR_UNISWAP_V3_FEI_USDC,
  PAIR_UNISWAP_V3_FPIS_FRAX,
  PAIR_UNISWAP_V3_FXS_ETH,
  PAIR_UNISWAP_V3_LQTY_LUSD,
  PAIR_UNISWAP_V3_LQTY_WETH,
  PAIR_UNISWAP_V3_LUSD_USDC,
  PAIR_UNISWAP_V3_WETH_BTRFLY_V1,
  PAIR_UNISWAP_V3_WETH_BTRFLY_V2,
  PAIR_UNISWAP_V3_WETH_OHM,
  POOL_BALANCER_AURA_WETH_ID,
  POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID,
  POOL_BALANCER_OHM_DAI,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
  POOL_BALANCER_OHM_WETH,
  POOL_BALANCER_OHM_WSTETH_ID,
  POOL_BALANCER_WETH_FDT_ID,
  TOKE_STAKING,
} from "../src/utils/Constants";
import { mockPriceFeed, mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20TotalSupply } from "./erc20Helper";
import { mockZeroWalletBalances } from "./walletHelper";

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

export const OHM_DAI_ETH_BALANCE_OHM = BigDecimal.fromString("221499.733846818");
export const OHM_DAI_ETH_BALANCE_DAI = BigDecimal.fromString("1932155.145566782258916959");
export const OHM_DAI_ETH_BALANCE_WETH = BigDecimal.fromString("1080.264364629190826870");
export const OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY = BigDecimal.fromString("100");
export const OHM_DAI_ETH_WEIGHT_OHM = BigDecimal.fromString("0.5");
export const OHM_DAI_ETH_WEIGHT_DAI = BigDecimal.fromString("0.25");
export const OHM_DAI_ETH_WEIGHT_WETH = BigDecimal.fromString("0.25");

export const OHM_V2_DECIMALS = 9;
export const USDC_DECIMALS = 6;

const DEFAULT_TOTAL_SUPPLY = BigDecimal.fromString("0");

export const getERC20UsdRate = (
  token0Reserve: BigInt,
  token1Reserve: BigInt,
  token0Rate: BigDecimal,
): BigDecimal => {
  return toDecimal(token0Reserve, 18).times(token0Rate).div(toDecimal(token1Reserve, 18));
};

/**
 * 1898.01397375
 *
 * @returns
 */
export const getEthUsdRate = (): BigDecimal => {
  return toDecimal(ETH_USD_RESERVE_USD, 6).div(toDecimal(ETH_USD_RESERVE_ETH, 18));
};

export const ETH_PRICE = "1898.01397374"

export const mockEthUsdRate = (): void => {
  mockPriceFeed(ERC20_WETH, BigDecimal.fromString(ETH_PRICE));
};

export const mockUniswapV2EthUsdRate = (): void => {
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

}

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
  // TODO can be shifted to abstracted mock function?
  mockERC20TotalSupply(ERC20_TRIBE, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));
  mockERC20TotalSupply(ERC20_WETH, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

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

export const getUsdRateUniswapV3 = (slot0Value: BigInt, usdRate: BigDecimal): BigDecimal => {
  return slot0Value
    .times(slot0Value)
    .toBigDecimal()
    .times(usdRate)
    .div(BigInt.fromString("2").pow(192).toBigDecimal());
};

/**
 * FXS in ETH * price ETH / 2^192 = price FXS (in USD)
 *
 * @returns
 */
export const getFxsUsdRate = (): BigDecimal => {
  return getUsdRateUniswapV3(FXS_ETH_SLOT0_VALUE0, getEthUsdRate());
};

export const mockRateUniswapV3 = (
  pairAddress: string,
  slot0Value: BigInt,
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Balance: BigInt,
  token1Balance: BigInt,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  shouldRevert: boolean = false,
): void => {
  log.info("Mocking rate for UniswapV3 pair {}", [pairAddress]);
  mockERC20TotalSupply(token0Address, token0Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token0Decimals));
  mockERC20TotalSupply(token1Address, token1Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token1Decimals));

  const contractAddress = Address.fromString(pairAddress);
  // slot0
  createMockedFunction(
    contractAddress,
    "slot0",
    "slot0():(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(slot0Value),
    ethereum.Value.fromI32(-57778),
    ethereum.Value.fromI32(1),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(2),
    ethereum.Value.fromI32(0),
    ethereum.Value.fromBoolean(true),
  ]);

  // Tokens
  if (shouldRevert) {
    createMockedFunction(contractAddress, "token0", "token0():(address)").reverts();
  }
  else {
    createMockedFunction(contractAddress, "token0", "token0():(address)").returns([
      ethereum.Value.fromAddress(Address.fromString(token0Address)),
    ]);
  }

  if (shouldRevert) {
    createMockedFunction(contractAddress, "token1", "token1():(address)").reverts();
  }
  else {
    createMockedFunction(contractAddress, "token1", "token1():(address)").returns([
      ethereum.Value.fromAddress(Address.fromString(token1Address)),
    ]);
  }

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

export const mockUniswapV3PairsZero = (): void => {
  mockRateUniswapV3(PAIR_UNISWAP_V3_3CRV_USD, BigInt.zero(), ERC20_FRAX_3CRV, ERC20_USDC, ERC20_STANDARD_DECIMALS, USDC_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_FEI_USDC, BigInt.zero(), ERC20_FEI, ERC20_USDC, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_FPIS_FRAX, BigInt.zero(), ERC20_FPIS, ERC20_FRAX, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_FXS_ETH, BigInt.zero(), ERC20_FXS, ERC20_WETH, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_LQTY_LUSD, BigInt.zero(), ERC20_LQTY, ERC20_LUSD, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_LQTY_WETH, BigInt.zero(), ERC20_LQTY, ERC20_WETH, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_LUSD_USDC, BigInt.zero(), ERC20_LUSD, ERC20_USDC, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_WETH_BTRFLY_V1, BigInt.zero(), ERC20_WETH, ERC20_BTRFLY_V1, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_WETH_BTRFLY_V2, BigInt.zero(), ERC20_WETH, ERC20_BTRFLY_V2, ERC20_STANDARD_DECIMALS, ERC20_STANDARD_DECIMALS, BigInt.zero(), BigInt.zero(), true);
  mockRateUniswapV3(PAIR_UNISWAP_V3_WETH_OHM, BigInt.zero(), ERC20_WETH, ERC20_OHM_V2, ERC20_STANDARD_DECIMALS, OHM_V2_DECIMALS, BigInt.zero(), BigInt.zero(), true);
}

export const mockFxsEthRate = (): void => {
  mockRateUniswapV3(
    PAIR_UNISWAP_V3_FXS_ETH,
    FXS_ETH_SLOT0_VALUE0,
    ERC20_FXS,
    ERC20_WETH,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    FXS_ETH_BALANCE_FXS,
    FXS_ETH_BALANCE_ETH,
  );

  mockStablecoinsPriceFeeds();
};

export const OHM_BTRFLY_V1_SLOT0 = "18438610691616111025325107";

export const mockWEthBtrflyV1Rate = (): void => {
  // price = 35.0430729991629573703709430194278
  mockRateUniswapV3(
    PAIR_UNISWAP_V3_WETH_BTRFLY_V1,
    BigInt.fromString(OHM_BTRFLY_V1_SLOT0),
    ERC20_WETH,
    ERC20_BTRFLY_V1,
    ERC20_STANDARD_DECIMALS,
    9, // BTRFLY V1 is 9
    BigInt.zero(),
    BigInt.zero(),
  );
};

export const getBtrflyV1UsdRate = (): BigDecimal => {
  return BigDecimal.fromString("35.0430729991629573703709430194278");
};

export const OHM_BTRFLY_V2_SLOT0 = "201047635549140265156647342605";

export const mockWEthBtrflyV2Rate = (): void => {
  // price = 294.7546283139931202627807530029295
  mockRateUniswapV3(
    PAIR_UNISWAP_V3_WETH_BTRFLY_V2,
    BigInt.fromString(OHM_BTRFLY_V2_SLOT0),
    ERC20_WETH,
    ERC20_BTRFLY_V2,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.zero(),
    BigInt.zero(),
  );
};

export const getBtrflyV2UsdRate = (): BigDecimal => {
  return BigDecimal.fromString("294.7546283139931202627807530029295");
};

/**
 * 18.9652073
 *
 * @returns
 */
export const getOhmUsdRate = (): BigDecimal => {
  return toDecimal(OHM_USD_RESERVE_USD, 18).div(toDecimal(OHM_USD_RESERVE_OHM, 9));
};

export const mockUsdOhmV2Rate = (
  ohmReserves: BigInt = OHM_USD_RESERVE_OHM,
  usdReserves: BigInt = OHM_USD_RESERVE_USD,
): void => {
  log.info("Mocking rate for UniswapV2 pair {}: OHM {}, USD: {}", [PAIR_UNISWAP_V2_OHM_DAI_V2, toDecimal(ohmReserves, 9).toString(), toDecimal(usdReserves, 18).toString()]);

  const contractAddress = Address.fromString(PAIR_UNISWAP_V2_OHM_DAI_V2);
  createMockedFunction(
    contractAddress,
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(ohmReserves),
    ethereum.Value.fromUnsignedBigInt(usdReserves),
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

  mockStablecoinsPriceFeeds();
};

export const mockConvexStakedBalance = (
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "stakingToken", "stakingToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(allocatorAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockConvexStakedBalanceZero = (allocators: string[] = CONVEX_ALLOCATORS): void => {
  for (let i = 0; i < allocators.length; i++) {
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      mockConvexStakedBalance(
        ERC20_CVX_FRAX_3CRV,
        allocators[i],
        CONVEX_STAKING_CONTRACTS[j],
        BigInt.zero(),
      );
      mockConvexStakedBalance(
        ERC20_CVX_OHMETH,
        allocators[i],
        CONVEX_STAKING_CONTRACTS[j],
        BigInt.zero(),
      );
    }
  }
};

export const mockFraxLockedBalance = (
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "stakingToken", "stakingToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "lockedLiquidityOf", "lockedLiquidityOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(allocatorAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockFraxLockedBalanceZero = (allocators: string[] = CONVEX_ALLOCATORS): void => {
  for (let i = 0; i < allocators.length; i++) {
    for (let j = 0; j < FRAX_LOCKING_CONTRACTS.length; j++) {
      mockFraxLockedBalance(
        ERC20_CVX_FRAX_USDC_STAKED,
        allocators[i],
        FRAX_LOCKING_CONTRACTS[j],
        BigInt.zero(),
      );
    }
  }
};

export const mockTokeStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "tokeToken", "tokeToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockTokeStakedBalanceZero = (wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    mockTokeStakedBalance(ERC20_TOKE, wallets[i], TOKE_STAKING, BigInt.zero());
  }
};

export const mockLiquityStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "lqtyToken", "lqtyToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "stakes", "stakes(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockLiquityStakedBalanceZero = (wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    mockLiquityStakedBalance(ERC20_LQTY, wallets[i], LQTY_STAKING, BigInt.zero());
  }
};

export const mockBalancerGaugeBalance = (
  tokenAddress: string,
  walletAddress: string,
  gaugeBalance: string,
  balance: BigInt,
  tokenTotalSupply: BigDecimal = DEFAULT_TOTAL_SUPPLY,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(tokenTotalSupply, ERC20_STANDARD_DECIMALS));

  const gaugeContractAddress = Address.fromString(gaugeBalance);
  // Returns token
  createMockedFunction(gaugeContractAddress, "lp_token", "lp_token():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(gaugeContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockBalancerGaugeBalanceZero = (wallets_: string[]): void => {
  const wallets = wallets_.slice(0);
  wallets.push(DAO_WALLET);

  for (let i = 0; i < wallets.length; i++) {
    mockBalancerGaugeBalance(
      ERC20_BALANCER_WETH_FDT,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      BigInt.zero(),
    );

    mockBalancerGaugeBalance(
      ERC20_BALANCER_OHM_DAI,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_OHM_DAI,
      BigInt.zero(),
    );

    mockBalancerGaugeBalance(
      ERC20_BALANCER_OHM_WETH,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_OHM_WETH,
      BigInt.zero(),
    );

    mockBalancerGaugeBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH,
      BigInt.zero(),
    );

    mockBalancerGaugeBalance(
      ERC20_BALANCER_OHM_WSTETH,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_OHM_WSTETH,
      BigInt.zero(),
    );
  }
};

export const mockAuraStakedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  mockERC20TotalSupply(tokenAddress, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "stakingToken", "stakingToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "balanceOf", "balanceOf(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // We assume price lookup is handled

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockAuraStakedBalanceZero = (wallets: string[]): void => {
  const stakingPairs: string[][] = [
    [ERC20_BALANCER_OHM_DAI_WETH_AURA, AURA_STAKING_OHM_DAI_WETH],
    [ERC20_BALANCER_OHM_WETH_AURA, AURA_STAKING_OHM_WETH],
    [ERC20_BALANCER_OHM_DAI_AURA, AURA_STAKING_OHM_DAI],
    [ERC20_BALANCER_OHM_WSTETH_AURA, AURA_STAKING_OHM_WSTETH],
    [ERC20_AURA_BAL, AURA_STAKING_AURA_BAL],
  ];

  for (let i = 0; i < stakingPairs.length; i++) {
    const stakedToken = stakingPairs[i][0];
    const stakingContract = stakingPairs[i][1];
    const stakingTokenWallets = getWalletAddressesForContract(stakedToken);
    for (let j = 0; j < stakingTokenWallets.length; j++) {
      mockAuraStakedBalance(
        stakedToken,
        stakingTokenWallets[j],
        stakingContract,
        BigInt.zero(),
      );
    }
  }
};

export const mockAuraLockedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "stakingToken", "stakingToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  const lockDataArray: Array<ethereum.Value> = [
    ethereum.Value.fromI32(0),
    ethereum.Value.fromI32(0),
    ethereum.Value.fromI32(0),
  ];
  const lockData = changetype<ethereum.Tuple>(lockDataArray);

  // Returns balance
  createMockedFunction(stakingContractAddress, "lockedBalances", "lockedBalances(address):(uint256,uint256,uint256,(uint112,uint32)[])")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance), ethereum.Value.fromUnsignedBigInt(BigInt.zero()), ethereum.Value.fromUnsignedBigInt(BigInt.zero()), ethereum.Value.fromTupleArray([lockData])]);

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockAuraLockedBalanceZero = (wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    mockAuraLockedBalance(
      ERC20_AURA,
      wallets[i],
      ERC20_AURA_VL,
      BigInt.zero(),
    );
  }
};

export const mockAuraEarnedBalance = (
  tokenAddress: string,
  walletAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
  const stakingContractAddress = Address.fromString(stakingAddress);
  // Returns token
  createMockedFunction(stakingContractAddress, "rewardToken", "rewardToken():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(tokenAddress)),
  ]);

  // Returns balance
  createMockedFunction(stakingContractAddress, "earned", "earned(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(Address.fromString(walletAddress))])
    .returns([ethereum.Value.fromUnsignedBigInt(balance)]);

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
  ]);
};

export const mockAuraEarnedBalanceZero = (rewardToken: string, wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    for (let j = 0; j < AURA_REWARDS_CONTRACTS.length; j++) {
      mockAuraEarnedBalance(
        rewardToken,
        wallets[i],
        AURA_REWARDS_CONTRACTS[j],
        BigInt.zero(),
      );
    }
  }
};

export const mockUniswapV2Pair = (
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Reserves: BigInt,
  token1Reserves: BigInt,
  totalSupply: BigInt,
  pairAddress: string,
  pairDecimals: i32,
  block: BigInt = OHM_USD_RESERVE_BLOCK,
): void => {
  mockERC20TotalSupply(token0Address, token0Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token0Decimals));
  mockERC20TotalSupply(token1Address, token1Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token1Decimals));

  const pair = Address.fromString(pairAddress);
  createMockedFunction(pair, "getReserves", "getReserves():(uint112,uint112,uint32)").returns([
    ethereum.Value.fromUnsignedBigInt(token0Reserves),
    ethereum.Value.fromUnsignedBigInt(token1Reserves),
    ethereum.Value.fromUnsignedBigInt(block),
  ]);
  // Decimals
  createMockedFunction(pair, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(pairDecimals),
  ]);
  // Total supply
  createMockedFunction(pair, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(totalSupply),
  ]);

  // Token addresses
  createMockedFunction(pair, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token0Address)),
  ]);
  createMockedFunction(pair, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token1Address)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(token0Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token0Decimals)],
  );
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );
};

export const mockUniswapV2PairsZero = (): void => {
  // For all entries in LIQUIDITY_OWNED
  mockUniswapV2Pair(
    ERC20_USDC,
    ERC20_WETH,
    USDC_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_USDC_ETH,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_USDC_ETH,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_USDC_ETH),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V2,
    ERC20_DAI,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_DAI_V2,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_DAI_V2,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI_V2),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V1,
    ERC20_DAI,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_DAI,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_DAI,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_DAI),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V2,
    ERC20_WETH,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_ETH_V2,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_ETH_V2,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_ETH_V2),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V1,
    ERC20_WETH,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_ETH,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_ETH,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_ETH),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V2,
    ERC20_LUSD,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_LUSD_V2,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_LUSD_V2,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_LUSD_V2),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V1,
    ERC20_LUSD,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_LUSD,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_LUSD,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_LUSD),
  );

  mockUniswapV2Pair(
    ERC20_OHM_V2,
    ERC20_BTRFLY_V1,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    BigInt.fromString("1"),
    PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
    ERC20_STANDARD_DECIMALS,
  );
  mockZeroWalletBalances(
    PAIR_UNISWAP_V2_OHM_BTRFLY_V1,
    getWalletAddressesForContract(PAIR_UNISWAP_V2_OHM_BTRFLY_V1),
  );
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

export const getPairValue = (
  token0Reserves: BigDecimal,
  token1Reserves: BigDecimal,
  token0Rate: BigDecimal,
  token1Rate: BigDecimal,
): BigDecimal => {
  return token0Reserves.times(token0Rate).plus(token1Reserves.times(token1Rate));
};

// (token0 * price0 + token1 * price1) * (balance / total supply)
export const getOhmEthPairValue = (): BigDecimal => {
  return toDecimal(OHM_ETH_RESERVES_OHM, OHM_V2_DECIMALS)
    .times(getOhmUsdRate())
    .plus(toDecimal(OHM_ETH_RESERVES_ETH, ERC20_STANDARD_DECIMALS).times(getEthUsdRate()));
};

export const mockCurvePairTotalValue = (
  pairAddress: string,
  pairToken: string,
  pairTokenDecimals: i32,
  pairTokenTotalSupply: BigDecimal,
  token0: string,
  token1: string,
  token0Balance: BigInt,
  token1Balance: BigInt,
  token0Decimals: i32,
  token1Decimals: i32,
): void => {
  mockERC20TotalSupply(token0, token0Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token0Decimals));
  mockERC20TotalSupply(token1, token1Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token1Decimals));

  const pair = Address.fromString(pairAddress);
  // Token lookup
  createMockedFunction(pair, "coins", "coins(uint256):(address)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([ethereum.Value.fromAddress(Address.fromString(token0))]);
  createMockedFunction(pair, "coins", "coins(uint256):(address)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
    .returns([ethereum.Value.fromAddress(Address.fromString(token1))]);
  // Token balance
  createMockedFunction(pair, "balances", "balances(uint256):(uint256)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([ethereum.Value.fromUnsignedBigInt(token0Balance)]);
  createMockedFunction(pair, "balances", "balances(uint256):(uint256)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
    .returns([ethereum.Value.fromUnsignedBigInt(token1Balance)]);
  // Token decimals
  createMockedFunction(Address.fromString(token0), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(token0Decimals),
  ]);
  createMockedFunction(Address.fromString(token1), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(token1Decimals),
  ]);
  // Pair token
  createMockedFunction(pair, "token", "token():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(pairToken)),
  ]);
  // Pair token (for some contracts)
  createMockedFunction(pair, "lp_token", "lp_token():(address)").reverts();
  createMockedFunction(Address.fromString(pairToken), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(pairTokenDecimals),
  ]);
  createMockedFunction(
    Address.fromString(pairToken),
    "totalSupply",
    "totalSupply():(uint256)",
  ).returns([ethereum.Value.fromUnsignedBigInt(toBigInt(pairTokenTotalSupply, pairTokenDecimals))]);
};

export const mockCurvePairZero = (): void => {
  mockCurvePairTotalValue(
    PAIR_CURVE_OHM_ETH,
    ERC20_CRV_OHMETH,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_WETH,
    BigInt.fromString("0"),
    BigInt.fromString("0"),
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
  );

  mockCurvePairTotalValue(
    PAIR_CURVE_OHM_FRAXBP,
    ERC20_CRV_OHMFRAXBP,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_FRAX_BP,
    BigInt.fromString("0"),
    BigInt.fromString("0"),
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
  );

  mockCurvePairTotalValue(
    PAIR_CURVE_FRAX_USDC,
    ERC20_CRV_FRAX_USDC,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_FRAX,
    ERC20_USDC,
    BigInt.fromString("0"),
    BigInt.fromString("0"),
    ERC20_STANDARD_DECIMALS,
    USDC_DECIMALS,
  );

  mockZeroWalletBalances(ERC20_CRV_OHMETH, getWalletAddressesForContract(PAIR_CURVE_OHM_ETH));
  mockZeroWalletBalances(ERC20_CRV_OHMETH, CONVEX_ALLOCATORS);
  mockZeroWalletBalances(ERC20_CRV_OHMFRAXBP, getWalletAddressesForContract(PAIR_CURVE_OHM_FRAXBP));
  mockZeroWalletBalances(ERC20_CRV_FRAX_USDC, getWalletAddressesForContract(PAIR_CURVE_FRAX_USDC));
};

export function mockBalancerVault(
  vaultAddress: string,
  poolId: string,
  poolTokenAddress: string,
  poolTokenDecimals: i32,
  poolTokenTotalSupply: BigDecimal,
  token1Address: string,
  token2Address: string,
  token3Address: string | null,
  token1Balance: BigDecimal,
  token2Balance: BigDecimal,
  token3Balance: BigDecimal | null,
  token1Decimals: i32,
  token2Decimals: i32,
  token3Decimals: i32,
  token1Weight: BigDecimal,
  token2Weight: BigDecimal,
  token3Weight: BigDecimal | null,
): void {
  mockERC20TotalSupply(token1Address, token1Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token1Decimals));
  mockERC20TotalSupply(token2Address, token2Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token2Decimals));
  if (token3Address !== null) {
    mockERC20TotalSupply(token3Address, token3Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token3Decimals));
  }

  log.debug("Mocking Balancer pool id {} ({}) with token supply {}", [getContractName(poolId), poolId, poolTokenTotalSupply.toString()]);
  const tokenAddressArray = [Address.fromString(token1Address), Address.fromString(token2Address)];
  if (token3Address !== null) tokenAddressArray.push(Address.fromString(token3Address));

  const tokenBalanceArray = [
    toBigInt(token1Balance, token1Decimals),
    toBigInt(token2Balance, token2Decimals),
  ];
  if (token3Balance !== null) tokenBalanceArray.push(toBigInt(token3Balance, token3Decimals));

  // getPoolTokens
  createMockedFunction(
    Address.fromString(vaultAddress),
    "getPoolTokens",
    "getPoolTokens(bytes32):(address[],uint256[],uint256)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddressArray(tokenAddressArray),
      ethereum.Value.fromUnsignedBigIntArray(tokenBalanceArray),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("14936424")),
    ]);

  // getPool
  createMockedFunction(
    Address.fromString(vaultAddress),
    "getPool",
    "getPool(bytes32):(address,uint8)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddress(Address.fromString(poolTokenAddress)),
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ]);
  // Pool token
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "decimals",
    "decimals():(uint8)",
  ).returns([ethereum.Value.fromI32(poolTokenDecimals)]);
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "totalSupply",
    "totalSupply():(uint256)",
  ).returns([ethereum.Value.fromUnsignedBigInt(toBigInt(poolTokenTotalSupply, poolTokenDecimals))]);

  // Token Decimals
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );
  createMockedFunction(Address.fromString(token2Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token2Decimals)],
  );
  if (token3Address !== null) {
    createMockedFunction(
      Address.fromString(token3Address),
      "decimals",
      "decimals():(uint8)",
    ).returns([ethereum.Value.fromI32(token3Decimals)]);
  }

  // Token weighting
  const tokenWeightArray = [
    toBigInt(token1Weight, poolTokenDecimals),
    toBigInt(token2Weight, poolTokenDecimals),
  ];
  if (token3Weight !== null) tokenWeightArray.push(toBigInt(token3Weight, poolTokenDecimals));
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "getNormalizedWeights",
    "getNormalizedWeights():(uint256[])",
  ).returns([ethereum.Value.fromUnsignedBigIntArray(tokenWeightArray)]);
}

export function mockBalancerVaultZero(): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_DAI_WETH_ID,
    ERC20_BALANCER_OHM_DAI_WETH,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_DAI,
    ERC20_WETH,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.25"),
    BigDecimal.fromString("0.25"),
  );

  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_WETH_FDT_ID,
    ERC20_BALANCER_WETH_FDT,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_WETH,
    ERC20_FDT,
    null,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    null,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.8"),
    BigDecimal.fromString("0.2"),
    null,
  );

  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
    ERC20_BALANCER_OHM_BTRFLY_V2,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_BTRFLY_V2,
    null,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    null,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  );

  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_DAI,
    ERC20_BALANCER_OHM_DAI,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_DAI,
    null,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    null,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  )

  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_WETH,
    ERC20_BALANCER_OHM_WETH,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_WETH,
    null,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    null,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  )

  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_WSTETH_ID,
    ERC20_BALANCER_OHM_WSTETH,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0"),
    ERC20_OHM_V2,
    ERC20_WSTETH,
    null,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
    null,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  )

  mockERC20TotalSupply(ERC20_BALANCER_OHM_DAI_WETH_AURA, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

  mockBalancerGaugeBalanceZero(getWalletAddressesForContract(""));
  mockAuraStakedBalanceZero(getWalletAddressesForContract(""));
}

export function mockBalancerVaultOhmDaiEth(
  totalSupply: BigDecimal = OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY,
  ohmBalance: BigDecimal = OHM_DAI_ETH_BALANCE_OHM,
  daiBalance: BigDecimal = OHM_DAI_ETH_BALANCE_DAI,
  wEthBalance: BigDecimal = OHM_DAI_ETH_BALANCE_WETH,
  ohmWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_OHM,
  daiWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_DAI,
  wEthWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_WETH,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_DAI_WETH_ID,
    ERC20_BALANCER_OHM_DAI_WETH,
    ERC20_STANDARD_DECIMALS,
    totalSupply,
    ERC20_OHM_V2,
    ERC20_DAI,
    ERC20_WETH,
    ohmBalance,
    daiBalance,
    wEthBalance,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ohmWeight,
    daiWeight,
    wEthWeight,
  );
}

const WETH_FDT_BALANCE_WETH = toDecimal(
  BigInt.fromString("55282519432649791614"),
  ERC20_STANDARD_DECIMALS,
);
const WETH_FDT_BALANCE_FDT = toDecimal(
  BigInt.fromString("17066065377014702525776132"),
  ERC20_STANDARD_DECIMALS,
);
export function mockBalancerVaultWethFdt(
  wethBalance: BigDecimal = WETH_FDT_BALANCE_WETH,
  fdtBalance: BigDecimal = WETH_FDT_BALANCE_FDT,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_WETH_FDT_ID,
    ERC20_BALANCER_WETH_FDT,
    ERC20_STANDARD_DECIMALS,
    toDecimal(BigInt.fromString("2669094096479295381363690"), ERC20_STANDARD_DECIMALS),
    ERC20_WETH,
    ERC20_FDT,
    null,
    wethBalance,
    fdtBalance,
    null,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.2"),
    BigDecimal.fromString("0.8"),
    null,
  );
}

export const POOL_AURABAL_WETH_BALANCE_AURABAL = toDecimal(BigInt.fromString("4789103758014220845986"), 18);
export const POOL_AURABAL_WETH_BALANCE_GRAVIAURA = toDecimal(BigInt.fromString("35760622390726206299930"), 18);
export const POOL_AURABAL_WETH_BALANCE_WETH = toDecimal(BigInt.fromString("51484525313020258856"), 18);

export function mockBalancerVaultGraviAuraBalWeth(
  auraBalBalance: BigDecimal = POOL_AURABAL_WETH_BALANCE_AURABAL,
  graviAuraBalance: BigDecimal = POOL_AURABAL_WETH_BALANCE_GRAVIAURA,
  wethBalance: BigDecimal = POOL_AURABAL_WETH_BALANCE_WETH,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID,
    ERC20_BALANCER_GRAVIAURA_AURABAL_WETH,
    ERC20_STANDARD_DECIMALS,
    toDecimal(BigInt.fromString("5676269785389456574276"), ERC20_STANDARD_DECIMALS),
    ERC20_AURA_BAL,
    ERC20_AURA_GRAVI,
    ERC20_WETH,
    auraBalBalance,
    graviAuraBalance,
    wethBalance,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.3333"),
    BigDecimal.fromString("0.3334"),
    BigDecimal.fromString("0.3333"),
  );
}

export function mockBalancerVaultAuraWeth(
  auraBalance: BigDecimal = POOL_AURABAL_WETH_BALANCE_AURABAL,
  wethBalance: BigDecimal = POOL_AURABAL_WETH_BALANCE_WETH,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_AURA_WETH_ID,
    ERC20_BALANCER_AURA_WETH,
    ERC20_STANDARD_DECIMALS,
    toDecimal(BigInt.fromString("5676269785389456574276"), ERC20_STANDARD_DECIMALS),
    ERC20_WETH,
    ERC20_AURA,
    null,
    wethBalance,
    auraBalance,
    null,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  );
}

export const OHM_BTRFLY_BALANCE_OHM = toDecimal(
  BigInt.fromString("75921860983195"),
  OHM_V2_DECIMALS,
);
export const OHM_BTRFLY_BALANCE_BTRFLY = toDecimal(
  BigInt.fromString("3912455650447516493890"),
  ERC20_STANDARD_DECIMALS,
);
export const OHM_BTRFLY_TOTAL_SUPPLY = toDecimal(
  BigInt.fromString("34449175006332125035810"),
  ERC20_STANDARD_DECIMALS,
);

export function mockBalancerVaultOhmBtrfly(
  ohmBalance: BigDecimal = OHM_BTRFLY_BALANCE_OHM,
  btrflyBalance: BigDecimal = OHM_BTRFLY_BALANCE_BTRFLY,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
    ERC20_BALANCER_OHM_BTRFLY_V2,
    ERC20_STANDARD_DECIMALS,
    OHM_BTRFLY_TOTAL_SUPPLY,
    ERC20_OHM_V2,
    ERC20_BTRFLY_V2,
    null,
    ohmBalance,
    btrflyBalance,
    null,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  );
}

export const FRAXSWAP_OHM_FRAX_DECIMALS = 18;
export const FRAXSWAP_OHM_FRAX_TOTAL_SUPPLY = toDecimal(
  BigInt.fromString("1303397099889362190"),
  FRAXSWAP_OHM_FRAX_DECIMALS,
);
export const FRAXSWAP_OHM_FRAX_TOKEN0 = ERC20_OHM_V2;
export const FRAXSWAP_OHM_FRAX_TOKEN0_DECIMALS = OHM_V2_DECIMALS;
export const FRAXSWAP_OHM_FRAX_TOKEN1 = ERC20_FRAX;
export const FRAXSWAP_OHM_FRAX_TOKEN1_DECIMALS = ERC20_STANDARD_DECIMALS;
export const FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES = toDecimal(
  BigInt.fromString("10495919068290"),
  FRAXSWAP_OHM_FRAX_TOKEN0_DECIMALS,
);
export const FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES = toDecimal(
  BigInt.fromString("161899942493712174360986"),
  FRAXSWAP_OHM_FRAX_TOKEN1_DECIMALS,
);
export const FRAXSWAP_OHM_FRAX_TOTAL_VALUE = FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES.times(getOhmUsdRate()).plus(
  FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES.times(BigDecimal.fromString("1")),
);
export const FRAXSWAP_OHM_FRAX_UNIT_RATE = FRAXSWAP_OHM_FRAX_TOTAL_VALUE.div(
  FRAXSWAP_OHM_FRAX_TOTAL_SUPPLY,
);

export function mockFraxSwapPair(
  pairAddress: string,
  pairTotalSupply: BigDecimal,
  pairDecimals: i32,
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Reserves: BigDecimal,
  token1Reserves: BigDecimal,
): void {
  // mock OHM price
  mockUsdOhmV2Rate();

  mockERC20TotalSupply(token0Address, token0Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token0Decimals));
  mockERC20TotalSupply(token1Address, token1Decimals, toBigInt(DEFAULT_TOTAL_SUPPLY, token1Decimals));

  // totalSupply
  createMockedFunction(
    Address.fromString(pairAddress),
    "totalSupply",
    "totalSupply():(uint256)",
  ).returns([ethereum.Value.fromUnsignedBigInt(toBigInt(pairTotalSupply, pairDecimals))]);

  // decimals
  createMockedFunction(Address.fromString(pairAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(pairDecimals),
  ]);

  // token0
  createMockedFunction(Address.fromString(pairAddress), "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token0Address)),
  ]);

  // token1
  createMockedFunction(Address.fromString(pairAddress), "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token1Address)),
  ]);

  // token0 decimals
  createMockedFunction(Address.fromString(token0Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token0Decimals)],
  );

  // token1 decimals
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );

  // getReserves
  createMockedFunction(
    Address.fromString(pairAddress),
    "getReserves",
    "getReserves():(uint112,uint112,uint32)",
  ).returns([
    ethereum.Value.fromUnsignedBigInt(toBigInt(token0Reserves, token0Decimals)),
    ethereum.Value.fromUnsignedBigInt(toBigInt(token1Reserves, token1Decimals)),
    ethereum.Value.fromI32(0),
  ]);
}

export function mockFraxSwapPairZero(): void {
  mockFraxSwapPair(
    PAIR_FRAXSWAP_V1_OHM_FRAX,
    BigDecimal.fromString("0"),
    FRAXSWAP_OHM_FRAX_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN0,
    FRAXSWAP_OHM_FRAX_TOKEN1,
    FRAXSWAP_OHM_FRAX_TOKEN0_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN1_DECIMALS,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
  );

  mockFraxSwapPair(
    PAIR_FRAXSWAP_V2_OHM_FRAX,
    BigDecimal.fromString("0"),
    FRAXSWAP_OHM_FRAX_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN0,
    FRAXSWAP_OHM_FRAX_TOKEN1,
    FRAXSWAP_OHM_FRAX_TOKEN0_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN1_DECIMALS,
    BigDecimal.fromString("0"),
    BigDecimal.fromString("0"),
  );
}

export function mockFraxSwapPairOhmFrax(
  totalSupply: BigDecimal = FRAXSWAP_OHM_FRAX_TOTAL_SUPPLY,
): void {
  mockFraxSwapPair(
    PAIR_FRAXSWAP_V1_OHM_FRAX,
    totalSupply,
    FRAXSWAP_OHM_FRAX_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN0,
    FRAXSWAP_OHM_FRAX_TOKEN1,
    FRAXSWAP_OHM_FRAX_TOKEN0_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN1_DECIMALS,
    FRAXSWAP_OHM_FRAX_TOKEN0_RESERVES,
    FRAXSWAP_OHM_FRAX_TOKEN1_RESERVES,
  );
}
