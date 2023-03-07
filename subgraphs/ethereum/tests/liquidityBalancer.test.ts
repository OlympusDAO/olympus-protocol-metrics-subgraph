import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
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
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_BALANCER_WETH_FDT,
  ERC20_DAI,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_USDC,
  getWalletAddressesForContract,
  POOL_BALANCER_OHM_DAI_WETH_ID,
  POOL_BALANCER_OHM_V2_BTRFLY_V2_ID,
  POOL_BALANCER_WETH_FDT_ID,
} from "../src/utils/Constants";
import {
  mockBalancerGaugeBalance,
  mockBalancerGaugeBalanceZero,
} from "./contractHelper.test";
import { ERC20_STANDARD_DECIMALS } from "./erc20Helper";
import {
  getBtrflyV2UsdRate,
  getEthUsdRate,
  getOhmUsdRate,
  mockBalancerVaultOhmBtrfly,
  mockBalancerVaultOhmDaiEth,
  mockBalancerVaultWethFdt,
  mockBalancerVaultZero,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  mockWEthBtrflyV2Rate,
  OHM_BTRFLY_BALANCE_BTRFLY,
  OHM_BTRFLY_BALANCE_OHM,
  OHM_BTRFLY_TOTAL_SUPPLY,
  OHM_DAI_ETH_BALANCE_DAI,
  OHM_DAI_ETH_BALANCE_OHM,
  OHM_DAI_ETH_BALANCE_WETH,
  OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY,
  OHM_USD_RESERVE_BLOCK,
} from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const TIMESTAMP = BigInt.fromString("1");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();
});

describe("pool total value", () => {
  test("OHM-DAI-ETH pool total value, all tokens", () => {
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultOhmDaiEth(BigDecimal.fromString("0")); // total supply 0 before starting block

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
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalancerVaultOhmDaiEth(BigDecimal.fromString("0")); // total supply 0 before starting block

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
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultZero();

    // Mock the balancer
    mockBalancerVaultOhmDaiEth();

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
    mockBalancerVaultOhmDaiEth();

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
      BigDecimal.fromString("100")
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
    mockBalancerVaultWethFdt();

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
      BigDecimal.fromString("1000"),
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
