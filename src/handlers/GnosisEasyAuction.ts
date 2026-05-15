import { BigDecimal, type EvmOnEventContext, indexer } from "envio";

import { toDecimal } from "../snapshot/math";

// Gnosis EasyAuction emits AuctionCleared when a bond auction closes. The
// `soldBiddingTokens` field is the OHM quantity that was actually sold
// (matched against bids). We update the matching GnosisAuction record with
// the cleared bid quantity + close timestamp so the snapshot can roll the
// auction from open/pre-minted to vesting/vested accounting.
//
// If we don't have a matching GnosisAuction row, the AuctionCleared belongs
// to an auction we don't track (Gnosis EasyAuction hosts non-Olympus
// auctions too); ignore silently — matches legacy.

type ClearedEvent = {
  chainId: number;
  block: { number: number; timestamp: number };
  params: {
    auctionId: bigint;
    soldAuctioningTokens: bigint;
    soldBiddingTokens: bigint;
    clearingPriceOrder: string;
  };
};

const OHM_DECIMALS = 9;

function auctionEntityId(chainId: number, marketId: bigint): string {
  return `${chainId}-${marketId.toString()}`;
}

export async function applyAuctionCleared(
  event: ClearedEvent,
  context: EvmOnEventContext,
): Promise<void> {
  const record = await context.GnosisAuction.get(
    auctionEntityId(event.chainId, event.params.auctionId),
  );
  if (!record) return;

  const bidQuantity = toDecimal(event.params.soldBiddingTokens, OHM_DECIMALS);
  context.GnosisAuction.set({
    ...record,
    bidQuantity: new BigDecimal(bidQuantity.toString(10)),
    auctionCloseTimestamp: BigInt(event.block.timestamp),
  });
}

indexer.onEvent(
  {
    contract: "GnosisEasyAuction",
    event: "AuctionCleared",
  },
  async ({ event, context }) => {
    await applyAuctionCleared(event as unknown as ClearedEvent, context);
  },
);
