import type {
  BigDecimal,
  EvmOnEventContext,
  GnosisAuction,
  GnosisAuctionRoot,
} from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyGnosisAuctionLaunched } from "../../src/handlers/BondManager";

const ETHEREUM_CHAIN_ID = 1;
const TOKEN = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";

function buildContext(existingMarkets: bigint[] = []) {
  const rootSetSpy = vi.fn<(entity: GnosisAuctionRoot) => void>();
  const auctionSetSpy = vi.fn<(entity: GnosisAuction) => void>();
  const existingRoot: GnosisAuctionRoot | undefined =
    existingMarkets.length === 0
      ? undefined
      : {
          id: `${ETHEREUM_CHAIN_ID}`,
          chainId: ETHEREUM_CHAIN_ID,
          markets: existingMarkets,
        };
  const context = {
    GnosisAuctionRoot: {
      get: async () => existingRoot,
      set: rootSetSpy,
    },
    GnosisAuction: {
      get: async () => undefined,
      set: auctionSetSpy,
    },
  } as unknown as EvmOnEventContext;
  return { context, rootSetSpy, auctionSetSpy };
}

describe("applyGnosisAuctionLaunched", () => {
  test("creates GnosisAuction + appends to GnosisAuctionRoot on first launch", async () => {
    const { context, rootSetSpy, auctionSetSpy } = buildContext();
    await applyGnosisAuctionLaunched(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 16_500_000, timestamp: 1_700_000_000 },
        params: {
          marketId: 42n,
          auctionToken: TOKEN,
          capacity: 10_000_000_000n,
          bondTerm: 86_400n,
        },
      },
      context,
    );
    expect(rootSetSpy).toHaveBeenCalledTimes(1);
    expect(rootSetSpy.mock.calls[0]?.[0]).toMatchObject({
      id: `${ETHEREUM_CHAIN_ID}`,
      chainId: ETHEREUM_CHAIN_ID,
      markets: [42n],
    });
    expect(auctionSetSpy).toHaveBeenCalledTimes(1);
    const auction = auctionSetSpy.mock.calls[0]?.[0];
    expect(auction?.id).toBe(`${ETHEREUM_CHAIN_ID}-42`);
    expect(auction?.marketId).toBe(42n);
    expect(auction?.termSeconds).toBe(86_400n);
    expect(auction?.auctionOpenTimestamp).toBe(1_700_000_000n);
    expect(auction?.bidQuantity).toBeUndefined();
    expect(auction?.auctionCloseTimestamp).toBeUndefined();
    // capacity 10_000_000_000 at 9 decimals = 10 OHM
    expect((auction?.payoutCapacity as BigDecimal).toString()).toBe("10");
  });

  test("appends to existing GnosisAuctionRoot without duplicating", async () => {
    const { context, rootSetSpy } = buildContext([1n, 2n]);
    await applyGnosisAuctionLaunched(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 16_500_000, timestamp: 1_700_000_000 },
        params: { marketId: 2n, auctionToken: TOKEN, capacity: 1_000_000_000n, bondTerm: 86_400n },
      },
      context,
    );
    // marketId=2 already present, list should stay [1n, 2n]
    expect(rootSetSpy.mock.calls[0]?.[0].markets).toEqual([1n, 2n]);
  });
});
