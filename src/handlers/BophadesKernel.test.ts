import type { BophadesModule, EvmOnEventContext } from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyKernelActionExecuted } from "./BophadesKernel";

const ETHEREUM_CHAIN_ID = 1;
const TRSRY_V1 = "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613";

function buildContext(keycode: string) {
  const setSpy = vi.fn<(entity: BophadesModule) => void>();
  const context = {
    effect: async () => keycode,
    BophadesModule: {
      get: async () => undefined,
      set: setSpy,
    },
  } as unknown as EvmOnEventContext;
  return { context, setSpy };
}

describe("applyKernelActionExecuted", () => {
  test("writes BophadesModule on InstallModule (action=0)", async () => {
    const { context, setSpy } = buildContext("TRSRY");
    await applyKernelActionExecuted(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { action: 0, target_: TRSRY_V1 },
      },
      context,
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({
      id: `${ETHEREUM_CHAIN_ID}-TRSRY`,
      chainId: ETHEREUM_CHAIN_ID,
      keycode: "TRSRY",
      moduleAddress: TRSRY_V1,
      installedAtBlock: 18_000_000n,
      installedAtTimestamp: 1_700_000_000n,
    });
  });

  test("writes BophadesModule on UpgradeModule (action=1)", async () => {
    const { context, setSpy } = buildContext("TRSRY");
    await applyKernelActionExecuted(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 18_500_000, timestamp: 1_700_500_000 },
        params: { action: 1, target_: TRSRY_V1 },
      },
      context,
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  test("no-ops for ActivatePolicy / DeactivatePolicy / ChangeExecutor / MigrateKernel", async () => {
    for (const action of [2, 3, 4, 5]) {
      const { context, setSpy } = buildContext("TRSRY");
      await applyKernelActionExecuted(
        {
          chainId: ETHEREUM_CHAIN_ID,
          block: { number: 18_000_000, timestamp: 1_700_000_000 },
          params: { action, target_: TRSRY_V1 },
        },
        context,
      );
      expect(setSpy).not.toHaveBeenCalled();
    }
  });

  test("accepts action as bigint as well as number (HyperSync decodes uint8 to bigint)", async () => {
    const { context, setSpy } = buildContext("CHREG");
    await applyKernelActionExecuted(
      {
        chainId: ETHEREUM_CHAIN_ID,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { action: 0n, target_: TRSRY_V1 },
      },
      context,
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy.mock.calls[0]?.[0].keycode).toBe("CHREG");
  });
});
