import { indexer, type Univ3PoolState, type Univ3PoolUpdate } from "envio";

import { addr } from "../snapshot/math";

function univ3PoolStateId(chainId: number, poolAddress: string): string {
  return `${chainId}-${addr(poolAddress)}`;
}

// Per @0xJem on PR #315 we persist a `Univ3PoolUpdate` per Initialize/Swap
// for historical / time-travel queries alongside the mutable Univ3PoolState
// snapshot pointer.
type Univ3SetArgs = {
  chainId: number;
  poolAddress: string;
  block: bigint;
  timestamp: bigint;
  logIndex: number;
  sqrtPriceX96: bigint;
  tick: bigint;
  liquidity: bigint;
  context: {
    Univ3PoolState: { set: (entity: Univ3PoolState) => void };
    Univ3PoolUpdate: { set: (entity: Univ3PoolUpdate) => void };
  };
};

function setUniv3State(args: Univ3SetArgs): void {
  args.context.Univ3PoolUpdate.set({
    id: `${args.chainId}-${args.poolAddress}-${args.block}-${args.logIndex}`,
    chainId: args.chainId,
    poolAddress: args.poolAddress,
    sqrtPriceX96: args.sqrtPriceX96,
    tick: args.tick,
    liquidity: args.liquidity,
    block: args.block,
    timestamp: args.timestamp,
  });
  args.context.Univ3PoolState.set({
    id: univ3PoolStateId(args.chainId, args.poolAddress),
    chainId: args.chainId,
    poolAddress: args.poolAddress,
    sqrtPriceX96: args.sqrtPriceX96,
    tick: args.tick,
    liquidity: args.liquidity,
    updatedAtBlock: args.block,
  });
}

// Univ3 Initialize emits the starting sqrtPriceX96 + tick. Liquidity starts at 0.
indexer.onEvent(
  {
    contract: "UniswapV3Pool",
    event: "Initialize",
  },
  async ({ event, context }) => {
    setUniv3State({
      chainId: event.chainId,
      poolAddress: addr(event.srcAddress),
      block: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      logIndex: event.logIndex,
      sqrtPriceX96: event.params.sqrtPriceX96,
      tick: event.params.tick,
      liquidity: 0n,
      context,
    });
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
    setUniv3State({
      chainId: event.chainId,
      poolAddress: addr(event.srcAddress),
      block: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      logIndex: event.logIndex,
      sqrtPriceX96: event.params.sqrtPriceX96,
      tick: event.params.tick,
      liquidity: event.params.liquidity,
      context,
    });
  },
);
