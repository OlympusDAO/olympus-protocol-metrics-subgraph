import type { TokenBalance, TokenBalanceUpdate } from "envio";
import { describe, expect, test, vi } from "vitest";

import { handleErc4626Deposit, handleErc4626Withdraw } from "../../src/handlers/Erc20Transfers";
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

describe("Erc4626Vault handlers", () => {
  const ETH = 1;
  const SDAI = "0x83f20f44975d03b1b09e64809b757c47f942beea";
  const TRSRY = "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613";
  const DAO_MS = "0x245cc372c84b3645bf0ffe6538620b04a217988b";

  // Sanity: TRSRY must be in Ethereum protocolAddresses
  test("TRSRY is registered as a treasury wallet on Ethereum", () => {
    expect(CHAIN_CONFIGS[ETH].protocolAddresses.map((a) => addr(a))).toContain(addr(TRSRY));
  });

  test("Deposit credits owner's TokenBalance with +shares (not assets)", async () => {
    const shares = 19_324_704_878_578_539_680_831_230n; // ~19.3M sDAI
    const assets = 20_000_000_000_000_000_000_000_000n; // ~20M DAI (different value!)
    const { context, balanceSets, updateSets } = buildContext();

    await handleErc4626Deposit({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 432,
        block: { number: 18_164_221, timestamp: 1_695_000_000 },
        params: { sender: DAO_MS, owner: TRSRY, assets, shares },
      },
      context: context as unknown as Parameters<typeof handleErc4626Deposit>[0]["context"],
    });

    expect(balanceSets).toHaveLength(1);
    expect(balanceSets[0].balance).toBe(shares); // shares, NOT assets
    expect(balanceSets[0].id).toBe(`${ETH}-${addr(SDAI)}-${addr(TRSRY)}`);
    expect(updateSets[0].delta).toBe(shares);
  });

  test("Withdraw debits owner's TokenBalance with -shares", async () => {
    const startingShares = 100_000_000_000_000_000_000n; // 100 sDAI
    const sharesBurnt = 25_000_000_000_000_000_000n; // 25 sDAI
    const assetsOut = 27_000_000_000_000_000_000n; // 27 DAI (interest accrued, different from shares)
    const { context, balanceSets, updateSets } = buildContext({
      chainId: ETH,
      tokenAddress: SDAI,
      walletAddress: TRSRY,
      balance: startingShares,
    });

    await handleErc4626Withdraw({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 50,
        block: { number: 18_500_000, timestamp: 1_700_000_000 },
        params: {
          sender: DAO_MS,
          receiver: DAO_MS,
          owner: TRSRY,
          assets: assetsOut,
          shares: sharesBurnt,
        },
      },
      context: context as unknown as Parameters<typeof handleErc4626Withdraw>[0]["context"],
    });

    expect(balanceSets[0].balance).toBe(startingShares - sharesBurnt);
    expect(updateSets[0].delta).toBe(-sharesBurnt);
  });

  test("Deposit + Withdraw cycle returns the ledger to start", async () => {
    const shares = 19_324_704_878_578_539_680_831_230n;
    const { context, balanceSets } = buildContext();

    await handleErc4626Deposit({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 1,
        block: { number: 18_164_221, timestamp: 1_695_000_000 },
        params: { sender: DAO_MS, owner: TRSRY, assets: shares, shares },
      },
      context: context as unknown as Parameters<typeof handleErc4626Deposit>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(shares);

    await handleErc4626Withdraw({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 2,
        block: { number: 18_500_000, timestamp: 1_700_000_000 },
        params: { sender: DAO_MS, receiver: DAO_MS, owner: TRSRY, assets: shares, shares },
      },
      context: context as unknown as Parameters<typeof handleErc4626Withdraw>[0]["context"],
    });
    expect(balanceSets.at(-1)?.balance).toBe(0n);
  });

  test("Deposit to a non-treasury owner is a no-op", async () => {
    const randomOwner = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets } = buildContext();

    await handleErc4626Deposit({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 1,
        block: { number: 18_164_221, timestamp: 1_695_000_000 },
        params: {
          sender: DAO_MS,
          owner: randomOwner,
          assets: 1_000_000_000_000_000_000n,
          shares: 1_000_000_000_000_000_000n,
        },
      },
      context: context as unknown as Parameters<typeof handleErc4626Deposit>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
  });

  test("Withdraw from a non-treasury owner is a no-op", async () => {
    const randomOwner = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const { context, balanceSets } = buildContext();

    await handleErc4626Withdraw({
      event: {
        chainId: ETH,
        srcAddress: SDAI,
        logIndex: 1,
        block: { number: 18_500_000, timestamp: 1_700_000_000 },
        params: {
          sender: DAO_MS,
          receiver: DAO_MS,
          owner: randomOwner,
          assets: 1_000_000_000_000_000_000n,
          shares: 1_000_000_000_000_000_000n,
        },
      },
      context: context as unknown as Parameters<typeof handleErc4626Withdraw>[0]["context"],
    });

    expect(balanceSets).toHaveLength(0);
  });
});
