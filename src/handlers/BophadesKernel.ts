import { type BophadesModule, type EvmOnEventContext, indexer } from "envio";

import { resolveBophadesKeycode } from "../effects";
import { addr } from "../snapshot/math";

// Bophades Kernel emits `ActionExecuted(action, target)` for each kernel
// action. We track InstallModule (0) and UpgradeModule (1) so the indexer
// learns which contract is currently serving each keycode (TRSRY, CHREG,
// etc.) without an RPC call at snapshot time. The legacy subgraph instead
// queried `kernel.getModuleForKeycode("TRSRY")` at every snapshot block;
// indexing this event-driven moves the cost from snapshot-time to
// install-time.
//
// Other actions (ActivatePolicy=2, DeactivatePolicy=3, ChangeExecutor=4,
// MigrateKernel=5) are not module assignments and are ignored.
const ACTION_INSTALL_MODULE = 0;
const ACTION_UPGRADE_MODULE = 1;

type KernelEvent = {
  chainId: number;
  block: { number: number; timestamp: number };
  params: { action: number | bigint; target_: string };
};

export async function applyKernelActionExecuted(
  event: KernelEvent,
  context: EvmOnEventContext,
): Promise<void> {
  const action =
    typeof event.params.action === "bigint" ? Number(event.params.action) : event.params.action;
  if (action !== ACTION_INSTALL_MODULE && action !== ACTION_UPGRADE_MODULE) {
    return;
  }

  const moduleAddress = addr(event.params.target_);
  const keycode = (await context.effect(resolveBophadesKeycode, {
    chainId: event.chainId,
    moduleAddress,
  })) as string;
  if (!keycode) return;

  context.BophadesModule.set({
    id: `${event.chainId}-${keycode}`,
    chainId: event.chainId,
    keycode,
    moduleAddress,
    installedAtBlock: BigInt(event.block.number),
    installedAtTimestamp: BigInt(event.block.timestamp),
  } satisfies BophadesModule);
}

indexer.onEvent(
  {
    contract: "BophadesKernel",
    event: "ActionExecuted",
  },
  async ({ event, context }) => {
    await applyKernelActionExecuted(event as unknown as KernelEvent, context);
  },
);
