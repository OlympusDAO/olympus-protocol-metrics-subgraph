import { describe, expect, test, vi } from "vitest";

const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }));
vi.mock("../../src/snapshot/rpc-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/snapshot/rpc-client")>()),
  getClient: () => ({ readContract }),
  retryRpc: <T>(operation: () => Promise<T>) => operation(),
}));

import { readUniv3Twap } from "../../src/effects";

const input = {
  chainId: 1,
  poolAddress: "0xc3db44adc1fcdfd5671f555236eae49f4a8eea18",
  atBlock: 26056846,
  seconds: 3600,
};
type Effect = { handler: (args: { input: typeof input; context: object }) => Promise<unknown> };
const run = () => (readUniv3Twap as unknown as Effect).handler({ input, context: {} });

describe("block-pinned UniV3 TWAP effect", () => {
  test("reads the complete window and slot at the same block", async () => {
    readContract.mockReset().mockImplementation(async ({ functionName }) =>
      functionName === "observe"
        ? [
            [-7116251905332n, -7116584635080n],
            [
              36750495627461354320212726945194114789626n,
              36750495627461354320232976788679619084560n,
            ],
          ]
        : [783082933127646025307382464n],
    );
    await expect(run()).resolves.toEqual({
      tickDelta: "-332729748",
      liquidityDelta: "20249843485504294934",
      sqrtPriceX96: "783082933127646025307382464",
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "observe",
        args: [[3600, 0]],
        blockNumber: 26056846n,
      }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "slot0", blockNumber: 26056846n }),
    );
  });
  test.each([
    "OLD",
    "RPC timeout",
  ])("propagates %s without a zero or spot fallback", async (message) => {
    readContract.mockReset().mockRejectedValue(new Error(message));
    await expect(run()).rejects.toThrow(message);
  });
  test("preserves Solidity cumulative counter wraparound", async () => {
    readContract.mockReset().mockImplementation(async ({ functionName }) =>
      functionName === "observe"
        ? [
            [(1n << 55n) - 10n, -(1n << 55n) + 20n],
            [(1n << 160n) - 10n, 20n],
          ]
        : [1n],
    );
    await expect(run()).resolves.toMatchObject({ tickDelta: "30", liquidityDelta: "30" });
  });
});
