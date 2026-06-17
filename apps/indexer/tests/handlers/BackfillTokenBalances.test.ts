import type { EvmOnBlockContext } from "envio";
import { describe, expect, test, vi } from "vitest";

import { runBackfill } from "../../src/handlers/BackfillTokenBalances";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";

// Mock a minimal onBlock context. The backfill only reads chain config,
// calls effects (readBlockTimestamp + readErc20BalanceOf), and writes
// TokenBalance / TokenBalanceUpdate. The mock dispatches `effect()` calls
// to a per-(token, wallet) balance map and records every entity write.

type Seed = { tokenAddress: string; walletAddress: string; balance: bigint };

function buildMockContext(args: {
  chainId: number;
  blockTimestamp: number;
  balances: Seed[];
  existingTokenBalances?: Array<{ id: string; balance: bigint }>;
}) {
  const balanceByPair = new Map<string, bigint>();
  for (const b of args.balances) {
    balanceByPair.set(`${addr(b.tokenAddress)}|${addr(b.walletAddress)}`, b.balance);
  }
  const tokenBalanceStore = new Map<string, { id: string; balance: bigint }>();
  for (const e of args.existingTokenBalances ?? []) {
    tokenBalanceStore.set(e.id, e);
  }
  const tokenBalanceSets: Array<Record<string, unknown>> = [];
  const tokenBalanceUpdateSets: Array<Record<string, unknown>> = [];
  const sentinelSets: Array<Record<string, unknown>> = [];

  const context = {
    chain: { id: args.chainId },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    TokenBalance: {
      get: vi.fn(async (id: string) => tokenBalanceStore.get(id)),
      set: vi.fn((entity: Record<string, unknown>) => tokenBalanceSets.push(entity)),
    },
    TokenBalanceUpdate: {
      set: vi.fn((entity: Record<string, unknown>) => tokenBalanceUpdateSets.push(entity)),
    },
    BackfillSentinel: {
      get: vi.fn(async (_id: string) => undefined),
      set: vi.fn((entity: Record<string, unknown>) => sentinelSets.push(entity)),
    },
    effect: vi.fn(
      async (
        effectDef: { name: string },
        input: { tokenAddress?: string; walletAddress?: string; blockNumber?: number },
      ) => {
        if (effectDef.name === "readBlockTimestamp") {
          return String(args.blockTimestamp);
        }
        if (effectDef.name === "readErc20BalanceOf") {
          const key = `${addr(input.tokenAddress ?? "")}|${addr(input.walletAddress ?? "")}`;
          return (balanceByPair.get(key) ?? 0n).toString();
        }
        throw new Error(`unexpected effect ${effectDef.name}`);
      },
    ),
  } as unknown as EvmOnBlockContext;

  return { context, tokenBalanceSets, tokenBalanceUpdateSets, sentinelSets };
}

