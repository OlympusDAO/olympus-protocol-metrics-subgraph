import type { TokenBalance, TokenBalanceUpdate } from "envio";
import { describe, expect, test, vi } from "vitest";

import {
  handleStakingRewardsStaked,
  handleStakingRewardsWithdrawn,
} from "../../src/handlers/Erc20Transfers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";

function buildContext(seed?: {
  tokenAddress: string;
  walletAddress: string;
  balance: bigint;
  chainId: number;
}) {
  const tokenBalances = new Map<string, TokenBalance>();
  if (seed) {
    const id = `${seed.chainId}-${addr(seed.tokenAddress)}-${addr(seed.walletAddress)}`;
    tokenBalances.set(id, {
      id,
      chainId: seed.chainId,
      tokenAddress: addr(seed.tokenAddress),
      walletAddress: addr(seed.walletAddress),
      balance: seed.balance,
      updatedAtBlock: 0n,
    });
  }
  const balanceSets: TokenBalance[] = [];
  const updateSets: TokenBalanceUpdate[] = [];
  const context = {
    TokenBalance: {
      get: async (id: string) => tokenBalances.get(id),
      set: vi.fn((e: TokenBalance) => {
        balanceSets.push(e);
        tokenBalances.set(e.id, e);
      }),
    },
    TokenBalanceUpdate: {
      set: vi.fn((e: TokenBalanceUpdate) => updateSets.push(e)),
    },
  };
  return { context, balanceSets, updateSets };
}

describe("StakingRewardsVault handlers", () => {
  const BERA = 80094;
  // Beradrome Kodiak OHM-HONEY reward vault V2
  const VAULT_V2 = "0x8e5b2df607b43c8d0f28035210d4e1ad1e72b8ed";
  // DAO MS (Berachain) — the actual holder of these stake balances
  const DAO_MS = "0x91494d1bc2286343d51c55e46ae80c9356d099b5";

  test("DAO MS is registered as a Berachain treasury wallet", () => {
    expect(CHAIN_CONFIGS[BERA].protocolAddresses.map((a) => addr(a))).toContain(addr(DAO_MS));
  });

  test("Staked credits user's stake balance with +amount", async () => {
    const amount = 1_601_790_717_528_370_303n; // 1.60179 LP units (matches on-chain Beradrome V2 holding)
    const { context, balanceSets, updateSets } = buildContext();

    await handleStakingRewardsStaked({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 5,
        block: { number: 5_000_000, timestamp: 1_710_000_000 },
        params: { user: DAO_MS, amount },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsStaked>[0]["context"],
    });

    expect(balanceSets).toHaveLength(1);
    expect(balanceSets[0].balance).toBe(amount);
    expect(balanceSets[0].id).toBe(`${BERA}-${addr(VAULT_V2)}-${addr(DAO_MS)}`);
    expect(updateSets[0].delta).toBe(amount);
  });

  test("Withdrawn debits user's stake balance with -amount", async () => {
    const startingStake = 5_000_000_000_000_000_000n; // 5 LP
    const withdrawAmount = 2_000_000_000_000_000_000n; // 2 LP
    const { context, balanceSets, updateSets } = buildContext({
      chainId: BERA,
      tokenAddress: VAULT_V2,
      walletAddress: DAO_MS,
      balance: startingStake,
    });

    await handleStakingRewardsWithdrawn({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 7,
        block: { number: 6_000_000, timestamp: 1_712_000_000 },
        params: { user: DAO_MS, amount: withdrawAmount },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsWithdrawn>[0]["context"],
    });

    expect(balanceSets[0].balance).toBe(startingStake - withdrawAmount);
    expect(updateSets[0].delta).toBe(-withdrawAmount);
  });

  test("Stake + Withdraw cycle returns the ledger to zero", async () => {
    const amount = 1_601_790_717_528_370_303n;
    const { context, balanceSets } = buildContext();

    await handleStakingRewardsStaked({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 1,
        block: { number: 5_000_000, timestamp: 1_710_000_000 },
        params: { user: DAO_MS, amount },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsStaked>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(amount);

    await handleStakingRewardsWithdrawn({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 2,
        block: { number: 6_000_000, timestamp: 1_712_000_000 },
        params: { user: DAO_MS, amount },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsWithdrawn>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(0n);
  });

  test("Staked by a non-treasury user is a no-op", async () => {
    const randomUser = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets } = buildContext();

    await handleStakingRewardsStaked({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 1,
        block: { number: 5_000_000, timestamp: 1_710_000_000 },
        params: { user: randomUser, amount: 10_000_000_000_000_000_000n },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsStaked>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
  });

  test("Withdrawn by a non-treasury user is a no-op", async () => {
    const randomUser = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets } = buildContext();

    await handleStakingRewardsWithdrawn({
      event: {
        chainId: BERA,
        srcAddress: VAULT_V2,
        logIndex: 1,
        block: { number: 6_000_000, timestamp: 1_712_000_000 },
        params: { user: randomUser, amount: 10_000_000_000_000_000_000n },
      },
      context: context as unknown as Parameters<typeof handleStakingRewardsWithdrawn>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
  });
});
