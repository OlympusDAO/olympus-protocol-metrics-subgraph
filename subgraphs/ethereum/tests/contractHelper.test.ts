import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { toBigInt } from "../../shared/src/utils/Decimals";
import {
  AURA_ALLOCATOR_V2,
  CONVEX_ALLOCATOR3,
  CONVEX_CVX_VL_ALLOCATOR,
  DAO_WALLET,
  TREASURY_ADDRESS_V3,
} from "../../shared/src/Wallets";
import {
  AURA_REWARDS_CONTRACTS,
  AURA_STAKING_AURA_BAL,
  AURA_STAKING_OHM_DAI_WETH,
  AURA_STAKING_OHM_WETH,
  BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH,
  BALANCER_LIQUIDITY_GAUGE_OHM_WETH,
  BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
  CONVEX_ALLOCATORS,
  CONVEX_STAKING_CONTRACTS,
  CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
  ERC20_ALCX,
  ERC20_AURA,
  ERC20_AURA_VL,
  ERC20_BAL,
  ERC20_BALANCER_OHM_DAI_WETH,
  ERC20_BALANCER_OHM_DAI_WETH_AURA,
  ERC20_BALANCER_OHM_WETH,
  ERC20_BALANCER_OHM_WETH_AURA,
  ERC20_BALANCER_WETH_FDT,
  ERC20_CVX,
  ERC20_CVX_FRAX_3CRV,
  ERC20_CVX_FRAX_USDC_STAKED,
  ERC20_CVX_OHMETH,
  ERC20_CVX_VL_V2,
  ERC20_FRAX_3CRV,
  ERC20_LQTY,
  ERC20_TOKE,
  ERC20_WETH,
  FRAX_LOCKING_CONTRACTS,
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
import { ERC20_STANDARD_DECIMALS } from "./pairHelper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const TIMESTAMP: BigInt = BigInt.fromString("1");

export const mockConvexStakedBalance = (
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  balance: BigInt,
): void => {
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
): void => {
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

export const mockBalancerGaugeBalanceZero = (wallets: string[]): void => {
  for (let i = 0; i < wallets.length; i++) {
    mockBalancerGaugeBalance(
      ERC20_BALANCER_WETH_FDT,
      wallets[i],
      BALANCER_LIQUIDITY_GAUGE_WETH_FDT,
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
  }
};

export const mockAuraStakedBalance = (
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
  for (let i = 0; i < wallets.length; i++) {
    mockAuraStakedBalance(
      ERC20_BALANCER_OHM_DAI_WETH_AURA,
      wallets[i],
      AURA_STAKING_OHM_DAI_WETH,
      BigInt.zero(),
    );

    mockAuraStakedBalance(
      ERC20_BALANCER_OHM_WETH_AURA,
      wallets[i],
      AURA_STAKING_OHM_WETH,
      BigInt.zero(),
    );

    mockAuraStakedBalance(
      ERC20_BALANCER_OHM_DAI_WETH_AURA,
      wallets[i],
      AURA_STAKING_AURA_BAL,
      BigInt.zero(),
    );
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
  test("excludes token not on whitelist", () => {
    mockZeroWalletBalances(ERC20_ALCX, getWalletAddressesForContract(ERC20_ALCX));

    // Set balance of the non-whitelist token
    mockWalletBalance(ERC20_ALCX, DAO_WALLET, toBigInt(BigDecimal.fromString("10")));
    createMockedFunction(
      Address.fromString(ERC20_ALCX.toLowerCase()),
      "decimals",
      "decimals():(uint8)",
    ).returns([ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS)]);

    const blockNumber = BigInt.fromString("1");
    const contract = getERC20(ERC20_ALCX, blockNumber);
    if (!contract) throw new Error("Expected ERC20 contract to be non-null");

    const records = getERC20TokenRecordsFromWallets(
      TIMESTAMP,
      ERC20_ALCX,
      contract,
      BigDecimal.fromString("1"),
      blockNumber,
    );

    assert.i32Equals(0, records.length);
  });

  test("includes token in DAO wallet on whitelist", () => {
    mockZeroWalletBalances(ERC20_WETH, getWalletAddressesForContract(ERC20_WETH));

    // Set balance of the whitelist token
    const tokenBalance = "10";
    mockWalletBalance(ERC20_WETH, DAO_WALLET, toBigInt(BigDecimal.fromString(tokenBalance)));
    createMockedFunction(Address.fromString(ERC20_WETH), "decimals", "decimals():(uint8)").returns([
      ethereum.Value.fromI32(ERC20_STANDARD_DECIMALS),
    ]);

    const blockNumber = BigInt.fromString("1");
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