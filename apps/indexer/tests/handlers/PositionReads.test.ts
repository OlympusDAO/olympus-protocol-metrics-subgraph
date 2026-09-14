import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushTokenBalanceRecords } from "../../src/handlers/BlockHandlers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { ChainConfig, SerializedTokenRecord } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const VEFXS = addr("0xc8418af6358ffdda74e09ca9cc3fe03ca6adc5b0");
const VEFXS_ALLOCATOR = addr("0xde7b85f52577b113181921a7aa8fc0c22e309475");
const RLBTRFLY = addr("0x742B70151cd3Bc7ab598aAFF1d54B90c3ebC6027");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");

// 2022-12-01 snapshot. VeFXS.locked(VeFXS Allocator).amount at this block was
// 187,060.62 FXS while balanceOf (voting power) was 711,439 — the 3.8x
// overcount the old balanceOf read produced.
const BLOCK = 16_091_600n;
const TIMESTAMP = 1_669_852_800n;
const VEFXS_LOCKED = 187_060_624_368_797_277_330_234n;
// rlBTRFLY balanceOf(Treasury MS) at block 17,387,600.
const RLBTRFLY_BALANCE = 2_672_741_791_187_918_626_565n;

function buildMockClient(): PublicClient {
  return {
    chain: { id: 1 },
    readContract: async () => {
      throw new Error("balances must be read through effects, not the client");
    },
  } as unknown as PublicClient;
}

function buildMockContext() {
  const effect = vi.fn(
    async (
      _effectDef: unknown,
      input: {
        method?: string;
        contract?: string;
        wallet?: string;
        tokenAddress?: string;
        walletAddress?: string;
      },
    ) => {
      if (input.method === "veFxs.lockedAmount") {
        return addr(input.contract ?? "") === VEFXS && addr(input.wallet ?? "") === VEFXS_ALLOCATOR
          ? VEFXS_LOCKED.toString()
          : "0";
      }
      if (input.tokenAddress !== undefined && input.walletAddress !== undefined) {
        return addr(input.tokenAddress) === RLBTRFLY && addr(input.walletAddress) === DAO_WALLET
          ? RLBTRFLY_BALANCE.toString()
          : "0";
      }
      return "";
    },
  );
  const context = {
    TokenBalance: { get: async () => undefined },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect,
  } as unknown as EvmOnBlockContext;
  return { context, effect };
}

// Isolate the balance path: keep only the token under test and price it at
// $1 so the record's balance is the read amount.
function onlyToken(address: string): ChainConfig {
  return {
    ...ETHEREUM,
    tokens: ETHEREUM.tokens.filter((definition) => definition.address === address),
    liquidityHandlers: [{ kind: "stable", tokens: [address], id: "stable-test" }],
  };
}

describe("veFXS locked amount", () => {
  test("Ethereum config reads the lock for the VeFXS Allocator only", () => {
    const definition = ETHEREUM.tokens.find((value) => value.address === VEFXS);
    expect(definition?.positionRead).toEqual({
      method: "veFxs.lockedAmount",
      wallets: [VEFXS_ALLOCATOR],
    });
    expect(definition?.nonStandardBalance).toBeUndefined();
  });

  test("values the locked FXS, not voting power, and skips other wallets", async () => {
    const { context, effect } = buildMockContext();
    const records: SerializedTokenRecord[] = [];

    await pushTokenBalanceRecords(
      context,
      onlyToken(VEFXS),
      buildMockClient(),
      records,
      TIMESTAMP,
      BLOCK,
    );

    expect(records).toHaveLength(1);
    expect(records[0].sourceAddress).toBe(VEFXS_ALLOCATOR);
    expect(records[0].balance).toBe("187060.624368797277330234");
    expect(records[0].isLiquid).toBe(false);
    const lockReads = effect.mock.calls.filter(
      ([, input]) => (input as { method?: string }).method === "veFxs.lockedAmount",
    );
    expect(lockReads).toHaveLength(1);
  });
});

describe("rlBTRFLY on-chain balance", () => {
  test("reads balanceOf at the snapshot instead of the Transfer ledger", async () => {
    const definition = ETHEREUM.tokens.find((value) => value.address === RLBTRFLY);
    expect(definition?.nonStandardBalance).toBe(true);

    const { context } = buildMockContext();
    const records: SerializedTokenRecord[] = [];

    await pushTokenBalanceRecords(
      context,
      onlyToken(RLBTRFLY),
      buildMockClient(),
      records,
      TIMESTAMP,
      17_387_600n,
    );

    expect(records.map((r) => [r.sourceAddress, r.balance])).toEqual([
      [DAO_WALLET, "2672.741791187918626565"],
    ]);
  });
});
