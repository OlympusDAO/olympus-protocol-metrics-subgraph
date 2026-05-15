import { type ChainlinkPriceState, type ChainlinkPriceUpdate, indexer } from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";

// Chainlink AggregatorV3 emits AnswerUpdated whenever a feed reports a new
// price. We persist two entities (per @0xJem on PR #315):
//
// - `ChainlinkPriceUpdate`: immutable, one row per AnswerUpdated event. Lets
//   downstream consumers (and the parity harness) query the historical price
//   at any block via `block_lte` filters.
// - `ChainlinkPriceState`: mutable "latest" pointer keyed by
//   (chainId, feedAddress). Snapshot path reads from this for O(1) lookup;
//   Envio's within-chain event ordering guarantees it reflects all prior
//   events at the snapshot block.
//
// The feed -> tokenAddress + decimals mapping comes from the per-chain
// `chainlink` LiquidityHandler config. Feeds whose addresses aren't listed
// in any chain's config are silently ignored — config.yaml controls which
// feeds even reach this handler, but the guard makes the dependency explicit.

// Extracted as a pure helper so the writer logic is unit-testable without
// standing up the full Envio runtime.
export async function applyAnswerUpdated(
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { current: bigint; roundId: bigint; updatedAt: bigint };
  },
  context: {
    ChainlinkPriceState: {
      get: (id: string) => Promise<ChainlinkPriceState | undefined>;
      set: (entity: ChainlinkPriceState) => void;
    };
    ChainlinkPriceUpdate: {
      set: (entity: ChainlinkPriceUpdate) => void;
    };
  },
): Promise<void> {
  const chainConfig = CHAIN_CONFIGS[event.chainId as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) return;

  const feedAddress = addr(event.srcAddress);
  const handler = chainConfig.liquidityHandlers.find(
    (entry) => entry.kind === "chainlink" && addr(entry.id) === feedAddress,
  );
  if (!handler || handler.kind !== "chainlink") return;

  const tokenAddress = addr(handler.tokens[0]);
  const block = BigInt(event.block.number);
  const blockTimestamp = BigInt(event.block.timestamp);

  // Immutable per-event record.
  context.ChainlinkPriceUpdate.set({
    id: `${event.chainId}-${feedAddress}-${block}-${event.logIndex}`,
    chainId: event.chainId,
    feedAddress,
    tokenAddress,
    answer: event.params.current,
    decimals: handler.decimals,
    roundId: event.params.roundId,
    block,
    timestamp: blockTimestamp,
  } satisfies ChainlinkPriceUpdate);

  // Latest pointer for O(1) snapshot reads.
  context.ChainlinkPriceState.set({
    id: `${event.chainId}-${feedAddress}`,
    chainId: event.chainId,
    feedAddress,
    tokenAddress,
    answer: event.params.current,
    decimals: handler.decimals,
    roundId: event.params.roundId,
    updatedAtBlock: block,
    updatedAtTimestamp: event.params.updatedAt,
  } satisfies ChainlinkPriceState);
}

indexer.onEvent(
  {
    contract: "ChainlinkAggregator",
    event: "AnswerUpdated",
  },
  async ({ event, context }) => {
    await applyAnswerUpdated(event, context);
  },
);
