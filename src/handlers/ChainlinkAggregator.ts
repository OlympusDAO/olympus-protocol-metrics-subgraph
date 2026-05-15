import { type ChainlinkPriceState, indexer } from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";

// Chainlink AggregatorV3 emits AnswerUpdated whenever a feed reports a new
// price. We persist the answer + roundId into ChainlinkPriceState so the
// recursive pricing router (ChainlinkPriceHandler) can read it without an RPC
// call at snapshot time. The feed -> tokenAddress + decimals mapping comes
// from the per-chain `chainlink` LiquidityHandler config.
//
// Feeds whose addresses aren't listed in any chain's config are silently
// ignored — config.yaml controls which feeds even reach this handler, but the
// guard makes the dependency explicit.

// Extracted as a pure helper so the writer logic is unit-testable without
// standing up the full Envio runtime.
export async function applyAnswerUpdated(
  event: {
    chainId: number;
    srcAddress: string;
    block: { number: number; timestamp: number };
    params: { current: bigint; roundId: bigint; updatedAt: bigint };
  },
  context: {
    ChainlinkPriceState: {
      get: (id: string) => Promise<ChainlinkPriceState | undefined>;
      set: (entity: ChainlinkPriceState) => void;
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

  context.ChainlinkPriceState.set({
    id: `${event.chainId}-${feedAddress}`,
    chainId: event.chainId,
    feedAddress,
    tokenAddress: addr(handler.tokens[0]),
    answer: event.params.current,
    decimals: handler.decimals,
    roundId: event.params.roundId,
    updatedAtBlock: BigInt(event.block.number),
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
