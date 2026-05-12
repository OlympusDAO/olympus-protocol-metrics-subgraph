import { indexer, type LenderAmo } from "envio";

import { addr } from "../snapshot/math";

function lenderAmoId(chainId: number, amoAddress: string): string {
  return `${chainId}-${addr(amoAddress)}`;
}

// Olympus Lender emits AMOAdded / AMORemoved when the active set changes. The
// deployed-OHM amount is maintained by Erc20Transfers.ts on OHM mints/burns
// involving this AMO, so the snapshot reads it from the entity (no RPC).

indexer.onEvent(
  {
    contract: "OlympusLender",
    event: "AMOAdded",
  },
  async ({ event, context }) => {
    const amoAddress = addr(event.params.amo);
    const id = lenderAmoId(event.chainId, amoAddress);
    const existing = await context.LenderAmo.get(id);
    context.LenderAmo.set({
      id,
      chainId: event.chainId,
      amoAddress,
      active: true,
      // Preserve any deployedOhm that may already have been accumulated by an
      // OHM Transfer that arrived before AMOAdded (unlikely but defensive).
      deployedOhm: existing?.deployedOhm ?? 0n,
      updatedAtBlock: BigInt(event.block.number),
    } satisfies LenderAmo);
  },
);

indexer.onEvent(
  {
    contract: "OlympusLender",
    event: "AMORemoved",
  },
  async ({ event, context }) => {
    const amoAddress = addr(event.params.amo);
    const id = lenderAmoId(event.chainId, amoAddress);
    const existing = await context.LenderAmo.get(id);
    context.LenderAmo.set({
      id,
      chainId: event.chainId,
      amoAddress,
      active: false,
      deployedOhm: existing?.deployedOhm ?? 0n,
      updatedAtBlock: BigInt(event.block.number),
    } satisfies LenderAmo);
  },
);
