import { indexer, type OhmIndexState, type OhmIndexUpdate } from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";

// sOHM V3 emits LogRebase(epoch, rebase, index) on every staking-epoch
// rebase. Per @0xJem on PR #315 we persist two entities:
// - `OhmIndexUpdate`: immutable per-event record (block-keyed) for
//   historical / time-travel queries of the rebase index.
// - `OhmIndexState`: mutable "latest" pointer used by the gOHM pricing
//   handler for O(1) snapshot-time reads.
//
// Source addresses not declared on any chain's `gohm` LiquidityHandler are
// silently ignored — config.yaml gates which contracts even reach this
// handler, but we double-check here so misconfigurations fail loud at
// read-time rather than poisoning the entity store.

export async function applyLogRebase(
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { epoch: bigint; rebase: bigint; index: bigint };
  },
  context: {
    OhmIndexState: {
      get: (id: string) => Promise<OhmIndexState | undefined>;
      set: (entity: OhmIndexState) => void;
    };
    OhmIndexUpdate: { set: (entity: OhmIndexUpdate) => void };
  },
): Promise<void> {
  const chainConfig = CHAIN_CONFIGS[event.chainId as keyof typeof CHAIN_CONFIGS];
  if (!chainConfig) return;

  const sOhmAddress = addr(event.srcAddress);
  const handler = chainConfig.liquidityHandlers.find(
    (entry) => entry.kind === "gohm" && addr(entry.id) === sOhmAddress,
  );
  if (handler?.kind !== "gohm") return;

  const block = BigInt(event.block.number);
  const timestamp = BigInt(event.block.timestamp);

  context.OhmIndexUpdate.set({
    id: `${event.chainId}-${sOhmAddress}-${block}-${event.logIndex}`,
    chainId: event.chainId,
    sOhmAddress,
    index: event.params.index,
    epoch: event.params.epoch,
    block,
    timestamp,
  } satisfies OhmIndexUpdate);

  context.OhmIndexState.set({
    id: `${event.chainId}-${sOhmAddress}`,
    chainId: event.chainId,
    sOhmAddress,
    index: event.params.index,
    epoch: event.params.epoch,
    updatedAtBlock: block,
    updatedAtTimestamp: timestamp,
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
