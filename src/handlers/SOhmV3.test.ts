import type { OhmIndexState } from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyLogRebase } from "./SOhmV3";

const ETHEREUM_CHAIN_ID = 1;
const SOHM_V3 = "0x04906695d6d12cf5459975d7c3c03356e4ccd460";
const UNKNOWN_CONTRACT = "0x0000000000000000000000000000000000000123";

function buildContext() {
  const setSpy = vi.fn<(entity: OhmIndexState) => void>();
  const context = {
    OhmIndexState: {
      get: async () => undefined,
      set: setSpy,
    },
  };
  return { context, setSpy };
}

describe("applyLogRebase", () => {
  test("writes OhmIndexState when the source matches a gohm handler", async () => {
    const { context, setSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: ETHEREUM_CHAIN_ID,
        srcAddress: SOHM_V3,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({
      id: `${ETHEREUM_CHAIN_ID}-${SOHM_V3}`,
      chainId: ETHEREUM_CHAIN_ID,
      sOhmAddress: SOHM_V3,
      index: 131_283_291_432n,
      epoch: 1_234n,
      updatedAtBlock: 18_000_000n,
      updatedAtTimestamp: 1_700_000_000n,
    });
  });

  test("no-ops when no gohm handler matches the source address", async () => {
    const { context, setSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: ETHEREUM_CHAIN_ID,
        srcAddress: UNKNOWN_CONTRACT,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(setSpy).not.toHaveBeenCalled();
  });

  test("no-ops when the chain id is not configured", async () => {
    const { context, setSpy } = buildContext();
    await applyLogRebase(
      {
        chainId: 999_999,
        srcAddress: SOHM_V3,
        block: { number: 18_000_000, timestamp: 1_700_000_000 },
        params: { epoch: 1_234n, rebase: 5_000_000n, index: 131_283_291_432n },
      },
      context,
    );
    expect(setSpy).not.toHaveBeenCalled();
  });
});
