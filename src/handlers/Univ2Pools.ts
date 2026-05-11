import { indexer, type Univ2PoolState } from "envio";

import { addr } from "../snapshot/math";

function univ2PoolStateId(chainId: number, poolAddress: string): string {
  return `${chainId}-${addr(poolAddress)}`;
}

// Univ2 Sync emits the post-trade reserves directly. One entity write per swap
// or LP event replaces the per-snapshot `getReserves` RPC call entirely.
indexer.onEvent(
  {
    contract: "UniswapV2Pool",
    event: "Sync",
  },
  async ({ event, context }) => {
    const poolAddress = addr(event.srcAddress);
    const entity: Univ2PoolState = {
      id: univ2PoolStateId(event.chainId, poolAddress),
      chainId: event.chainId,
      poolAddress,
      reserve0: event.params.reserve0,
      reserve1: event.params.reserve1,
      updatedAtBlock: BigInt(event.block.number),
    };
    context.Univ2PoolState.set(entity);
  },
);
