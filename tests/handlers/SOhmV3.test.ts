import type { OhmIndexState, OhmIndexUpdate } from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyLogRebase } from "../../src/handlers/SOhmV3";

const ETHEREUM_CHAIN_ID = 1;
const SOHM_V3 = "0x04906695d6d12cf5459975d7c3c03356e4ccd460";
const UNKNOWN_CONTRACT = "0x0000000000000000000000000000000000000123";

function buildContext() {
  const stateSetSpy = vi.fn<(entity: OhmIndexState) => void>();
  const updateSetSpy = vi.fn<(entity: OhmIndexUpdate) => void>();
  const context = {
    OhmIndexState: {
      get: async () => undefined,
      set: stateSetSpy,
    },
    OhmIndexUpdate: {
      set: updateSetSpy,
    },
  };
  return { context, stateSetSpy, updateSetSpy };
}

describe("applyLogRebase", () => {
  test("writes OhmIndexState and OhmIndexUpdate when the source matches a gohm handler", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: ETHEREUM_CHAIN_ID,
        srcAddress: SOHM_V3,
        logIndex: 7,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(stateSetSpy).toHaveBeenCalledTimes(1);
    expect(stateSetSpy).toHaveBeenCalledWith({
      id: `${ETHEREUM_CHAIN_ID}-${SOHM_V3}`,
      chainId: ETHEREUM_CHAIN_ID,
      sOhmAddress: SOHM_V3,
      index: 131_283_291_432n,
      epoch: 1_234n,
      updatedAtBlock: 18_000_000n,
      updatedAtTimestamp: 1_700_000_000n,
    });
    expect(updateSetSpy).toHaveBeenCalledTimes(1);
    expect(updateSetSpy).toHaveBeenCalledWith({
      id: `${ETHEREUM_CHAIN_ID}-${SOHM_V3}-18000000-7`,
      chainId: ETHEREUM_CHAIN_ID,
      sOhmAddress: SOHM_V3,
      index: 131_283_291_432n,
      epoch: 1_234n,
      block: 18_000_000n,
      timestamp: 1_700_000_000n,
    });
  });

  test("no-ops when no gohm handler matches the source address", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: ETHEREUM_CHAIN_ID,
        srcAddress: UNKNOWN_CONTRACT,
        logIndex: 0,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(stateSetSpy).not.toHaveBeenCalled();
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  test("no-ops when the chain id is not configured", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: 999_999,
        srcAddress: SOHM_V3,
        logIndex: 0,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(stateSetSpy).not.toHaveBeenCalled();
    expect(updateSetSpy).not.toHaveBeenCalled();
  });
});
