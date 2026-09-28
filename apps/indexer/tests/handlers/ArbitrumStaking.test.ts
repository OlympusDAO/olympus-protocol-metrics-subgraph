import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/pricing", () => ({
  getPrice: vi.fn(),
}));

import { pushArbitrumStakingRecords } from "../../src/handlers/ArbitrumStaking";
import { getPrice } from "../../src/pricing";
import {
  ARBITRUM,
  ERC20_JONES,
  ERC20_MAGIC,
  JONES_TREASURY_EXCLUSION_BLOCK,
} from "../../src/snapshot/chains/arbitrum";
import type { SerializedTokenRecord } from "../../src/snapshot/types";

const BLOCK = 500_000_000n;
const TIMESTAMP = 1_700_000_000n;

function contextWithTreasureDeposits(amounts: bigint[]): EvmOnBlockContext {
  return {
    JonesStakingPosition: {
      get: async () => undefined,
    },
    TreasureDeposit: {
      getWhere: async () =>
        amounts.map((amount, index) => ({
          id: `${index}`,
          chainId: ARBITRUM.chainId,
          walletAddress: ARBITRUM.protocolAddresses[0],
          amount,
        })),
    },
  } as unknown as EvmOnBlockContext;
}

describe("Arbitrum staking handlers", () => {
  beforeEach(() => {
    vi.mocked(getPrice).mockReset();
  });

  test("emits no Treasure staking records when MAGIC has no price", async () => {
    vi.mocked(getPrice).mockResolvedValue({
      price: new BigNumber(0),
      liquidity: new BigNumber(0),
    });
    const records: SerializedTokenRecord[] = [];

    await pushArbitrumStakingRecords(
      contextWithTreasureDeposits([1_000_000_000_000_000_000n, 2_000_000_000_000_000_000n]),
      ARBITRUM,
      records,
      TIMESTAMP,
      BLOCK,
    );

    expect(records).toHaveLength(0);
  });

  test("uses the MAGIC price to value every Treasure staking deposit", async () => {
    vi.mocked(getPrice).mockResolvedValue({
      price: new BigNumber(2),
      liquidity: new BigNumber(1),
    });
    const records: SerializedTokenRecord[] = [];

    await pushArbitrumStakingRecords(
      contextWithTreasureDeposits([1_000_000_000_000_000_000n, 2_500_000_000_000_000_000n]),
      ARBITRUM,
      records,
      TIMESTAMP,
      BLOCK,
    );

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.tokenAddress)).toEqual([ERC20_MAGIC, ERC20_MAGIC]);
    expect(records.map((record) => record.balance)).toEqual(["1", "2.5"]);
    expect(records.map((record) => record.value)).toEqual(["2", "5"]);
    expect(records.map((record) => record.isLiquid)).toEqual([false, false]);
  });

  test("does not read or emit staked JONES at or after its treasury cutoff", async () => {
    const getJonesPosition = vi.fn(async () => ({ amount: 100_000_000_000_000_000_000n }));
    const context = {
      JonesStakingPosition: {
        get: getJonesPosition,
      },
      TreasureDeposit: { getWhere: async () => [] },
    } as unknown as EvmOnBlockContext;
    for (const block of [
      BigInt(JONES_TREASURY_EXCLUSION_BLOCK),
      BigInt(JONES_TREASURY_EXCLUSION_BLOCK) + 1n,
    ]) {
      const records: SerializedTokenRecord[] = [];
      await pushArbitrumStakingRecords(context, ARBITRUM, records, TIMESTAMP, block);
      expect(records).toHaveLength(0);
    }
    expect(getJonesPosition).not.toHaveBeenCalled();
    expect(getPrice).not.toHaveBeenCalled();
  });
  test.each([
    [12_000_000n, "0.83", "166"],
    [130_482_706n, "0.83", "166"],
    [130_482_707n, "0", "0"],
    [BigInt(JONES_TREASURY_EXCLUSION_BLOCK) - 1n, "0", "0"],
  ])("preserves staked JONES history at block %s", async (block, multiplier, valueExcludingOhm) => {
    vi.mocked(getPrice).mockResolvedValue({ price: new BigNumber(2), liquidity: new BigNumber(1) });
    const context = {
      JonesStakingPosition: { get: async () => ({ amount: 100_000_000_000_000_000_000n }) },
      TreasureDeposit: { getWhere: async () => [] },
    } as unknown as EvmOnBlockContext;
    const records: SerializedTokenRecord[] = [];
    await pushArbitrumStakingRecords(context, ARBITRUM, records, TIMESTAMP, block);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      tokenAddress: ERC20_JONES,
      balance: "100",
      value: "200",
      multiplier,
      valueExcludingOhm,
      isLiquid: true,
    });
  });

  test("does not emit pre-start or zero JONES stakes", async () => {
    const get = vi.fn(async () => ({ amount: 0n }));
    const context = {
      JonesStakingPosition: { get },
      TreasureDeposit: { getWhere: async () => [] },
    } as unknown as EvmOnBlockContext;
    for (const block of [1n, 12_000_000n]) {
      const records: SerializedTokenRecord[] = [];
      await pushArbitrumStakingRecords(context, ARBITRUM, records, TIMESTAMP, block);
      expect(records).toHaveLength(0);
    }
    expect(get).toHaveBeenCalledTimes(1);
    expect(getPrice).not.toHaveBeenCalled();
  });
});
