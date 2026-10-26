import { ContractFunctionExecutionError, ContractFunctionRevertedError } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }));

vi.mock("../../src/snapshot/rpc-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/snapshot/rpc-client")>();
  return {
    ...actual,
    getClient: () => ({ readContract }),
    retryRpc: <T>(operation: () => Promise<T>) => operation(),
  };
});

import { readMasterChefStake } from "../../src/effects/index";

const MASTERCHEF = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";
const ALLOCATOR = "0x0316508a1b5abf1cae42912dc2c8b9774b682ffc";
const OHM_DAI_V1 = "0x34d7d7aaf50ad4944b70b320acb24c95fa2def7c";
const ABI = [
  {
    inputs: [],
    name: "poolInfo",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type Handler = { handler: (args: { input: unknown; context: unknown }) => Promise<unknown> };
const run = () =>
  (readMasterChefStake as unknown as Handler).handler({
    input: {
      chainId: 1,
      contract: MASTERCHEF,
      pid: 185,
      lpToken: OHM_DAI_V1,
      wallet: ALLOCATOR,
      atBlock: 13_850_000,
    },
    context: {},
  });

function chain(poolLp: string | Error, staked: bigint) {
  readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName === "poolInfo") {
        expect(args).toEqual([185n]);
        if (poolLp instanceof Error) throw poolLp;
        return [poolLp, 0n, 0n, 0n];
      }
      if (functionName === "userInfo") {
        expect(args).toEqual([
          185n,
          expect.stringMatching(/^0x0316508a1b5abf1cae42912dc2c8b9774b682ffc$/i),
        ]);
        return [staked, 0n];
      }
      throw new Error(`unexpected ${functionName}`);
    },
  );
}

beforeEach(() => {
  readContract.mockReset();
});

describe("readMasterChefStake", () => {
  test("returns userInfo(pid, wallet).amount while poolInfo(pid).lpToken is the expected pool", async () => {
    // 16.7 SLP of OHM-DAI v1 staked by the Onsen allocator (pid 185).
    chain("0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c", 16_700_000_000_000_000_000n);
    expect(await run()).toBe("16700000000000000000");
  });

  test("returns 0 when the pid points at another token (pid 185 at head)", async () => {
    chain("0xadd8d5013De24452C5fF59a56f09443d44b59F2A", 16_700_000_000_000_000_000n);
    expect(await run()).toBe("0");
  });

  test("returns 0 when the pid doesn't exist yet", async () => {
    chain(
      new ContractFunctionExecutionError(
        new ContractFunctionRevertedError({ abi: ABI, functionName: "poolInfo" }),
        { abi: ABI, functionName: "poolInfo", contractAddress: MASTERCHEF },
      ),
      0n,
    );
    expect(await run()).toBe("0");
  });
});
