import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { DAO_WALLET, TREASURY_ADDRESS_V3 } from "../../shared/src/Wallets";
import {
  getBalancerPoolTokenQuantity,
  getBalancerPoolTotalTokenQuantity,
  getBalancerPoolTotalValue,
  getBalancerRecords,
} from "../src/liquidity/LiquidityBalancer";
import {
  BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH,
  BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
  BALANCER_VAULT,
  ERC20_BALANCER_OHM_BTRFLY_V2,
  ERC20_BALANCER_OHM_DAI,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_BALANCER_OHM_WETH,
  ERC20_BALANCER_WETH_FDT,
  ERC20_BTRFLY_V2,
  ERC20_DAI,
  ERC20_FDT,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_USDC,
  ERC20_WETH,
  getWalletAddressesForContract,
  POOL_BALANCER_OHM_DAI,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
  POOL_BALANCER_OHM_WETH,
  POOL_BALANCER_WETH_FDT_ID,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import {
  mockAuraStakedBalanceZero,
  mockBalancerGaugeBalance,
  mockBalancerGaugeBalanceZero,
} from "./contractHelper.test";
import {
  ERC20_STANDARD_DECIMALS,
  getBtrflyV2UsdRate,
  getEthUsdRate,
  getOhmUsdRate,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  mockWEthBtrflyV2Rate,
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

const TIMESTAMP = BigInt.fromString("1");

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
    BigDecimal.fromString("0"),
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
    BigDecimal.fromString("0"),
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
    BigDecimal.fromString("0"),
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
    BigDecimal.fromString("0"),
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    BigDecimal.fromString("0.5"),
    BigDecimal.fromString("0.5"),
    null,
  )

  mockBalancerGaugeBalanceZero(WALLET_ADDRESSES);
  mockAuraStakedBalanceZero(WALLET_ADDRESSES);
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
      OHM_USD_RESERVE_BLOCK,
    );

    // OHM * rate + DAI * rate + WETH * rate
    const expectedValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });

  test("OHM-DAI-ETH pool total value, non-ohm tokens", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const totalValue = getBalancerPoolTotalValue(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      true,
      OHM_USD_RESERVE_BLOCK,
    );

    // DAI * rate + WETH * rate
    const expectedValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()),
    );
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });
});

describe("token quantity", () => {
  test("total quantity of OHM token in pool", () => {
    mockBalancerVaultZero();

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
    mockBalancerVaultZero();

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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(expectedTokenBalance.toString(), records[0].balance.toString());
    assert.stringEquals(
      expectedTokenBalance.times(BigDecimal.fromString("-1")).toString(),
      records[0].supplyBalance.toString(),
    ); // Negative, being taken out of circulation
    assert.i32Equals(1, records.length);
  });

  test("balance of OHM V1 token in OHM V2 pool", () => {
    mockBalancerVaultZero();

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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V1,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to 0 balance of OHM V1
    assert.i32Equals(0, records.length);
  });

  test("balance of OHM V2 token in OHM V2 pool before starting block", () => {
    mockBalancerVaultZero();

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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Should be empty records due to starting block
    assert.i32Equals(0, records.length);
  });
});

