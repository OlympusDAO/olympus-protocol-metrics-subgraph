import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  log,
  test,
} from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { YIELD_FARMING_MS } from "../../shared/src/Wallets";
import {
  AURA_REWARDS_CONTRACTS,
  CONVEX_STAKING_CONTRACTS,
  ERC20_AETH_SUSDE,
  ERC20_USDE,
  ERC4626_SUSDE,
} from "../src/utils/Constants";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { getStablecoinBalance } from "../src/utils/TokenStablecoins";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";
import { mockPriceFeed } from "./chainlink";
import { mockERC20TotalSupply } from "./erc20Helper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const TIMESTAMP = BigInt.fromString("1");
// Block 24707147 is the creation block of Yield Farming MS (start block for aEthSUSDe)
const BLOCK_NUMBER = BigInt.fromString("24707147");

// sUSDe NAV: 1 sUSDe share = 1.0500 USDe (test value approximating real NAV ~1.2248)
const SUSDE_ASSETS_TO_SHARES = toDecimal(BigInt.fromString("1050000000000000000"), 18);

/**
 * Mocks sUSDe ERC4626 vault so aEthSUSDe can be priced via convertToAssets().
 * aEthSUSDe uses LIQUIDITY_POOL_TOKEN_LOOKUP -> PairHandlerTypes.ERC4626 -> ERC4626_SUSDE.
 * The ERC4626 handler calls: sUSDe.asset() -> USDe, sUSDe.convertToAssets(1e18) -> NAV.
 */
function mockSUsdeERC4626(assetsToShares: BigDecimal): void {
  const susdeAddress = Address.fromString(ERC4626_SUSDE);

  createMockedFunction(susdeAddress, "asset", "asset():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(ERC20_USDE)),
  ]);

  createMockedFunction(susdeAddress, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18)),
  ]);

  createMockedFunction(susdeAddress, "convertToAssets", "convertToAssets(uint256):(uint256)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromU32(10).pow(18))])
    .returns([ethereum.Value.fromUnsignedBigInt(toBigInt(assetsToShares, 18))]);
}

/**
 * Mocks all Convex staking contracts so stakingToken() reverts.
 * getConvexStakedBalance checks if stakingToken == aEthSUSDe; reverts -> null -> skipped.
 */
function mockConvexStakingContractsRevert(): void {
  for (let i = 0; i < CONVEX_STAKING_CONTRACTS.length; i++) {
    createMockedFunction(
      Address.fromString(CONVEX_STAKING_CONTRACTS[i]),
      "stakingToken",
      "stakingToken():(address)",
    ).reverts();
  }
}

/**
 * Mocks all Aura reward pool contracts so rewardToken() reverts.
 * getAuraPoolEarnedRecords checks if rewardToken == aEthSUSDe; reverts -> null -> skipped.
 */
function mockAuraRewardContractsRevert(): void {
  for (let i = 0; i < AURA_REWARDS_CONTRACTS.length; i++) {
    createMockedFunction(
      Address.fromString(AURA_REWARDS_CONTRACTS[i]),
      "rewardToken",
      "rewardToken():(address)",
    ).reverts();
  }
}

describe("aEthSUSDe - Yield Farming MS", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    mockTreasuryAddressNull();
    mockClearinghouseRegistryAddressNull();

    // Mock decimals and totalSupply for the token (needed by getOrCreateERC20TokenSnapshot)
    mockERC20TotalSupply(ERC20_AETH_SUSDE, 18, BigInt.fromString("0"));

    // Set all protocol wallets to zero balance for aEthSUSDe
    mockZeroWalletBalances(
      ERC20_AETH_SUSDE,
      getWalletAddressesForContract(ERC20_AETH_SUSDE, BLOCK_NUMBER),
    );

    // Make Convex and Aura contract calls revert — these tokens aren't in those pools
    mockConvexStakingContractsRevert();
    mockAuraRewardContractsRevert();
  });

  test("getStablecoinBalance returns correct balance and sUSDe-derived rate for aEthSUSDe in Yield Farming MS", () => {
    // aEthSUSDe is priced via sUSDe ERC4626 (not Chainlink ~$1).
    // Mock sUSDe vault: 1 share = 1.05 USDe, USDe price = $1 -> rate = $1.05 per aEthSUSDe.
    mockSUsdeERC4626(SUSDE_ASSETS_TO_SHARES);
    mockPriceFeed(ERC20_USDE, BigDecimal.fromString("1"));

    // balanceOf(YIELD_FARMING_MS) = 125.2562 aEthSUSDe (on-chain block 24701224)
    mockWalletBalance(
      ERC20_AETH_SUSDE,
      YIELD_FARMING_MS,
      BigInt.fromString("125256200000000000000"),
    );

    const records = getStablecoinBalance(TIMESTAMP, ERC20_AETH_SUSDE, false, BLOCK_NUMBER);

    assert.assertTrue(records.length > 0);

    // Find and validate the record for YIELD_FARMING_MS
    let found = false;
    for (let i = 0; i < records.length; i++) {
      if (records[i].sourceAddress.toLowerCase() == YIELD_FARMING_MS.toLowerCase()) {
        // balance = 125256200000000000000 / 10^18 = 125.2562 (from balanceOf, not scaledBalanceOf)
        assert.stringEquals(records[i].balance.toString(), "125.2562");

        // rate = sUSDe NAV = 1.05 (not $1 — aEthSUSDe underlying is sUSDe, not USDe)
        assert.stringEquals(records[i].rate.toString(), "1.05");

        // value = balance * rate = 125.2562 * 1.05 = 131.51901
        assert.stringEquals(records[i].value.toString(), "131.51901");

        found = true;
      }
    }
    assert.assertTrue(found);
  });

  test("getStablecoinBalance returns records only for Yield Farming MS, not other wallets", () => {
    mockSUsdeERC4626(SUSDE_ASSETS_TO_SHARES);
    mockPriceFeed(ERC20_USDE, BigDecimal.fromString("1"));

    // Only YIELD_FARMING_MS has a non-zero balance — all others are zeroed in beforeEach
    mockWalletBalance(
      ERC20_AETH_SUSDE,
      YIELD_FARMING_MS,
      BigInt.fromString("125256200000000000000"),
    );

    const records = getStablecoinBalance(TIMESTAMP, ERC20_AETH_SUSDE, false, BLOCK_NUMBER);

    assert.assertTrue(records.length > 0);

    // Every returned record must be for YIELD_FARMING_MS only
    for (let i = 0; i < records.length; i++) {
      assert.stringEquals(records[i].sourceAddress.toLowerCase(), YIELD_FARMING_MS.toLowerCase());
    }
  });

  test("getStablecoinBalance returns empty before start block", () => {
    // Block 14000000 is well before ERC20_AETH_SUSDE_START_BLOCK (22423121)
    // getERC20() returns null early — no contract calls made, no mocks needed
    const records = getStablecoinBalance(
      TIMESTAMP,
      ERC20_AETH_SUSDE,
      false,
      BigInt.fromString("14000000"),
    );

    assert.i32Equals(0, records.length);
  });

  test("getStablecoinBalance returns no records when balance is zero", () => {
    // Mock sUSDe vault — needed because getERC20 succeeds (block >= start block)
    mockSUsdeERC4626(SUSDE_ASSETS_TO_SHARES);
    mockPriceFeed(ERC20_USDE, BigDecimal.fromString("1"));

    // All wallets already mocked to zero in beforeEach — no override needed
    const records = getStablecoinBalance(TIMESTAMP, ERC20_AETH_SUSDE, false, BLOCK_NUMBER);

    assert.i32Equals(0, records.length);
  });
});
