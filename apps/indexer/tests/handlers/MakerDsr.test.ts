import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushMakerDsrRecords } from "../../src/handlers/MakerDsr";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr, dsrSharesToDai } from "../../src/snapshot/math";
import { getWalletAddressesForContract } from "../../src/snapshot/records";
import type { SerializedTokenRecord } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const DAI = addr("0x6b175474e89094c44da98b954eedeac495271d0f");
const MAKER_POT = addr("0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7");
const DSR_ALLOCATOR_PROXY = addr("0x5db0761487e26B555F5Bfd5E40F4CBC3E1a7d11E");
const TRSRY = addr("0xa8687A15D4BE32CC8F0a8a7B9704a4C3993D9613");

// 2023-09-16 snapshot. pie/chi read on-chain from the Pot at this block for
// the DSR Allocator's DSProxy — roughly $167.6M of treasury DAI that the
// indexer was dropping from market value and liquid backing.
const BLOCK = 18_151_200n;
const TIMESTAMP = 1_694_897_771n;
const PROXY_PIE = 161_969_100_645_723_977_440_235_537n;
const PROXY_CHI = 1_034_689_385_171_610_718_292_191_665n;

function buildMockClient(): PublicClient {
  return {
    chain: { id: 1 },
    readContract: async () => {
      throw new Error("pushMakerDsrRecords must read through effects, not the client");
    },
  } as unknown as PublicClient;
}

// DSR balances are keyed by wallet; any wallet not listed reads zero. The
// Chainlink read returns $1 (8 decimals) so value === balance.
function buildMockContext(dsrBalances: Record<string, string>) {
  const effect = vi.fn(
    async (_effectDef: unknown, input: { feedAddress?: string; pot?: string; wallet?: string }) => {
      if (input.feedAddress !== undefined) return 100_000_000n.toString();
      if (input.pot !== undefined && input.wallet !== undefined) {
        return dsrBalances[addr(input.wallet)] ?? "0";
      }
      return "";
    },
  );
  const context = {
    TokenBalance: { get: async () => undefined },
    Univ2PoolState: { get: async () => undefined },
    Univ3PoolState: { get: async () => undefined },
    BalancerPoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect,
  } as unknown as EvmOnBlockContext;
  return { context, effect };
}

describe("dsrSharesToDai", () => {
  test("multiplies pie (wad) by chi (ray) into DAI wad", () => {
    expect(dsrSharesToDai(100n * 10n ** 18n, 105n * 10n ** 25n)).toBe(105n * 10n ** 18n);
  });

  test("truncates sub-wei remainders like the Pot does", () => {
    expect(dsrSharesToDai(1n, 10n ** 27n + 1n)).toBe(1n);
    expect(dsrSharesToDai(0n, PROXY_CHI)).toBe(0n);
  });
});

describe("pushMakerDsrRecords", () => {
  test("Ethereum config points at the Maker Pot and treats the DSR proxy as a DAI wallet", () => {
    expect(ETHEREUM.makerDsr?.pot).toBe(MAKER_POT);
    expect(ETHEREUM.makerDsr?.depositToken).toBe(DAI);
    expect(getWalletAddressesForContract(ETHEREUM, DAI)).toContain(DSR_ALLOCATOR_PROXY);
  });

  test("emits a liquid DAI - Deposited in DSR record for the DSR Allocator proxy", async () => {
    const { context } = buildMockContext({
      [DSR_ALLOCATOR_PROXY]: dsrSharesToDai(PROXY_PIE, PROXY_CHI).toString(),
    });
    const records: SerializedTokenRecord[] = [];

    await pushMakerDsrRecords(context, ETHEREUM, buildMockClient(), records, TIMESTAMP, BLOCK);

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record.token).toBe("DAI - Deposited in DSR");
    expect(record.tokenAddress).toBe(DAI);
    expect(record.source).toBe("Maker DSR Allocator Proxy");
    expect(record.sourceAddress).toBe(DSR_ALLOCATOR_PROXY);
    expect(record.date).toBe("2023-09-16");
    expect(record.category).toBe("Stable");
    expect(record.isLiquid).toBe(true);
    expect(Number(record.balance)).toBeGreaterThan(167_500_000);
    expect(Number(record.balance)).toBeLessThan(167_700_000);
    expect(record.value).toBe(record.balance);
    expect(record.valueExcludingOhm).toBe(record.balance);
  });

  test("skips wallets whose read is zero or failed", async () => {
    const { context } = buildMockContext({
      [DSR_ALLOCATOR_PROXY]: (1_000n * 10n ** 18n).toString(),
      [TRSRY]: "",
    });
    const records: SerializedTokenRecord[] = [];

    await pushMakerDsrRecords(context, ETHEREUM, buildMockClient(), records, TIMESTAMP, BLOCK);

    expect(records.map((r) => r.sourceAddress)).toEqual([DSR_ALLOCATOR_PROXY]);
    expect(records[0].balance).toBe("1000");
  });

  test("does nothing before the DSR Allocator was deployed", async () => {
    const { context, effect } = buildMockContext({
      [DSR_ALLOCATOR_PROXY]: (1_000n * 10n ** 18n).toString(),
    });
    const records: SerializedTokenRecord[] = [];
    const beforeDeploy = BigInt(ETHEREUM.makerDsr?.startBlock ?? 0) - 1n;

    await pushMakerDsrRecords(
      context,
      ETHEREUM,
      buildMockClient(),
      records,
      TIMESTAMP,
      beforeDeploy,
    );

    expect(records).toHaveLength(0);
    expect(effect).not.toHaveBeenCalled();
  });
});
