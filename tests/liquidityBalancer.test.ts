import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { TokenRecord } from "../generated/schema";
import {
  BALANCER_VAULT,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_DAI,
  ERC20_OHM_V2,
  ERC20_USDC,
  ERC20_WETH,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import {
  getBalancerPoolTokenQuantity,
  getBalancerPoolTotalTokenQuantity,
  getBalancerPoolTotalValue,
  getBalancerRecords,
} from "../src/utils/LiquidityBalancer";
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

const BALANCE_OHM = BigDecimal.fromString("221499.733846818");
const BALANCE_DAI = BigDecimal.fromString("1932155.145566782258916959");
const BALANCE_WETH = BigDecimal.fromString("1080.264364629190826870");
const POOL_TOKEN_TOTAL_SUPPLY = BigDecimal.fromString("100");

function mockBalancerVault(
  poolAddress: string,
  poolId: string,
  poolTokenAddress: string,
  poolTokenDecimals: i32,
  poolTokenTotalSupply: BigDecimal,
  token1Address: string,
  token2Address: string,
  token3Address: string,
  token1Balance: BigDecimal,
  token2Balance: BigDecimal,
  token3Balance: BigDecimal,
  token1Decimals: i32,
  token2Decimals: i32,
  token3Decimals: i32,
): void {
  // getPoolTokens
  createMockedFunction(
    Address.fromString(poolAddress),
    "getPoolTokens",
    "getPoolTokens(bytes32):(address[],uint256[],uint256)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddressArray([
        Address.fromString(token1Address),
        Address.fromString(token2Address),
        Address.fromString(token3Address),
      ]),
      ethereum.Value.fromUnsignedBigIntArray([
        toBigInt(token1Balance, token1Decimals),
        toBigInt(token2Balance, token2Decimals),
        toBigInt(token3Balance, token3Decimals),
      ]),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("14936424")),
    ]);

  // getPool
  createMockedFunction(
    Address.fromString(poolAddress),
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
  createMockedFunction(Address.fromString(token3Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token3Decimals)],
  );
}

describe("pool total value", () => {
  test("OHM-DAI-ETH pool total value", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
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
    const expectedValue = BALANCE_OHM.times(getOhmUsdRate())
      .plus(BALANCE_DAI)
      .plus(BALANCE_WETH.times(getEthUsdRate()));
    assert.stringEquals(expectedValue.toString(), totalValue.toString());
  });
});

describe("token quantity", () => {
  test("total quantity of OHM token in pool", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    const ohm = getBalancerPoolTotalTokenQuantity(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    assert.stringEquals(ohm.toString(), BALANCE_OHM.toString());
  });

  test("quantity of OHM token in pool", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock wallet balance
    const expectedWalletBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(ERC20_BALANCER_OHM_DAI_WETH, WALLET_ADDRESSES);
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedWalletBalance, ERC20_STANDARD_DECIMALS),
    );

    // total token quantity * balance / total supply
    const expectedTokenBalance =
      BALANCE_OHM.times(expectedWalletBalance).div(POOL_TOKEN_TOTAL_SUPPLY);

    const records = getBalancerPoolTokenQuantity(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      OHM_USD_RESERVE_BLOCK,
    );

    // Balance = value as the unit rate is 1
    assert.stringEquals(records.balance.toString(), expectedTokenBalance.toString());
    assert.stringEquals(records.value.toString(), expectedTokenBalance.toString());
  });
});

describe("get balancer records", () => {
  test("OHM-DAI-ETH pool balance", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(ERC20_BALANCER_OHM_DAI_WETH, WALLET_ADDRESSES);
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    const expectedTotalValue = BALANCE_OHM.times(getOhmUsdRate())
      .plus(BALANCE_DAI)
      .plus(BALANCE_WETH.times(getEthUsdRate()));
    const expectedUnitRate = expectedTotalValue.div(POOL_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-DAI-ETH pool with matching tokenAddress", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(ERC20_BALANCER_OHM_DAI_WETH, WALLET_ADDRESSES);
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      OHM_USD_RESERVE_BLOCK,
      ERC20_DAI,
    );

    const expectedTotalValue = BALANCE_OHM.times(getOhmUsdRate())
      .plus(BALANCE_DAI)
      .plus(BALANCE_WETH.times(getEthUsdRate()));
    const expectedUnitRate = expectedTotalValue.div(POOL_TOKEN_TOTAL_SUPPLY);
    const expectedValue = expectedBalance.times(expectedUnitRate);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-DAI-ETH pool with different tokenAddress", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      OHM_USD_RESERVE_BLOCK,
      ERC20_USDC,
    );

    assert.stringEquals("0", records.value.toString());
  });

  test("OHM-DAI-ETH pool single-sided value", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_BALANCER_OHM_DAI_WETH,
      ERC20_STANDARD_DECIMALS,
      POOL_TOKEN_TOTAL_SUPPLY,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );

    // Mock wallet balance
    const expectedBalance = BigDecimal.fromString("2");
    mockZeroWalletBalances(ERC20_BALANCER_OHM_DAI_WETH, WALLET_ADDRESSES);
    mockWalletBalance(
      ERC20_BALANCER_OHM_DAI_WETH,
      TREASURY_ADDRESS_V3,
      toBigInt(expectedBalance, ERC20_STANDARD_DECIMALS),
    );

    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      true,
      OHM_USD_RESERVE_BLOCK,
    );

    // DAI * rate + WETH * rate (OHM excluded)
    const expectedNonOhmValue = BALANCE_DAI.plus(BALANCE_WETH.times(getEthUsdRate()));
    // The value should be determined by adjusting the multiplier
    // (DAI * rate + WETH * rate) / (OHM * rate + DAI * rate + WETH * rate)
    const expectedTotalValue = BALANCE_OHM.times(getOhmUsdRate())
      .plus(BALANCE_DAI)
      .plus(BALANCE_WETH.times(getEthUsdRate()));
    const expectedMultiplier = expectedNonOhmValue.div(expectedTotalValue);
    const expectedUnitRate = expectedTotalValue.div(POOL_TOKEN_TOTAL_SUPPLY);

    const record = TokenRecord.load(records.records[0]);
    assert.stringEquals(expectedMultiplier.toString(), record ? record.multiplier.toString() : "");

    // balance * rate * multiplier
    const expectedValue = expectedBalance.times(expectedUnitRate).times(expectedMultiplier);
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });
});
