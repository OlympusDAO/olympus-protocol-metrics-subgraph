import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import {
  AURA_ALLOCATOR_V2,
  CONVEX_ALLOCATOR3,
  CONVEX_CVX_VL_ALLOCATOR,
  DAO_WALLET,
  TREASURY_ADDRESS_V3,
  WALLET_ADDRESSES,
} from "../../shared/src/Wallets";
import {
  AURA_STAKING_AURA_BAL,
  BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
  CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
  ERC20_ALCX,
  ERC20_AURA,
  ERC20_AURA_VL,
  ERC20_BAL,
  ERC20_BALANCER_WETH_FDT,
  ERC20_CVX,
  ERC20_CVX_FRAX_3CRV,
  ERC20_CVX_VL_V2,
  ERC20_FRAX_3CRV,
  ERC20_GOHM,
  ERC20_LQTY,
  ERC20_OHM_V2,
  ERC20_TOKE,
  ERC20_WETH,
  getWalletAddressesForContract,
  LQTY_STAKING,
  NATIVE_ETH,
  TOKE_STAKING,
} from "../src/utils/Constants";
import {
  getAuraLockedBalancesFromWallets,
  getAuraPoolEarnedRecords,
  getBalancerGaugeBalanceFromWallets,
  getConvexStakedBalance,
  getConvexStakedRecords,
  getERC20,
  getERC20TokenRecordsFromWallets,
  getLiquityStakedBalancesFromWallets,
  getTokeStakedBalancesFromWallets,
  getVlCvxUnlockedRecords,
} from "../src/utils/ContractHelper";
import { mockStablecoinsPriceFeeds } from "./chainlink";
import { ERC20_STANDARD_DECIMALS, mockERC20TotalSupply } from "./erc20Helper";
import { mockAuraEarnedBalance, mockAuraEarnedBalanceZero, mockAuraLockedBalance, mockAuraLockedBalanceZero, mockBalancerGaugeBalance, mockBalancerGaugeBalanceZero, mockConvexStakedBalance, mockConvexStakedBalanceZero, mockEthUsdRate, mockLiquityStakedBalance, mockLiquityStakedBalanceZero, mockTokeStakedBalance, mockTokeStakedBalanceZero } from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const TIMESTAMP: BigInt = BigInt.fromString("1");
const DEFAULT_TOTAL_SUPPLY = BigDecimal.fromString("0");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  mockEthUsdRate();
  mockStablecoinsPriceFeeds();
});

describe("Staked Convex", () => {
  test("ignores invalid address", () => {
    const calculatedBalance = getConvexStakedBalance(
      NATIVE_ETH,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance ? false : true);
  });

  test("stakingToken reverts", () => {
    createMockedFunction(
      Address.fromString(CONVEX_STAKING_FRAX_3CRV_REWARD_POOL),
      "stakingToken",
      "stakingToken():(address)",
    ).reverts();

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance === null);
  });

  test("cvxFRAX3CRV balance", () => {
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.stringEquals("5", calculatedBalance ? calculatedBalance.toString() : "");
  });

  test("different token to reward pool staking token", () => {
    mockConvexStakedBalance(
      ERC20_FRAX_3CRV, // Different token
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const calculatedBalance = getConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      BigInt.fromString("1"),
    );
    assert.assertTrue(calculatedBalance ? false : true);
  });

  test("cvxFRAX3CRV token records", () => {
    mockConvexStakedBalanceZero();
    mockConvexStakedBalance(
      ERC20_CVX_FRAX_3CRV,
      CONVEX_ALLOCATOR3,
      CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
      toBigInt(BigDecimal.fromString("5"), ERC20_STANDARD_DECIMALS),
    );

    const records = getConvexStakedRecords(TIMESTAMP, ERC20_CVX_FRAX_3CRV, BigInt.fromString("1"));
    // 5 * $1
    assert.stringEquals("5", records[0].value.toString());
    assert.i32Equals(1, records.length);
  });
});

