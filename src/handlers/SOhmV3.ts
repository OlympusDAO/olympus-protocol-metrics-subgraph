import { type OhmIndexState, indexer } from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";

// sOHM V3 emits LogRebase(epoch, rebase, index) on every staking-epoch
// rebase. We persist the latest `index` into OhmIndexState so the gOHM
// pricing handler can compute gOHM_price = OHM_price * index / 10^9 without
// a snapshot-time RPC. Legacy reads sOHMv3.index() directly via
// `getCurrentIndex` (subgraphs/shared/src/supply/OhmCalculations.ts).
//
// Source addresses not declared on any chain's `gohm` LiquidityHandler are
// silently ignored — config.yaml gates which contracts even reach this
// handler, but we double-check here so misconfigurations fail loud at
// read-time rather than poisoning the entity store.

export async function applyLogRebase(
  event: {
    chainId: number;
    srcAddress: string;
    block: { number: number; timestamp: number };
    params: { epoch: bigint; rebase: bigint; index: bigint };
  },
  context: {
    OhmIndexState: {
      get: (id: string) => Promise<OhmIndexState | undefined>;
      set: (entity: OhmIndexState) => void;
    };
  },
): Promise<void> {
  const chainConfig = CHAIN_CONFIGS[event.chainId as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) return;

  const sOhmAddress = addr(event.srcAddress);
  const handler = chainConfig.liquidityHandlers.find(
    (entry) => entry.kind === "gohm" && addr(entry.id) === sOhmAddress,
  );
  if (!handler || handler.kind !== "gohm") return;

  context.OhmIndexState.set({
    id: `${event.chainId}-${sOhmAddress}`,
    chainId: event.chainId,
    sOhmAddress,
    index: event.params.index,
    epoch: event.params.epoch,
    updatedAtBlock: BigInt(event.block.number),
    updatedAtTimestamp: BigInt(event.block.timestamp),
  } satisfies OhmIndexState);
}

indexer.onEvent(
  {
    contract: "SOhmV3",
    event: "LogRebase",
  },
  async ({ event, context }) => {
    await applyLogRebase(event, context);
  },
);
