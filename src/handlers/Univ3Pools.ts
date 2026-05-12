import { indexer, type Univ3PoolState } from "envio";

import { addr } from "../snapshot/math";

function univ3PoolStateId(chainId: number, poolAddress: string): string {
  return `${chainId}-${addr(poolAddress)}`;
}

// Univ3 Initialize emits the starting sqrtPriceX96 + tick. Liquidity starts at 0.
indexer.onEvent(
  {
    contract: "UniswapV3Pool",
    event: "Initialize",
  },
  async ({ event, context }) => {
    const poolAddress = addr(event.srcAddress);
    const entity: Univ3PoolState = {
      id: univ3PoolStateId(event.chainId, poolAddress),
      chainId: event.chainId,
      poolAddress,
      sqrtPriceX96: event.params.sqrtPriceX96,
      tick: event.params.tick,
      liquidity: 0n,
      updatedAtBlock: BigInt(event.block.number),
    };
    context.Univ3PoolState.set(entity);
  },
);

// Univ3 Swap emits the post-trade sqrtPriceX96, liquidity, and tick. Same
// payload as `slot0()` for our pricing purposes — replaces the slot0 RPC read.
indexer.onEvent(
  {
    contract: "UniswapV3Pool",
    event: "Swap",
  },
  async ({ event, context }) => {
    const poolAddress = addr(event.srcAddress);
    const entity: Univ3PoolState = {
      id: univ3PoolStateId(event.chainId, poolAddress),
      chainId: event.chainId,
      poolAddress,
      sqrtPriceX96: event.params.sqrtPriceX96,
      tick: event.params.tick,
      liquidity: event.params.liquidity,
      updatedAtBlock: BigInt(event.block.number),
    };
    context.Univ3PoolState.set(entity);
  },
);