describe("get ERC20 token records from wallets", () => {
  test("excludes token in DAO wallet on blacklist", () => {
    mockZeroWalletBalances(ERC20_OHM_V2, getWalletAddressesForContract(ERC20_OHM_V2));

    // Set balance of the blacklist token
    mockWalletBalance(ERC20_OHM_V2, DAO_WALLET, toBigInt(BigDecimal.fromString("10")));
    mockERC20TotalSupply(ERC20_OHM_V2, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

    const blockNumber = BigInt.fromString("14000000");
    const contract = getERC20(ERC20_OHM_V2, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      TIMESTAMP,
      ERC20_OHM_V2,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    assert.i32Equals(0, records.length);
  });

  test("includes token in DAO wallet not on blacklist", () => {
    mockZeroWalletBalances(ERC20_WETH, getWalletAddressesForContract(ERC20_WETH));

    // Set balance of the whitelist token
    const tokenBalance = "10";
    mockWalletBalance(ERC20_WETH, DAO_WALLET, toBigInt(BigDecimal.fromString(tokenBalance)));
    mockERC20TotalSupply(ERC20_WETH, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

    const blockNumber = BigInt.fromString("14000000");
    const contract = getERC20(ERC20_WETH, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      TIMESTAMP,
      ERC20_WETH,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    const record = records[0];
    assert.stringEquals(tokenBalance, record.balance.toString());
    assert.i32Equals(1, records.length);
  });

  test("excludes OHM in treasury wallet addresses", () => {
    mockZeroWalletBalances(ERC20_OHM_V2, getWalletAddressesForContract(ERC20_OHM_V2));
    mockERC20TotalSupply(ERC20_OHM_V2, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

    for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
      mockWalletBalance(ERC20_OHM_V2, WALLET_ADDRESSES[i], toBigInt(BigDecimal.fromString("10")));
    }

    const blockNumber = BigInt.fromString("14000000");
    const contract = getERC20(ERC20_OHM_V2, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      TIMESTAMP,
      ERC20_OHM_V2,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    assert.i32Equals(0, records.length);
  });

  test("excludes gOHM in treasury wallet addresses", () => {
    mockZeroWalletBalances(ERC20_GOHM, getWalletAddressesForContract(ERC20_GOHM));
    mockERC20TotalSupply(ERC20_GOHM, ERC20_STANDARD_DECIMALS, toBigInt(DEFAULT_TOTAL_SUPPLY, ERC20_STANDARD_DECIMALS));

    for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
      mockWalletBalance(ERC20_GOHM, WALLET_ADDRESSES[i], toBigInt(BigDecimal.fromString("10")));
    }

    const blockNumber = BigInt.fromString("14000000");
    const contract = getERC20(ERC20_GOHM, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      TIMESTAMP,
      ERC20_GOHM,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    assert.i32Equals(0, records.length);
  });
});

describe("get TOKE staked records", () => {
  test("passed token does not match tokeToken", () => {
    // There is a balance
    mockTokeStakedBalance(
      ERC20_TOKE,
      TREASURY_ADDRESS_V3,
      TOKE_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    // Ignored as the token does not match the staking contract
    const records = getTokeStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_ALCX,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    assert.i32Equals(0, records.length);
  });

  test("staking contract reverts", () => {
    createMockedFunction(
      Address.fromString(TOKE_STAKING),
      "tokeToken",
      "tokeToken():(address)",
    ).reverts();

    const records = getTokeStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_TOKE,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    // Returns no records as the staking contract reverted
    assert.i32Equals(0, records.length);
  });

  test("staking contract returns balance", () => {
    mockTokeStakedBalanceZero(getWalletAddressesForContract(ERC20_TOKE));
    // There is a balance
    mockTokeStakedBalance(
      ERC20_TOKE,
      TREASURY_ADDRESS_V3,
      TOKE_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    const records = getTokeStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_TOKE,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    const recordOne = records[0];
    assert.stringEquals("10", recordOne.balance.toString());
    assert.stringEquals("2", recordOne.rate.toString());
    assert.i32Equals(1, records.length);
  });
});

describe("get LQTY staked records", () => {
  test("passed token does not match lqtyToken", () => {
    // There is a balance
    mockLiquityStakedBalance(
      ERC20_LQTY,
      TREASURY_ADDRESS_V3,
      LQTY_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    // Ignored as the token does not match the staking contract
    const records = getLiquityStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_ALCX,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    assert.i32Equals(0, records.length);
  });

  test("staking contract reverts", () => {
    createMockedFunction(
      Address.fromString(LQTY_STAKING),
      "lqtyToken",
      "lqtyToken():(address)",
    ).reverts();

    const records = getLiquityStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_LQTY,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    // Returns no records as the staking contract reverted
    assert.i32Equals(0, records.length);
  });

  test("staking contract returns balance", () => {
    mockLiquityStakedBalanceZero(getWalletAddressesForContract(ERC20_LQTY));
    // There is a balance
    mockLiquityStakedBalance(
      ERC20_LQTY,
      TREASURY_ADDRESS_V3,
      LQTY_STAKING,
      toBigInt(BigDecimal.fromString("10")),
    );

    const records = getLiquityStakedBalancesFromWallets(
      TIMESTAMP,
      ERC20_LQTY,
      BigDecimal.fromString("2"),
      BigInt.fromString("10"),
    );

    const recordOne = records[0];
    assert.stringEquals("10", recordOne.balance.toString());
    assert.stringEquals("2", recordOne.rate.toString());
    assert.i32Equals(1, records.length);
  });
});

describe("get Balancer liquidity gauge records", () => {
  test("passed token does not match lpToken", () => {
    // There is a balance
    mockBalancerGaugeBalance(
      ERC20_BALANCER_WETH_FDT,
      TREASURY_ADDRESS_V3,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      toBigInt(BigDecimal.fromString("10")),
    );

    // Ignored as the token does not match the staking contract
    const records = getBalancerGaugeBalanceFromWallets(
      TIMESTAMP,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      ERC20_ALCX,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("1"),
      BigInt.fromString("10"),
    );

    assert.i32Equals(0, records.length);
  });

  test("liquidity gauge contract reverts", () => {
    createMockedFunction(
      Address.fromString(BALANCER_LIQUIDITY_GAUGE_WETH_FDT),
      "lp_token",
      "lp_token():(address)",
    ).reverts();

    const records = getBalancerGaugeBalanceFromWallets(
      TIMESTAMP,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      ERC20_BALANCER_WETH_FDT,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("1"),
      BigInt.fromString("10"),
    );

    // Returns no records as the staking contract reverted
    assert.i32Equals(0, records.length);
  });

  test("liquidity gauge contract returns balance", () => {
    mockBalancerGaugeBalanceZero(getWalletAddressesForContract(ERC20_BALANCER_WETH_FDT));
    // There is a balance
    mockBalancerGaugeBalance(
      ERC20_BALANCER_WETH_FDT,
      TREASURY_ADDRESS_V3,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      toBigInt(BigDecimal.fromString("10")),
    );

    const records = getBalancerGaugeBalanceFromWallets(
      TIMESTAMP,
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
      ERC20_BALANCER_WETH_FDT,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("1"),
      BigInt.fromString("10"),
    );

    const recordOne = records[0];
    assert.stringEquals("10", recordOne.balance.toString());
    assert.stringEquals("2", recordOne.rate.toString());
    assert.i32Equals(1, records.length);
  });
});

export const mockUnlockedVlCvxBalance = (
  tokenAddress: string,
  tokenDecimals: i32,
  allocatorAddress: string,
  lockedBalance: BigDecimal,
  unlockedBalance: BigDecimal,
): void => {
  const tokenContract = Address.fromString(tokenAddress);

  const lockDataArray: Array<ethereum.Value> = [
    ethereum.Value.fromI32(0),
    ethereum.Value.fromI32(0),
    ethereum.Value.fromI32(0),
  ];
  const lockData = changetype<ethereum.Tuple>(lockDataArray);

  // Returns locked and unlocked balances
  createMockedFunction(
    tokenContract,
    "lockedBalances",
    "lockedBalances(address):(uint256,uint256,uint256,(uint112,uint112,uint32)[])",
  )
    .withArgs([ethereum.Value.fromAddress(Address.fromString(allocatorAddress))])
    .returns([
      ethereum.Value.fromUnsignedBigInt(
        toBigInt(lockedBalance.plus(unlockedBalance), tokenDecimals),
      ),
      ethereum.Value.fromUnsignedBigInt(toBigInt(unlockedBalance, tokenDecimals)),
      ethereum.Value.fromUnsignedBigInt(toBigInt(lockedBalance, tokenDecimals)),
      ethereum.Value.fromTupleArray([lockData]),
    ]);

  // Token decimals
  createMockedFunction(Address.fromString(tokenAddress), "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(tokenDecimals),
  ]);
};

export const mockUnlockedVlCvxBalanceZero = (): void => {
  const wallets = getWalletAddressesForContract(ERC20_CVX_VL_V2);
  for (let i = 0; i < wallets.length; i++) {
    mockUnlockedVlCvxBalance(ERC20_CVX_VL_V2, 18, wallets[i], BigDecimal.zero(), BigDecimal.zero());
  }
};

describe("unlocked vlCVX", () => {
  test("zero balance", () => {
    mockUnlockedVlCvxBalanceZero();

    const records = getVlCvxUnlockedRecords(
      TIMESTAMP,
      ERC20_CVX_VL_V2,
      BigDecimal.fromString("1"),
      BigInt.fromString("15000000"),
    );

    assert.i32Equals(0, records.length);
  });

  test("unsupported token", () => {
    mockUnlockedVlCvxBalanceZero();

    const records = getVlCvxUnlockedRecords(
      TIMESTAMP,
      ERC20_CVX,
      BigDecimal.fromString("1"),
      BigInt.fromString("15000000"),
    );

    assert.i32Equals(0, records.length);
  });

  test("positive balance", () => {
    mockUnlockedVlCvxBalanceZero();
    mockUnlockedVlCvxBalance(
      ERC20_CVX_VL_V2,
      18,
      CONVEX_CVX_VL_ALLOCATOR,
      BigDecimal.fromString("10"),
      BigDecimal.fromString("11"), // We test for this
    );

    const records = getVlCvxUnlockedRecords(
      TIMESTAMP,
      ERC20_CVX_VL_V2,
      BigDecimal.fromString("1"),
      BigInt.fromString("15000000"),
    );

    const recordOne = records[0];
    assert.stringEquals("11", recordOne.balance.toString());
    assert.i32Equals(1, records.length);
  });
});

describe("locked AURA", () => {
  test("balance", () => {
    const balance = BigDecimal.fromString("10");
    const rate = BigDecimal.fromString("2");
    mockAuraLockedBalanceZero(getWalletAddressesForContract(ERC20_AURA));
    mockAuraLockedBalance(ERC20_AURA, AURA_ALLOCATOR_V2, ERC20_AURA_VL, toBigInt(balance, 18));

    const records = getAuraLockedBalancesFromWallets(TIMESTAMP, ERC20_AURA, rate, BigInt.fromString("15000000"));

    const recordOne = records[0];
    assert.stringEquals("10", recordOne.balance.toString());
    assert.i32Equals(1, records.length);
  });

  test("balance for non-AURA token", () => {
    const balance = BigDecimal.fromString("10");
    const rate = BigDecimal.fromString("2");
    mockAuraLockedBalanceZero(getWalletAddressesForContract(ERC20_AURA));
    mockAuraLockedBalance(ERC20_AURA, AURA_ALLOCATOR_V2, ERC20_AURA_VL, toBigInt(balance, 18));

    const records = getAuraLockedBalancesFromWallets(TIMESTAMP, ERC20_TOKE, rate, BigInt.fromString("15000000"));

    assert.i32Equals(0, records.length);
  });
});

describe("Aura earned rewards", () => {
  test("balance is correct", () => {
    const balance = BigDecimal.fromString("10");
    const rate = BigDecimal.fromString("2");
    mockAuraEarnedBalanceZero(ERC20_BAL, getWalletAddressesForContract(ERC20_BAL));
    mockAuraEarnedBalance(ERC20_BAL, AURA_ALLOCATOR_V2, AURA_STAKING_AURA_BAL, toBigInt(balance, 18));

    const records = getAuraPoolEarnedRecords(TIMESTAMP, ERC20_BAL, rate, BigInt.fromString("15000000"));

    const recordOne = records[0];
    assert.stringEquals("10", recordOne.balance.toString());
    assert.i32Equals(1, records.length);
  });

  test("balance is 0 for different token", () => {
    const balance = BigDecimal.fromString("10");
    const rate = BigDecimal.fromString("2");
    mockAuraEarnedBalanceZero(ERC20_BAL, getWalletAddressesForContract(ERC20_BAL));
    mockAuraEarnedBalance(ERC20_BAL, AURA_ALLOCATOR_V2, AURA_STAKING_AURA_BAL, toBigInt(balance, 18));

    const records = getAuraPoolEarnedRecords(TIMESTAMP, ERC20_AURA, rate, BigInt.fromString("15000000"));

    assert.i32Equals(0, records.length);
  });
})