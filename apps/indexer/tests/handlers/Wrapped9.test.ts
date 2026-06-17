import type { TokenBalance, TokenBalanceUpdate } from "envio";
import { describe, expect, test, vi } from "vitest";

import { handleWrapped9Deposit, handleWrapped9Withdrawal } from "../../src/handlers/Erc20Transfers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";

// Mock context that records TokenBalance + TokenBalanceUpdate writes and
// returns a seeded TokenBalance for the relevant id on read.
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

describe("Wrapped9 handlers", () => {
  const ETH = 1;
  const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  // LUSD_ALLOCATOR is in Ethereum protocolAddresses
  const treasuryWallet = CHAIN_CONFIGS[ETH].protocolAddresses.find(
    (w) => w === addr("0x97b3ef4c558ec456d59cb95c65bfb79046e31fca"),
  );

  function requireTreasuryWallet(): string {
    if (treasuryWallet === undefined) {
      throw new Error("Expected treasury wallet fixture to exist");
    }
    return treasuryWallet;
  }

  test("Deposit credits dst's TokenBalance with +wad", async () => {
    const wallet = requireTreasuryWallet();
    const wad = 771_059_105_630_142_323_797n;
    const { context, balanceSets, updateSets } = buildContext();

    await handleWrapped9Deposit({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 35,
        block: { number: 14_915_630, timestamp: 1_654_000_000 },
        params: { dst: wallet, wad },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Deposit>[0]["context"],
    });

    expect(balanceSets).toHaveLength(1);
    expect(balanceSets[0].balance).toBe(wad);
    expect(balanceSets[0].id).toBe(`${ETH}-${addr(WETH)}-${addr(wallet)}`);

    expect(updateSets).toHaveLength(1);
    expect(updateSets[0].delta).toBe(wad);
    expect(updateSets[0].balance).toBe(wad);
  });

  test("Withdrawal debits src's TokenBalance with -wad", async () => {
    const wallet = requireTreasuryWallet();
    const startingBalance = 1_000_000_000_000_000_000_000n; // 1000 wETH
    const wad = 250_000_000_000_000_000_000n; // 250 wETH
    const { context, balanceSets, updateSets } = buildContext({
      chainId: ETH,
      tokenAddress: WETH,
      walletAddress: wallet,
      balance: startingBalance,
    });

    await handleWrapped9Withdrawal({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 12,
        block: { number: 17_000_000, timestamp: 1_680_000_000 },
        params: { src: wallet, wad },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Withdrawal>[0]["context"],
    });

    expect(balanceSets).toHaveLength(1);
    expect(balanceSets[0].balance).toBe(startingBalance - wad);
    expect(updateSets).toHaveLength(1);
    expect(updateSets[0].delta).toBe(-wad);
    expect(updateSets[0].balance).toBe(startingBalance - wad);
  });

  test("Deposit + Withdrawal cycle returns the ledger to start (no drift)", async () => {
    // This is the LUSD_ALLOCATOR phantom-negative scenario: wrap and forward.
    // Wrap mints +wad to wallet, then a Transfer (simulated by directly
    // decrementing the balance) sends it out. The Deposit handler must
    // catch the wrap so the subsequent outflow lands on the right base.
    const wallet = requireTreasuryWallet();
    const wad = 771_059_105_630_142_323_797n;
    const { context, balanceSets } = buildContext();

    // Wrap inflow
    await handleWrapped9Deposit({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 35,
        block: { number: 14_915_630, timestamp: 1_654_000_000 },
        params: { dst: wallet, wad },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Deposit>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(wad);

    // Simulate a Transfer-out via Withdrawal (same value)
    await handleWrapped9Withdrawal({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 36,
        block: { number: 14_915_630, timestamp: 1_654_000_000 },
        params: { src: wallet, wad },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Withdrawal>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(0n);
  });

  test("Deposit to a non-treasury wallet is a no-op", async () => {
    const randomWallet = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets, updateSets } = buildContext();

    await handleWrapped9Deposit({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 1,
        block: { number: 14_915_630, timestamp: 1_654_000_000 },
        params: { dst: randomWallet, wad: 1_000_000_000_000_000_000n },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Deposit>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
    expect(updateSets).toHaveLength(0);
  });

  test("Withdrawal from a non-treasury wallet is a no-op", async () => {
    const randomWallet = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets, updateSets } = buildContext();

    await handleWrapped9Withdrawal({
      event: {
        chainId: ETH,
        srcAddress: WETH,
        logIndex: 1,
        block: { number: 14_915_630, timestamp: 1_654_000_000 },
        params: { src: randomWallet, wad: 1_000_000_000_000_000_000n },
      },
      context: context as unknown as Parameters<typeof handleWrapped9Withdrawal>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
    expect(updateSets).toHaveLength(0);
  });
});
