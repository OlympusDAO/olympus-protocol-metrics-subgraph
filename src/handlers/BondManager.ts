import {
  BigDecimal,
  type EvmOnEventContext,
  type GnosisAuction,
  type GnosisAuctionRoot,
  indexer,
} from "envio";

import { toDecimal } from "../snapshot/math";

// BondManager.GnosisAuctionLaunched marks the opening of a new Olympus V1
// bond auction. We mirror legacy GnosisAuction.ts:
//   - Append the marketId to the per-chain GnosisAuctionRoot singleton
//   - Create a GnosisAuction record with capacity (OHM amount, 9 decimals)
//     and bond term (seconds)
// AuctionCleared fills in bidQuantity + auctionCloseTimestamp later via a
// separate handler.

type LaunchedEvent = {
  chainId: number;
  block: { number: number; timestamp: number };
  params: {
    marketId: bigint;
    auctionToken: string;
    capacity: bigint;
    bondTerm: bigint | number;
  };
};

const OHM_DECIMALS = 9;

function rootId(chainId: number): string {
  // Just the chainId — the "GnosisAuction-" prefix was redundant (the
  // entity type already conveys what the id refers to). Dropped per @0xJem
  // PR #311 Step 4.
  return `${chainId}`;
}

function auctionId(chainId: number, marketId: bigint): string {
  return `${chainId}-${marketId.toString()}`;
}

export async function applyGnosisAuctionLaunched(
  event: LaunchedEvent,
  context: EvmOnEventContext,
): Promise<void> {
  const existingRoot = await context.GnosisAuctionRoot.get(rootId(event.chainId));
  const markets = existingRoot ? [...existingRoot.markets] : [];
  if (!markets.some((value) => value === event.params.marketId)) {
    markets.push(event.params.marketId);
  }
  const root: GnosisAuctionRoot = {
    id: rootId(event.chainId),
    chainId: event.chainId,
    markets,
  };
  context.GnosisAuctionRoot.set(root);

  const payoutCapacity = toDecimal(event.params.capacity, OHM_DECIMALS);
  const auction: GnosisAuction = {
    id: auctionId(event.chainId, event.params.marketId),
    chainId: event.chainId,
    marketId: event.params.marketId,
    auctionOpenTimestamp: BigInt(event.block.timestamp),
    payoutCapacity: new BigDecimal(payoutCapacity.toString(10)),
    termSeconds:
      typeof event.params.bondTerm === "bigint"
        ? event.params.bondTerm
        : BigInt(event.params.bondTerm),
    bidQuantity: undefined,
    auctionCloseTimestamp: undefined,
  };
  context.GnosisAuction.set(auction);
}

indexer.onEvent(
  {
    contract: "BondManager",
    event: "GnosisAuctionLaunched",
  },
  async ({ event, context }) => {
    await applyGnosisAuctionLaunched(event as unknown as LaunchedEvent, context);
  },
);
