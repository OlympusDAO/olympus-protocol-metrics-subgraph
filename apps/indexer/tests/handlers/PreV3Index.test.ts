import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import {
  readNextOhmDistribution,
  readPreV3SOhmState,
  readSOhmCirculatingSupply,
} from "../../src/effects";
import { updateGlobalMetricSnapshot } from "../../src/handlers/BlockHandlers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { SerializedTokenSupply } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const SOHM_V3 = addr("0x04906695D6D12CF5459975d7C3C03356E4Ccd460");
const TIMESTAMP = 1_628_600_000n; // 2021-08-10

type Written = Record<string, { toString(): string }>;

function run(options: {
  block: bigint;
  v3Index?: bigint;
  preV3?: { index: string; circulatingSupply: string };
  distribution: string;
}) {
  const written: Record<string, Written> = {};
  const chainValues: Record<string, unknown> = {};
  const effect = vi.fn(async (definition: unknown) => {
    if (definition === readPreV3SOhmState) return options.preV3;
    if (definition === readNextOhmDistribution) return options.distribution;
    if (definition === readSOhmCirculatingSupply) return "6000000000000000";
    return "0";
  });
  const context = {
    OhmIndexState: {
      get: async (id: string) =>
        id === `1-${SOHM_V3}` && options.v3Index !== undefined
          ? { index: options.v3Index }
          : undefined,
    },
    GlobalMetricSnapshot: {
      get: async () => undefined,
      set: (entity: { id: string } & Written) => {
        written[entity.id] = entity;
      },
    },
    ChainMetricValues: {
      set: (entity: { id: string }) => {
        chainValues[entity.id] = entity;
      },
      getWhere: async () => Object.values(chainValues),
    },
    ChainSupplyCategory: { set: vi.fn() },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    Erc20Supply: { get: async () => undefined },
    TokenBalance: { get: async () => undefined },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect,
  } as unknown as EvmOnBlockContext;
  const supplies: SerializedTokenSupply[] = [
    {
      id: "total",
      chainId: 1,
      blockchain: "Ethereum",
      block: options.block.toString(),
      timestamp: TIMESTAMP.toString(),
      date: "2021-08-10",
      token: "OHM V1",
      tokenAddress: addr("0x383518188c0c6d7730d91b2c03a03c837814a899"),
      type: "Total Supply",
      balance: "1000000",
      supplyBalance: "1000000",
    },
  ];
  return {
    effect,
    written: async () => {
      await updateGlobalMetricSnapshot(
        context,
        ETHEREUM,
        {} as PublicClient,
        options.block,
        TIMESTAMP,
        [],
        supplies,
      );
      return written["2021-08-10"];
    },
  };
}

describe("index and staked OHM before sOHM v3", () => {
  test("without a v3 OhmIndexState, Ethereum publishes the sOHM v1/v2 index and staked OHM", async () => {
    // Block 13,000,000: sOHM v2 index 10.48974378, staked 896,974 + 5,470.
    const { effect, written } = run({
      block: 13_000_000n,
      preV3: { index: "10489743780", circulatingSupply: "902444377137496" },
      distribution: "4259422481133",
    });
    const row = await written();
    expect(row.ohmIndex.toString()).toBe("10.48974378");
    expect(row.sOhmCirculatingSupply.toString()).toBe("902444.377137496");
    // 4,259.42 OHM next rebase over 902,444 staked: 0.472% per epoch.
    expect(Number(row.ohmApy.toString())).toBeCloseTo(
      ((1 + 4_259.422481133 / 902_444.377137496) ** 1095 - 1) * 100,
      0,
    );
    expect(effect).toHaveBeenCalledWith(readPreV3SOhmState, {
      chainId: 1,
      sOhmV1: addr("0x31932e6e45012476ba3a3a4953cba62aee77fbbe"),
      sOhmV2: addr("0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f"),
      atBlock: 13_000_000,
    });
    expect(effect).not.toHaveBeenCalledWith(readSOhmCirculatingSupply, expect.anything());
  });

  test("backing per gOHM uses that index", async () => {
    const { written } = run({
      block: 13_000_000n,
      preV3: { index: "10000000000", circulatingSupply: "500000000000000" },
      distribution: "0",
    });
    const row = await written();
    // 1,000,000 backed OHM / index 10.
    expect(row.gOhmBackedSupply.toString()).toBe("100000");
  });

  test("APY is 0, not NaN, before the first distribution", async () => {
    const { written } = run({
      block: 12_098_400n,
      preV3: { index: "1000000000", circulatingSupply: "22295523706701" },
      distribution: "0",
    });
    expect((await written()).ohmApy.toString()).toBe("0");
  });

  test("APY is 0, not NaN, with nothing staked yet", async () => {
    const { written } = run({
      block: 12_086_400n,
      preV3: { index: "1000000000", circulatingSupply: "0" },
      distribution: "1000000000",
    });
    expect((await written()).ohmApy.toString()).toBe("0");
  });

  test("once sOHM v3 has rebased, OhmIndexState is used exactly as before", async () => {
    const { effect, written } = run({
      block: 13_812_000n,
      v3Index: 47_169_244_994n,
      distribution: "0",
    });
    const row = await written();
    expect(row.ohmIndex.toString()).toBe("47.169244994");
    expect(row.sOhmCirculatingSupply.toString()).toBe("6000000");
    expect(effect).not.toHaveBeenCalledWith(readPreV3SOhmState, expect.anything());
  });
});
