import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import {
  BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
  BALANCER_VAULT,
  DAO_WALLET,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_BALANCER_WETH_FDT,
  ERC20_DAI,
  ERC20_FDT,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_USDC,
  ERC20_WETH,
  getWalletAddressesForContract,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_WETH_FDT_ID,
  TREASURY_ADDRESS_V3,
} from "../src/utils/Constants";
import { toBigInt, toDecimal } from "../src/utils/Decimals";
import {
  getBalancerPoolTokenQuantity,
  getBalancerPoolTotalTokenQuantity,
  getBalancerPoolTotalValue,
  getBalancerRecords,
} from "../src/utils/LiquidityBalancer";
import { mockBalancerGaugeBalance, mockBalancerGaugeBalanceZero } from "./contractHelper.test";
import {
  ERC20_STANDARD_DECIMALS,
  getEthUsdRate,
  getOhmUsdRate,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

export const OHM_DAI_ETH_BALANCE_OHM = BigDecimal.fromString("221499.733846818");
export const OHM_DAI_ETH_BALANCE_DAI = BigDecimal.fromString("1932155.145566782258916959");
export const OHM_DAI_ETH_BALANCE_WETH = BigDecimal.fromString("1080.264364629190826870");
export const OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY = BigDecimal.fromString("100");
export const OHM_DAI_ETH_WEIGHT_OHM = BigDecimal.fromString("0.5");
export const OHM_DAI_ETH_WEIGHT_DAI = BigDecimal.fromString("0.25");
export const OHM_DAI_ETH_WEIGHT_WETH = BigDecimal.fromString("0.25");

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

export function mockBalanceVaultZero(): void {
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
    BigDecimal.fromString("0"),
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.8"),
    BigDecimal.fromString("0.2"),
    null,
  );
}

export function mockBalanceVaultOhmDaiEth(
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
export function mockBalanceVaultWethFdt(
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

describe("pool total value", () => {
  test("OHM-DAI-ETH pool total value, all tokens", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const totalValue = getBalancerPoolTotalValue(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      false,
      null,
      OHM_USD_RESERVE_BLOCK,
    );

    // OHM * rate + DAI * rate + WETH * rate
    const expectedValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });

  test("OHM-DAI-ETH pool total value, only ETH", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const totalValue = getBalancerPoolTotalValue(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      true,
      ERC20_WETH,
      OHM_USD_RESERVE_BLOCK,
    );

    // WETH * rate
    const expectedValue = OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate());
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });

  test("OHM-DAI-ETH pool total value, only ETH uppercase", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const totalValue = getBalancerPoolTotalValue(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      true,
      ERC20_WETH.toUpperCase(),
      OHM_USD_RESERVE_BLOCK,
    );

    // WETH * rate
    const expectedValue = OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate());
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });
});

describe("token quantity", () => {
  test("total quantity of OHM token in pool", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    const ohm = getBalancerPoolTotalTokenQuantity(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(ohm.toString(), OHM_DAI_ETH_BALANCE_OHM.toString());
  });

  test("balance of OHM V2 token in OHM V2 pool", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance = OHM_DAI_ETH_BALANCE_OHM.times(expectedWalletBalance).div(
      OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY,
    );

    const records = getBalancerPoolTokenQuantity(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(records.balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(records.value.toString(), expectedTokenBalance.toString());
  });

  test("balance of OHM V1 token in OHM V2 pool", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getBalancerPoolTokenQuantity(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals("0", records.balance.toString());
    assert.stringEquals("0", records.value.toString());
    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.records.length);
  });

  test("balance of OHM V2 token in OHM V2 pool before starting block", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth(BigDecimal.fromString("0")); // total supply 0 before starting block

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    const records = getBalancerPoolTokenQuantity(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals("0", records.balance.toString());
    assert.stringEquals("0", records.value.toString());
    // Should be empty records due to starting block
    assert.i32Equals(0, records.records.length);
  });
});

describe("get balancer records", () => {
  test("OHM-DAI-ETH pool balance, all tokens", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
      null,
    );

    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-DAI-ETH pool balance before starting block", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth(BigDecimal.fromString("0")); // total supply 0 before starting block

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals("0", records.value.toString());
  });

  test("OHM-DAI-ETH pool with matching tokenAddress", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
      ERC20_DAI,
    );

    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-DAI-ETH pool with different tokenAddress", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
      ERC20_USDC,
    );

    assert.stringEquals("0", records.value.toString());
  });

  test("OHM-DAI-ETH pool single-sided value", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      true,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    // DAI * rate + WETH * rate (OHM excluded)
    const expectedNonOhmValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()),
    );
    // The value should be determined by adjusting the multiplier
    // (DAI * rate + WETH * rate) / (OHM * rate + DAI * rate + WETH * rate)
    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedMultiplier = expectedNonOhmValue.div(expectedTotalValue);
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);

    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals(expectedMultiplier.toString(), record ? record.multiplier.toString() : "");

    // balance * rate * multiplier
    const expectedValue = expectedBalance.times(expectedUnitRate).times(expectedMultiplier);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("WETH-FDT pool with no balance, with liquidity gauge", () => {
    mockBalancerGaugeBalanceZero(getWalletAddressesForContract(ERC20_BALANCER_WETH_FDT));

    // Mock the balancer
    mockBalanceVaultWethFdt();

    // Mock wallet balance for liquidity gauge
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_WETH_FDT,
      getWalletAddressesForContract(ERC20_BALANCER_WETH_FDT),
    );

    mockBalancerGaugeBalance(
      ERC20_BALANCER_WETH_FDT,
      DAO_WALLET,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      toBigInt(expectedBalance),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      "metric",
      BALANCER_VAULT,
      POOL_BALANCER_WETH_FDT_ID,
      false,
      false,
      OHM_USD_RESERVE_BLOCK,
      null,
    );

    const recordOne = TokenRecord.load(records.records[0]);
    assert.stringEquals(expectedBalance.toString(), recordOne ? recordOne.balance.toString() : "");
    assert.i32Equals(1, records.records.length);
  });
});