describe("get balancer records", () => {
  test("OHM-DAI-ETH pool balance, all tokens", () => {
    mockBalancerVaultZero();

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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
      null,
    );

    // DAI * rate + WETH * rate (OHM excluded)
    const expectedNonOhmTotalValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()),
    );
    // The value should be determined by adjusting the multiplier
    // (DAI * rate + WETH * rate) / (OHM * rate + DAI * rate + WETH * rate)
    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedMultiplier = expectedNonOhmTotalValue.div(expectedTotalValue);
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    const expectedNonOhmValue = expectedBalance.times(expectedUnitRate).times(expectedMultiplier);

    const record = records[0];
    assert.stringEquals(expectedNonOhmValue.toString(), record.valueExcludingOhm.toString());
    assert.stringEquals(expectedMultiplier.toString(), record.multiplier.toString());
    assert.stringEquals(expectedValue.toString(), record.value.toString());

    assert.i32Equals(1, records.length);
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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.i32Equals(0, records.length);
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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
      ERC20_DAI,
    );

    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    assert.stringEquals(expectedValue.toString(), records[0].value.toString());

    assert.i32Equals(1, records.length);
  });

  test("OHM-DAI-ETH pool with different tokenAddress", () => {
    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
      ERC20_USDC,
    );

    assert.i32Equals(0, records.length);
  });

  test("OHM-DAI-ETH pool, with liquidity gauge", () => {
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalanceVaultOhmDaiEth();

    // Mock wallet balance for liquidity gauge
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_DAI_WETH,
      getWalletAddressesForContract(POOL_BALANCER_OHM_DAI_WETH_ID),
    );
    mockBalancerGaugeBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH,
      toBigInt(expectedBalance),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      OHM_USD_RESERVE_BLOCK,
    );

    // DAI * rate + WETH * rate (OHM excluded)
    const expectedNonOhmTotalValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()),
    );
    // The value should be determined by adjusting the multiplier
    // (DAI * rate + WETH * rate) / (OHM * rate + DAI * rate + WETH * rate)
    const expectedTotalValue = OHM_DAI_ETH_BALANCE_OHM.times(getOhmUsdRate())
      .plus(OHM_DAI_ETH_BALANCE_DAI)
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getEthUsdRate()));
    const expectedMultiplier = expectedNonOhmTotalValue.div(expectedTotalValue);
    const expectedUnitRate = expectedTotalValue.div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    const expectedNonOhmValue = expectedBalance.times(expectedUnitRate).times(expectedMultiplier);

    const record = records[0];
    assert.stringEquals(expectedNonOhmValue.toString(), record.valueExcludingOhm.toString());
    assert.stringEquals(expectedMultiplier.toString(), record.multiplier.toString());
    assert.stringEquals(expectedValue.toString(), record.value.toString());

    assert.i32Equals(1, records.length);
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
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_WETH_FDT_ID,
      OHM_USD_RESERVE_BLOCK,
      null,
    );

    const recordOne = records[0];
    assert.stringEquals(expectedBalance.toString(), recordOne.balance.toString());
    assert.i32Equals(1, records.length);
  });

  test("OHM-BTRFLY V2 pool balance, all tokens", () => {
    // Mock the balancer
    mockBalancerVaultOhmBtrfly();

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(
      ERC20_BALANCER_OHM_BTRFLY_V2,
      getWalletAddressesForContract(ERC20_BALANCER_OHM_BTRFLY_V2),
    );
    mockWalletBalance(
      ERC20_BALANCER_OHM_BTRFLY_V2,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();
    mockWEthBtrflyV2Rate();

    const records = getBalancerRecords(
      TIMESTAMP,
      BALANCER_VAULT,
      POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
      OHM_USD_RESERVE_BLOCK,
      null,
    );

    // BTRFLY * rate (OHM excluded)
    const expectedNonOhmTotalValue = OHM_BTRFLY_BALANCE_BTRFLY.times(getBtrflyV2UsdRate());
    const expectedTotalValue = OHM_BTRFLY_BALANCE_BTRFLY.times(getBtrflyV2UsdRate()).plus(
      OHM_BTRFLY_BALANCE_OHM.times(getOhmUsdRate()),
    );

    // The value should be determined by adjusting the multiplier
    const expectedMultiplier = expectedNonOhmTotalValue.div(expectedTotalValue);
    const expectedUnitRate = expectedTotalValue.div(OHM_BTRFLY_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    const expectedNonOhmValue = expectedBalance.times(expectedUnitRate).times(expectedMultiplier);

    const record = records[0];
    assert.stringEquals(expectedNonOhmValue.toString(), record.valueExcludingOhm.toString());
    assert.stringEquals(expectedMultiplier.toString(), record.multiplier.toString());
    assert.stringEquals(expectedValue.toString(), record.value.toString());

    assert.i32Equals(1, records.length);
  });
});
