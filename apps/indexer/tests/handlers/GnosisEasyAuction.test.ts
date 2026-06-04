import { BigDecimal, type EvmOnEventContext, type GnosisAuction } from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyAuctionCleared } from "../../src/handlers/GnosisEasyAuction";

const ETHEREUM_CHAIN_ID = 1;

function buildContext(record: GnosisAuction | undefined) {
  const setSpy = vi.fn<(entity: GnosisAuction) => void>();
  const context = {
    GnosisAuction: {
      get: async () => record,
      set: setSpy,
    },
  } as unknown as EvmOnEventContext;
  return { context, setSpy };
}

describe("applyAuctionCleared", () => {
  test("fills bidQuantity + auctionCloseTimestamp on matching GnosisAuction", async () => {
    const record: GnosisAuction = {
      id: `${ETHEREUM_CHAIN_ID}-42`,
      chainId: ETHEREUM_CHAIN_ID,
      marketId: 42n,
      auctionOpenTimestamp: 1_700_000_000n,
      payoutCapacity: new BigDecimal("10"),
      termSeconds: 86_400n,
      bidQuantity: undefined,
      auctionCloseTimestamp: undefined,
    };
    const { context, setSpy } = buildContext(record);
    await applyAuctionCleared(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 16_500_000, timestamp: 1_700_086_400 },
        params: {
          auctionId: 42n,
          soldAuctioningTokens: 0n,
          soldBiddingTokens: 5_500_000_000n, // 5.5 OHM at 9 decimals
          clearingPriceOrder: `0x${"0".repeat(64)}`,
        },
      },
      context,
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    const updated = setSpy.mock.calls[0]?.[0];
    expect((updated?.bidQuantity as BigDecimal).toString()).toBe("5.5");
    expect(updated?.auctionCloseTimestamp).toBe(1_700_086_400n);
  });

  test("no-ops when GnosisAuction record is not found (non-Olympus auction)", async () => {
    const { context, setSpy } = buildContext(undefined);
    await applyAuctionCleared(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 16_500_000, timestamp: 1_700_086_400 },
        params: {
          auctionId: 9999n,
          soldAuctioningTokens: 0n,
          soldBiddingTokens: 1n,
          clearingPriceOrder: `0x${"0".repeat(64)}`,
        },
      },
      context,
    );
    expect(setSpy).not.toHaveBeenCalled();
  });
});
