import { indexer, type Univ2PoolState, type Univ2PoolUpdate } from "envio";

import { addr } from "../snapshot/math";

function univ2PoolStateId(chainId: number, poolAddress: string): string {
  return `${chainId}-${addr(poolAddress)}`;
}

// Univ2 Sync emits the post-trade reserves directly. One entity write per swap
// or LP event replaces the per-snapshot `getReserves` RPC call entirely. Per
// @0xJem on PR #315 we also persist a `Univ2PoolUpdate` per event for
// historical / time-travel queries.
indexer.onEvent(
  {
    contract: "UniswapV2Pool",
    event: "Sync",
  },
  async ({ event, context }) => {
    const poolAddress = addr(event.srcAddress);
    const block = BigInt(event.block.number);

    const update: Univ2PoolUpdate = {
      id: `${event.chainId}-${poolAddress}-${block}-${event.logIndex}`,
      chainId: event.chainId,
      poolAddress,
      reserve0: event.params.reserve0,
      reserve1: event.params.reserve1,
      block,
      timestamp: BigInt(event.block.timestamp),
    };
    context.Univ2PoolUpdate.set(update);

    const entity: Univ2PoolState = {
      id: univ2PoolStateId(event.chainId, poolAddress),
      chainId: event.chainId,
      poolAddress,
      reserve0: event.params.reserve0,
      reserve1: event.params.reserve1,
      updatedAtBlock: block,
    };
    context.Univ2PoolState.set(entity);
  },
);
