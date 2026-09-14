import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushCoolerReceivables } from "../../src/handlers/CoolerLoans";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { SerializedTokenRecord } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const CLEARINGHOUSE_V1 = addr("0xD6A6E8d9e82534bD65821142fcCd91ec9cF31880");
const CLEARINGHOUSE_V1_1 = addr("0xE6343ad0675C9b8D3f32679ae6aDbA0766A2ab4c");

// 2023-10-18 snapshot. principalReceivables() read on-chain at this block:
// V1 held $17.80M and V1.1 $54.00M of live loans, weeks before the old
// Nov / Dec 2023 start blocks began counting either clearinghouse.
const BLOCK = 18_379_200n;
const TIMESTAMP = 1_697_587_200n;
const RECEIVABLES: Record<string, string> = {
  [CLEARINGHOUSE_V1]: "17800000000000000000000000",
  [CLEARINGHOUSE_V1_1]: "54000000000000000000000000",
};

function buildMockClient(): PublicClient {
  return {
    chain: { id: 1 },
    readContract: async () => {
      throw new Error("pushCoolerReceivables must read through effects, not the client");
    },
  } as unknown as PublicClient;
}

function buildMockContext(): EvmOnBlockContext {
  return {
    TokenBalance: { get: async () => undefined },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect: vi.fn(
      async (_effectDef: unknown, input: { feedAddress?: string; clearinghouse?: string }) => {
        if (input.feedAddress !== undefined) return 100_000_000n.toString(); // $1, 8 decimals
        if (input.clearinghouse !== undefined) {
          return RECEIVABLES[addr(input.clearinghouse)] ?? "";
        }
        return "";
      },
    ),
  } as unknown as EvmOnBlockContext;
}

describe("pushCoolerReceivables", () => {
  test("counts V1 and V1.1 loans from their Sep 2023 deployments", async () => {
    const records: SerializedTokenRecord[] = [];

    await pushCoolerReceivables(
      buildMockContext(),
      ETHEREUM,
      buildMockClient(),
      records,
      TIMESTAMP,
      BLOCK,
    );

    const bySource = Object.fromEntries(records.map((r) => [r.sourceAddress, r.value]));
    expect(bySource[CLEARINGHOUSE_V1]).toBe("17800000");
    expect(bySource[CLEARINGHOUSE_V1_1]).toBe("54000000");
  });

  test("V1 and V1.1 start blocks are their deployment blocks", () => {
    const startOf = (address: string) =>
      ETHEREUM.coolerClearinghouses?.find((c) => c.address === address)?.startBlock;
    expect(startOf(CLEARINGHOUSE_V1)).toBe(18_185_779);
    expect(startOf(CLEARINGHOUSE_V1_1)).toBe(18_234_505);
  });
});
