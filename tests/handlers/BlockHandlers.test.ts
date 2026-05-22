import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { SerializedTokenRecord, SerializedTokenSupply } from "../../src/snapshot/types";
import {
  pushTokenBalanceRecords,
  pushTotalSupply,
  pushTreasuryOhm,
  updateGlobalMetricSnapshot,
} from "../../src/handlers/BlockHandlers";

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
  tokenBalances?: { tokenAddress: string; walletAddress: string; balance: bigint }[];
  ohmIndex?: { chainId: number; sOhmAddress: string; index: bigint };
  erc20Supply?: { chainId: number; tokenAddress: string; totalSupply: bigint };
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
  const balanceSeeds = [
    ...(seed.tokenBalance ? [seed.tokenBalance] : []),
    ...(seed.tokenBalances ?? []),
  ];
  for (const b of balanceSeeds) {
    const id = `${seed.chainId}-${addr(b.tokenAddress)}-${addr(b.walletAddress)}`;
    tokenBalances.set(id, {
      chainId: seed.chainId,
      tokenAddress: addr(b.tokenAddress),
      walletAddress: addr(b.walletAddress),
      balance: b.balance,
      updatedAtBlock: BLOCK,
    });
  }
  const ohmIndexStates = new Map<string, unknown>();
  if (seed.ohmIndex) {
    ohmIndexStates.set(`${seed.ohmIndex.chainId}-${addr(seed.ohmIndex.sOhmAddress)}`, {
      chainId: seed.ohmIndex.chainId,
      sOhmAddress: addr(seed.ohmIndex.sOhmAddress),
      index: seed.ohmIndex.index,
    });
  }
  const erc20Supplies = new Map<string, unknown>();
  if (seed.erc20Supply) {
    erc20Supplies.set(`${seed.erc20Supply.chainId}-${addr(seed.erc20Supply.tokenAddress)}`, {
      chainId: seed.erc20Supply.chainId,
      tokenAddress: addr(seed.erc20Supply.tokenAddress),
      totalSupply: seed.erc20Supply.totalSupply,
    });
  }

  return {
    OhmIndexState: { get: async (id: string) => ohmIndexStates.get(id) },
    TokenBalance: { get: async (id: string) => tokenBalances.get(id) },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async (id: string) => erc20Supplies.get(id) },
    NativeBalanceState: { set: vi.fn() },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect: vi.fn(
      async (
        _effectDef: unknown,
        input: {
          chainId?: number;
          feedAddress?: string;
          tokenAddress?: string;
          walletAddress?: string;
        },
      ) => {
        if (input.feedAddress !== undefined && input.chainId !== undefined) {
          const stateId = `${input.chainId}-${input.feedAddress.toLowerCase()}`;
          const state = chainlinkStates.get(stateId) as { answer?: bigint } | undefined;
          return (state?.answer ?? 0n).toString();
        }
        // readErc20BalanceOf — mirror the seeded TokenBalance so tests that
        // don't care about the standard-vs-non-standard distinction still
        // produce a record. The seed represents "on-chain balance" since
        // tests don't simulate the Transfer-event drift.
        if (
          input.tokenAddress !== undefined &&
          input.walletAddress !== undefined &&
          input.chainId !== undefined
        ) {
          const id = `${input.chainId}-${addr(input.tokenAddress)}-${addr(input.walletAddress)}`;
          const state = tokenBalances.get(id) as { balance?: bigint } | undefined;
          return (state?.balance ?? 0n).toString();
        }
        return "";
      },
    ),
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

  test("Fantom: emits Treasury TokenSupply in OHM-equivalent units (gOHM × ohmIndex), not raw gOHM", async () => {
    // Regression test for the 2026-05 1.13B phantom-supply bug. On Fantom
    // `config.ohmToken` is gOHM (18 decimals); the legacy code hardcoded 9
    // decimals when reading the wallet balance, inflating amounts by 1e9.
    // After the fix we (a) read the actual token decimals and (b) multiply
    // by the canonical Ethereum sOHM-V3 rebase index so the emitted
    // supplyBalance is in OHM-equivalent units consistent with the rollup.
    const FANTOM = CHAIN_CONFIGS[250];
    const GOHM_FANTOM = "0x91fa20244fb509e8289ca630e5db3e9166233fdc";
    const SOHM_V3 = "0x04906695d6d12cf5459975d7c3c03356e4ccd460";
    const wallet = FANTOM.circulatingSupplyWallets[0];

    const ONE_GOHM = 10n ** 18n; // 1 gOHM in raw units
    const INDEX_270 = 270_000_000_000n; // 270 × 1e9 (sOHM V3 stores index at 9 decimals)

    const context = buildMockContext({
      chainId: 250,
      tokenBalance: {
        tokenAddress: GOHM_FANTOM,
        walletAddress: wallet,
        balance: 5n * ONE_GOHM, // 5 gOHM held in cross-chain wallet
      },
      ohmIndex: { chainId: 1, sOhmAddress: SOHM_V3, index: INDEX_270 },
    });

    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(context, FANTOM, supplies, TIMESTAMP, BLOCK);

    expect(supplies).toHaveLength(1);
    const row = supplies[0];
    expect(row.type).toBe("Treasury");
    expect(row.blockchain).toBe("Fantom");
    expect(row.token).toBe("Governance OHM (gOHM)");
    // 5 gOHM × 270 = 1350 OHM-equivalent. Multiplier -1 flips the
    // contribution: balance field is the raw positive amount, supplyBalance
    // is negated so it subtracts from circulating supply when summed.
    expect(row.balance).toBe("1350");
    expect(row.supplyBalance).toBe("-1350");
  });

  // (Removed test "Fantom: pushTreasuryOhm bypasses drifting TokenBalance for
  // nonStandardBalance gOHM" — it exercised the snapshot-time balanceOf
  // workaround for Cross-Chain Fantom gOHM. With BackfillTokenBalances now
  // seeding the wallet's pre-existing balance at chain start, the TokenBalance
  // entity stays correct via plain Transfer accounting and the
  // nonStandardBalance flag has been removed from Fantom gOHM. The bypass
  // path itself is still tested for tokens that legitimately need it — e.g.
  // Fantom DAI/FRAX which fall into Class B.)

  test("Fantom: skips Treasury emission when ohmIndex isn't available yet", async () => {
    // If Ethereum's sOHM-V3 OhmIndexState hasn't been populated (early
    // backfill or a missing event), gOHM amounts cannot be converted to
    // OHM-equivalent. Skipping is correct — emitting the raw gOHM amount
    // would poison the OHM-denominated cross-chain rollup.
    const FANTOM = CHAIN_CONFIGS[250];
    const GOHM_FANTOM = "0x91fa20244fb509e8289ca630e5db3e9166233fdc";
    const wallet = FANTOM.circulatingSupplyWallets[0];

    const context = buildMockContext({
      chainId: 250,
      tokenBalance: {
        tokenAddress: GOHM_FANTOM,
        walletAddress: wallet,
        balance: 5n * 10n ** 18n,
      },
      // no ohmIndex seeded
    });

    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(context, FANTOM, supplies, TIMESTAMP, BLOCK);
    expect(supplies).toHaveLength(0);
  });

  test("Arbitrum: emits Treasury TokenSupply in OHM units (multiplier = 1, no index lookup)", async () => {
    // On OHM-native chains the multiplier is 1 — no OhmIndexState read
    // required — so the path stays untouched from legacy behavior.
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const OHM_ARBITRUM = ARBITRUM.ohmToken;
    const wallet = ARBITRUM.circulatingSupplyWallets[0];

    const context = buildMockContext({
      chainId: 42161,
      tokenBalance: {
        tokenAddress: OHM_ARBITRUM,
        walletAddress: wallet,
        balance: 100_000_000_000n, // 100 OHM (9 decimals)
      },
      // intentionally no ohmIndex — must not be required for OHM chains
    });

    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(context, ARBITRUM, supplies, TIMESTAMP, BLOCK);

    expect(supplies).toHaveLength(1);
    expect(supplies[0].balance).toBe("100");
    expect(supplies[0].supplyBalance).toBe("-100");
  });

  test("Arbitrum: emits Total Supply TokenSupply from Erc20Supply entity in OHM units", async () => {
    const ARBITRUM = CHAIN_CONFIGS[42161];
    const OHM_ARBITRUM = ARBITRUM.ohmToken;

    const context = buildMockContext({
      chainId: 42161,
      erc20Supply: {
        chainId: 42161,
        tokenAddress: OHM_ARBITRUM,
        totalSupply: 1_000_000_000_000n, // 1000 OHM (9 decimals)
      },
    });

    const supplies: SerializedTokenSupply[] = [];
    await pushTotalSupply(context, ARBITRUM, supplies, TIMESTAMP, BLOCK);

    expect(supplies).toHaveLength(1);
    expect(supplies[0].type).toBe("Total Supply");
    expect(supplies[0].balance).toBe("1000");
    expect(supplies[0].supplyBalance).toBe("1000");
  });

  test("GlobalMetricSnapshot: non-Ethereum writes preserve Ethereum-only canonical fields", async () => {
    // Regression for the 2026-05 intermittent-zero-ohmPrice bug.
    // GlobalMetricSnapshot is keyed by date so all chains write the same row.
    // Canonical fields (ohmIndex, ohmPrice, sOhmCirculatingSupply, ohmApy,
    // gOhmPrice, marketCap, sOhmTotalValueLocked) are knowable only on
    // Ethereum. The fix preserves them from any prior write so non-Ethereum
    // chains writing later don't clobber them with zeros.
    const POLYGON = CHAIN_CONFIGS[137];
    const date = "2026-05-17";

    // Existing snapshot stand-in: Ethereum already wrote canonical values
    // earlier today. We assert the non-Ethereum write below preserves them.
    const writtenSnapshots: Record<string, unknown> = {};
    const writtenChainValues: Record<string, unknown> = {};
    const existingSnapshot = {
      id: date,
      date,
      updatedAtTimestamp: 1779000000n,
      crossChainComplete: true,
      chainsIndexed: ["Ethereum"],
      chainsMissing: [],
      ohmTotalSupply: "19000000",
      ohmCirculatingSupply: "15000000",
      ohmFloatingSupply: "15000000",
      ohmBackedSupply: "15000000",
      gOhmBackedSupply: "55000",
      treasuryMarketValue: "30000000",
      treasuryLiquidBacking: "28000000",
      ohmIndex: "270",
      ohmApy: "0",
      ohmPrice: "19.5",
      gOhmPrice: "5265",
      sOhmCirculatingSupply: "100000",
      sOhmTotalValueLocked: "1950000",
      marketCap: "292500000",
      treasuryLiquidBackingPerOhmFloating: "1.86",
      treasuryLiquidBackingPerOhmBacked: "1.86",
      treasuryLiquidBackingPerGOhmBacked: "509.09",
    };

    const context = {
      OhmIndexState: { get: async () => undefined },
      GlobalMetricSnapshot: {
        get: async (id: string) => (id === date ? existingSnapshot : undefined),
        set: (entity: { id: string }) => {
          writtenSnapshots[entity.id] = entity;
        },
      },
      ChainMetricValues: {
        set: (entity: { id: string }) => {
          writtenChainValues[entity.id] = entity;
        },
        // Return the Ethereum row we synthesize as if it had been written by
        // Ethereum's prior snapshot, plus this Polygon row when it appears.
        getWhere: async () => {
          const eth = {
            id: `1-${date}`,
            chainId: 1,
            blockchain: "Ethereum",
            date,
            block: 25_113_600n,
            timestamp: 1779005147n,
            ohmTotalSupply: "19000000",
            ohmCirculatingSupply: "15000000",
            ohmFloatingSupply: "15000000",
            ohmBackedSupply: "15000000",
            treasuryMarketValue: "30000000",
            treasuryLiquidBacking: "28000000",
          };
          const fromWritten = Object.values(writtenChainValues) as Array<{
            chainId: number;
            blockchain: string;
            date: string;
            block: bigint;
            timestamp: bigint;
            ohmTotalSupply: { toString(): string };
            ohmCirculatingSupply: { toString(): string };
            ohmFloatingSupply: { toString(): string };
            ohmBackedSupply: { toString(): string };
            treasuryMarketValue: { toString(): string };
            treasuryLiquidBacking: { toString(): string };
          }>;
          return [eth, ...fromWritten];
        },
      },
      ChainSupplyCategory: { set: vi.fn() },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect: vi.fn(async () => ""),
    } as unknown as Parameters<typeof updateGlobalMetricSnapshot>[0];

    const records: SerializedTokenRecord[] = [
      {
        id: `137-${date}/87022400/Cross-Chain Polygon/Wrapped ETH`,
        chainId: 137,
        blockchain: "Polygon",
        block: "87022400",
        timestamp: "1779028908",
        date,
        token: "Wrapped ETH",
        tokenAddress: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        source: "Cross-Chain Polygon",
        sourceAddress: "0x0000000000000000000000000000000000000001",
        rate: "3000",
        balance: "0.1",
        multiplier: "1",
        value: "300",
        valueExcludingOhm: "300",
        category: "Volatile",
        isLiquid: true,
        isBluechip: true,
      },
    ];

    await updateGlobalMetricSnapshot(
      context,
      POLYGON,
      buildMockClient(137),
      87_022_400n,
      1779028908n,
      records,
      [],
    );

    const written = writtenSnapshots[date] as {
      ohmIndex: { toString(): string };
      ohmPrice: { toString(): string };
      gOhmPrice: { toString(): string };
      marketCap: { toString(): string };
      sOhmCirculatingSupply: { toString(): string };
      sOhmTotalValueLocked: { toString(): string };
      ohmApy: { toString(): string };
      treasuryMarketValue: { toString(): string };
    };
    expect(written).toBeDefined();
    // Canonical inputs preserved from existingSnapshot.
    expect(written.ohmPrice.toString()).toBe("19.5");
    expect(written.sOhmCirculatingSupply.toString()).toBe("100000");
    expect(written.ohmApy.toString()).toBe("0");
    // ohmIndex would also be preserved here (test mock returns undefined for
    // OhmIndexState; the preserve-from-existing path takes over for the
    // derived gOhmPrice/marketCap). Note: ohmIndex itself comes from the
    // cross-chain OhmIndexState read which is mocked-undefined in this
    // test, so it falls to 0 — derived values reflect that.
    // gOhmPrice = ohmPrice (preserved) × ohmIndex (cross-chain, here 0) = 0
    // marketCap = ohmPrice (preserved) × aggregate.ohmCirculatingSupply
    // Aggregate sums Ethereum row (15M) + Polygon row (0 — no supplies passed).
    expect(written.marketCap.toString()).toBe("292500000"); // 19.5 × 15_000_000
    // sOhmTotalValueLocked = sOhmCirculatingSupply (preserved) × ohmPrice (preserved)
    expect(written.sOhmTotalValueLocked.toString()).toBe("1950000"); // 100000 × 19.5
    // Aggregate updated to include Polygon — treasuryMarketValue increased by 300.
    expect(written.treasuryMarketValue.toString()).toBe("30000300");
  });

  test("GlobalMetricSnapshot: when no existing snapshot, non-Ethereum write leaves canonical fields zero", async () => {
    // First snapshot of the day from a non-Ethereum chain. No prior data to
    // preserve — canonical fields remain zero until Ethereum runs and the
    // next non-Ethereum write picks them up.
    const POLYGON = CHAIN_CONFIGS[137];
    const date = "2026-05-18";
    const writtenSnapshots: Record<string, unknown> = {};
    const writtenChainValues: Record<string, unknown> = {};

    const context = {
      OhmIndexState: { get: async () => undefined },
      GlobalMetricSnapshot: {
        get: async () => undefined, // nothing exists yet
        set: (entity: { id: string }) => {
          writtenSnapshots[entity.id] = entity;
        },
      },
      ChainMetricValues: {
        set: (entity: { id: string }) => {
          writtenChainValues[entity.id] = entity;
        },
        getWhere: async () => Object.values(writtenChainValues),
      },
      ChainSupplyCategory: { set: vi.fn() },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect: vi.fn(async () => ""),
    } as unknown as Parameters<typeof updateGlobalMetricSnapshot>[0];

    const records: SerializedTokenRecord[] = [
      {
        id: `137-${date}/1/x/Wrapped ETH`,
        chainId: 137,
        blockchain: "Polygon",
        block: "1",
        timestamp: "1779100000",
        date,
        token: "Wrapped ETH",
        tokenAddress: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        source: "Cross-Chain Polygon",
        sourceAddress: "0x0000000000000000000000000000000000000001",
        rate: "3000",
        balance: "0.1",
        multiplier: "1",
        value: "300",
        valueExcludingOhm: "300",
        category: "Volatile",
        isLiquid: true,
        isBluechip: true,
      },
    ];

    await updateGlobalMetricSnapshot(
      context,
      POLYGON,
      buildMockClient(137),
      1n,
      1779100000n,
      records,
      [],
    );

    const written = writtenSnapshots[date] as {
      ohmIndex: { toString(): string };
      ohmPrice: { toString(): string };
      marketCap: { toString(): string };
    };
    expect(written).toBeDefined();
    expect(written.ohmPrice.toString()).toBe("0");
    expect(written.ohmIndex.toString()).toBe("0");
    expect(written.marketCap.toString()).toBe("0");
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
