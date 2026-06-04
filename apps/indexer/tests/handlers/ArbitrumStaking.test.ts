import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/pricing", () => ({
  getPrice: vi.fn(),
}));

import { getPrice } from "../../src/pricing";
import { pushArbitrumStakingRecords } from "../../src/handlers/ArbitrumStaking";
import { ARBITRUM, ERC20_MAGIC } from "../../src/snapshot/chains/arbitrum";
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
});