describe("BackfillTokenBalances", () => {
  test("Arbitrum: seeds TokenBalance for FRAX held in Cross-Chain Arbitrum at chain start", async () => {
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f";
    const wallet = ARBITRUM.protocolAddresses[0]; // Cross-Chain Arbitrum
    const PRE_EXISTING = 18_072_805448367500373789n;

    const { context, tokenBalanceSets, tokenBalanceUpdateSets } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 1_651_363_200,
      balances: [{ tokenAddress: FRAX, walletAddress: wallet, balance: PRE_EXISTING }],
    });

    const result = await runBackfill(context, { number: 10_950_000 });

    expect(result.seeded).toBeGreaterThanOrEqual(1);
    const fraxEntity = tokenBalanceSets.find(
      (e) =>
        e.tokenAddress === addr(FRAX) && e.walletAddress === addr(wallet) && e.chainId === 42161,
    );
    expect(fraxEntity).toBeDefined();
    expect(fraxEntity?.balance).toBe(PRE_EXISTING);
    expect(fraxEntity?.id).toBe(`42161-${addr(FRAX)}-${addr(wallet)}`);
    expect(fraxEntity?.updatedAtBlock).toBe(10_950_000n);

    const fraxUpdate = tokenBalanceUpdateSets.find(
      (e) =>
        e.tokenAddress === addr(FRAX) && e.walletAddress === addr(wallet) && e.chainId === 42161,
    );
    expect(fraxUpdate).toBeDefined();
    expect(fraxUpdate?.delta).toBe(PRE_EXISTING);
    expect(fraxUpdate?.balance).toBe(PRE_EXISTING);
    expect(fraxUpdate?.id).toBe(`42161-${addr(FRAX)}-${addr(wallet)}-backfill`);
    expect(fraxUpdate?.timestamp).toBe(1_651_363_200n);
  });

  test("zero-balance pairs are skipped (no entity write)", async () => {
    const { context, tokenBalanceSets, tokenBalanceUpdateSets } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 1_651_363_200,
      balances: [], // every balanceOf returns 0
    });

    const result = await runBackfill(context, { number: 10_950_000 });

    expect(result.seeded).toBe(0);
    expect(tokenBalanceSets).toHaveLength(0);
    expect(tokenBalanceUpdateSets).toHaveLength(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  test("native zero-address token is never queried", async () => {
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const NATIVE = "0x0000000000000000000000000000000000000000";
    const wallet = ARBITRUM.protocolAddresses[0];

    const { context } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 1_651_363_200,
      // Even if "native" had a seed, runBackfill should skip native tokens
      balances: [
        { tokenAddress: NATIVE, walletAddress: wallet, balance: 5_000_000_000_000_000_000n },
      ],
    });

    await runBackfill(context, { number: 10_950_000 });

    const effectCalls = (context.effect as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const balanceOfCallsForNative = effectCalls.filter(
      (call) =>
        call[0]?.name === "readErc20BalanceOf" &&
        addr(String(call[1]?.tokenAddress ?? "")) === NATIVE,
    );
    expect(balanceOfCallsForNative).toHaveLength(0);
  });

  test("tokens not yet active at the read block are skipped", async () => {
    // Use a token with a startBlock far in the future relative to the backfill block.
    // Fantom config has FANTOM_START_BLOCK = 37_320_000; pick a token whose
    // startBlock equals that (so reading at 37_319_999 should skip it).
    const FANTOM = CHAIN_CONFIGS[250];
    const tokensWithStartBlock = FANTOM.tokens.filter(
      (t) => t.startBlock !== undefined && t.startBlock >= 37_320_000,
    );
    expect(tokensWithStartBlock.length).toBeGreaterThan(0);

    const { context } = buildMockContext({
      chainId: 250,
      blockTimestamp: 1_651_363_200,
      balances: [],
    });

    await runBackfill(context, { number: 37_320_000 });

    // Confirm no effect call referenced the pre-startBlock read block for an
    // active token in a way that would have errored. The isActive() check
    // uses readAt = block.number - 1 = 37_319_999, which is < the startBlock
    // 37_320_000 of these tokens — so they should be skipped without an
    // effect call.
    const effectCalls = (context.effect as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const balanceOfCalls = effectCalls.filter((call) => call[0]?.name === "readErc20BalanceOf");
    for (const call of balanceOfCalls) {
      const tokenLower = addr(String(call[1]?.tokenAddress ?? ""));
      const tokenDef = FANTOM.tokens.find((t) => t.address === tokenLower);
      // Any token we DID query must be active at read block 37_319_999
      if (tokenDef?.startBlock !== undefined) {
        expect(tokenDef.startBlock).toBeLessThanOrEqual(37_319_999);
      }
    }
  });

  test("wrong chain throws (defensive)", async () => {
    const { context } = buildMockContext({
      chainId: 999_999,
      blockTimestamp: 0,
      balances: [],
    });
    await expect(runBackfill(context, { number: 0 })).rejects.toThrow(/unsupported chain/);
  });

  test("block before startBlock throws (defensive — handler should never fire before chain start)", async () => {
    const { context } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 0,
      balances: [],
    });
    await expect(runBackfill(context, { number: 10_000_000 })).rejects.toThrow(
      /fired before startBlock/,
    );
  });

  test("late-firing handler adds pre-window seed to existing TokenBalance (additive)", async () => {
    // Simulates the wide-filter behaviour: backfill fires on the first
    // block at or after startBlock that HyperSync delivers, which may be
    // many blocks later. By then the Transfer handler may have written
    // an in-window delta to TokenBalance. The seed must ADD to that, not
    // overwrite, so the resulting ledger equals pre-window + in-window.
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f";
    const wallet = ARBITRUM.protocolAddresses[0];
    const tokenLower = addr(FRAX);
    const walletLower = addr(wallet);
    const id = `42161-${tokenLower}-${walletLower}`;
    const PRE_WINDOW = 18_072_805448367500373789n;
    const IN_WINDOW_DELTA = -5_000_000000000000000000n; // outflow after chain start

    const { context, tokenBalanceSets } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 1_651_400_000,
      balances: [{ tokenAddress: FRAX, walletAddress: wallet, balance: PRE_WINDOW }],
      existingTokenBalances: [{ id, balance: IN_WINDOW_DELTA }],
    });

    // Fire well after startBlock (10_950_000).
    await runBackfill(context, { number: 11_500_000 });

    const fraxEntity = tokenBalanceSets.find((e) => e.id === id);
    expect(fraxEntity).toBeDefined();
    // pre-window + in-window
    expect(fraxEntity?.balance).toBe(PRE_WINDOW + IN_WINDOW_DELTA);
  });

  test("writes BackfillSentinel exactly once at the end of the run", async () => {
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const FRAX = "0x17fc002b466eec40dae837fc4be5c67993ddbd6f";
    const wallet = ARBITRUM.protocolAddresses[0];

    const { context, sentinelSets } = buildMockContext({
      chainId: 42161,
      blockTimestamp: 1_651_363_200,
      balances: [{ tokenAddress: FRAX, walletAddress: wallet, balance: 1n }],
    });

    const result = await runBackfill(context, { number: 11_500_000 });

    expect(sentinelSets).toHaveLength(1);
    expect(sentinelSets[0]?.id).toBe("42161");
    expect(sentinelSets[0]?.chainId).toBe(42161);
    expect(sentinelSets[0]?.firedAtBlock).toBe(11_500_000n);
    expect(sentinelSets[0]?.seededAtBlock).toBe(10_949_999n); // startBlock - 1
    expect(sentinelSets[0]?.seeded).toBe(result.seeded);
    expect(sentinelSets[0]?.skipped).toBe(result.skipped);
  });
});
