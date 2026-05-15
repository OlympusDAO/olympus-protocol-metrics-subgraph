import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { SerializedTokenRecord } from "../../src/snapshot/types";
import { pushTokenBalanceRecords } from "../../src/handlers/BlockHandlers";

// Per-chain snapshot validation. Each test wires a minimal mock context
// with one TokenBalance + ChainlinkPriceState row, calls
// pushTokenBalanceRecords for the target chain, and asserts at least one
// TokenRecord is produced with sane fields.
//
// The goal is a smoke test per chain that catches regressions in the
// per-chain config (token lists, decimals, handler registrations) and the
// snapshot orchestration end-to-end. Deeper coverage lives in the
// per-handler unit tests.

const BLOCK = 100_000_000n;
const TIMESTAMP = 1_700_000_000n;

function buildMockClient(chainId: number): PublicClient {
  return {
    chain: { id: chainId },
    readContract: async () => {
      throw new Error("pushTokenBalanceRecords must not perform RPC reads in this test");
    },
    getBalance: async () => 0n,
  } as unknown as PublicClient;
}

function buildMockContext(seed: {
  chainId: number;
  chainlinkAnswer?: { feedAddress: string; tokenAddress: string; answer: bigint; decimals: number };
  tokenBalance?: { tokenAddress: string; walletAddress: string; balance: bigint };
}): EvmOnBlockContext {
  const chainlinkStates = new Map<string, unknown>();
  if (seed.chainlinkAnswer) {
    chainlinkStates.set(`${seed.chainId}-${addr(seed.chainlinkAnswer.feedAddress)}`, {
      chainId: seed.chainId,
      feedAddress: addr(seed.chainlinkAnswer.feedAddress),
      tokenAddress: addr(seed.chainlinkAnswer.tokenAddress),
      answer: seed.chainlinkAnswer.answer,
      decimals: seed.chainlinkAnswer.decimals,
      roundId: 1n,
      updatedAtBlock: BLOCK,
      updatedAtTimestamp: TIMESTAMP,
    });
  }
  const tokenBalances = new Map<string, unknown>();
  if (seed.tokenBalance) {
    const id = `${seed.chainId}-${addr(seed.tokenBalance.tokenAddress)}-${addr(seed.tokenBalance.walletAddress)}`;
    tokenBalances.set(id, {
      chainId: seed.chainId,
      tokenAddress: addr(seed.tokenBalance.tokenAddress),
      walletAddress: addr(seed.tokenBalance.walletAddress),
      balance: seed.tokenBalance.balance,
      updatedAtBlock: BLOCK,
    });
  }

  return {
    ChainlinkPriceState: { get: async (id: string) => chainlinkStates.get(id) },
    OhmIndexState: { get: async () => undefined },
    TokenBalance: { get: async (id: string) => tokenBalances.get(id) },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    NativeBalanceState: { set: vi.fn() },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect: vi.fn(async () => ""),
  } as unknown as EvmOnBlockContext;
}

describe("pushTokenBalanceRecords per-chain validation", () => {
  test("Arbitrum: emits a TokenRecord for WETH held in the DAO MS via Chainlink ETH/USD price", async () => {
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
    const ETH_USD_FEED = "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612";
    const wallet = ARBITRUM.protocolAddresses[0];
    const context = buildMockContext({
      chainId: 42161,
      chainlinkAnswer: {
        feedAddress: ETH_USD_FEED,
        tokenAddress: WETH,
        answer: 250_000_000_000n, // $2500 at 8-dec feed
        decimals: 8,
      },
      tokenBalance: {
        tokenAddress: WETH,
        walletAddress: wallet,
        balance: 5_000_000_000_000_000_000n, // 5 WETH
      },
    });
    const records: SerializedTokenRecord[] = [];
    await pushTokenBalanceRecords(
      context,
      ARBITRUM,
      buildMockClient(42161),
      records,
      TIMESTAMP,
      BLOCK,
    );
    const wethRecords = records.filter((r) => r.tokenAddress === WETH);
    expect(wethRecords.length).toBeGreaterThanOrEqual(1);
    expect(wethRecords[0].chainId).toBe(42161);
    expect(wethRecords[0].blockchain).toBe("Arbitrum");
    expect(wethRecords[0].rate).toBe("2500");
    expect(wethRecords[0].balance).toBe("5");
    expect(wethRecords[0].value).toBe("12500"); // 5 × 2500
  });

  test("Base: emits a TokenRecord for USDC held in the DAO MS via Chainlink USDC/USD price", async () => {
    const BASE = CHAIN_CONFIGS[8453];
    const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const USDC_USD_FEED = "0x7e860098f58bbfc8648a4311b374b1d669a2bc6b";
    const wallet = BASE.protocolAddresses[0];
    const context = buildMockContext({
      chainId: 8453,
      chainlinkAnswer: {
        feedAddress: USDC_USD_FEED,
        tokenAddress: USDC,
        answer: 100_000_000n, // $1
        decimals: 8,
      },
      tokenBalance: {
        tokenAddress: USDC,
        walletAddress: wallet,
        balance: 1_000_000_000n, // 1000 USDC at 6 decimals
      },
    });
    const records: SerializedTokenRecord[] = [];
    await pushTokenBalanceRecords(context, BASE, buildMockClient(8453), records, TIMESTAMP, BLOCK);
    const usdcRecords = records.filter((r) => r.tokenAddress === USDC);
    expect(usdcRecords.length).toBeGreaterThanOrEqual(1);
    expect(usdcRecords[0].chainId).toBe(8453);
    expect(usdcRecords[0].blockchain).toBe("Base");
    expect(usdcRecords[0].balance).toBe("1000");
    expect(usdcRecords[0].value).toBe("1000");
  });

  test("Ethereum: emits a TokenRecord for DAI in Treasury V2 via Chainlink DAI/USD price", async () => {
    const ETHEREUM = CHAIN_CONFIGS[1];
    const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
    const DAI_USD_FEED = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9";
    const TREASURY_V2 = "0x31f8cc382c9898b273eff4e0b7626a6987c846e8";
    const context = buildMockContext({
      chainId: 1,
      chainlinkAnswer: {
        feedAddress: DAI_USD_FEED,
        tokenAddress: DAI,
        answer: 100_000_000n, // $1
        decimals: 8,
      },
      tokenBalance: {
        tokenAddress: DAI,
        walletAddress: TREASURY_V2,
        balance: 1_000_000_000_000_000_000_000n, // 1000 DAI
      },
    });
    const records: SerializedTokenRecord[] = [];
    await pushTokenBalanceRecords(context, ETHEREUM, buildMockClient(1), records, TIMESTAMP, BLOCK);
    const daiRecords = records.filter(
      (r) => r.tokenAddress === DAI && r.sourceAddress === TREASURY_V2,
    );
    expect(daiRecords.length).toBe(1);
    expect(daiRecords[0].chainId).toBe(1);
    expect(daiRecords[0].blockchain).toBe("Ethereum");
    expect(daiRecords[0].balance).toBe("1000");
    expect(daiRecords[0].value).toBe("1000");
  });
});
