import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
} from "viem";
import { describe, expect, test, vi } from "vitest";

const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }));

vi.mock("../../src/snapshot/rpc-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/snapshot/rpc-client")>();
  return {
    ...actual,
    getClient: () => ({ readContract }),
    // No backoff in tests; the error classification is what's under test.
    retryRpc: <T>(operation: () => Promise<T>) => operation(),
  };
});

import {
  readBondManagerState,
  readChainlinkLatestAnswer,
  readErc20BalanceOf,
} from "../../src/effects/index";
import { isContractRevert } from "../../src/snapshot/rpc-client";

const ABI = [
  {
    inputs: [],
    name: "isActive",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const ADDRESS = "0xf577c77ee3578c7f216327f41b5d7221ead2b2a3";

// Error chains as viem raises them from readContract (checked against mainnet
// through the indexer's batched client, before and after multicall3).
const reverted = () =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({ abi: ABI, functionName: "isActive" }),
    { abi: ABI, functionName: "isActive", contractAddress: ADDRESS },
  );
const zeroData = () =>
  new ContractFunctionExecutionError(
    new ContractFunctionZeroDataError({ functionName: "isActive" }),
    {
      abi: ABI,
      functionName: "isActive",
      contractAddress: ADDRESS,
    },
  );
const rateLimited = () =>
  new ContractFunctionExecutionError(
    new HttpRequestError({ url: "https://rpc.example", status: 429 }),
    {
      abi: ABI,
      functionName: "isActive",
      contractAddress: ADDRESS,
    },
  );

// Throw from the mock implementation, as viem does, so the rejection only
// exists once the effect awaits the read.
const failWith = (error: Error) =>
  readContract.mockImplementation(async () => {
    throw error;
  });

type Handler = { handler: (args: { input: unknown; context: unknown }) => Promise<unknown> };
const run = (effect: unknown, input: unknown) =>
  (effect as Handler).handler({ input, context: {} });

describe("isContractRevert", () => {
  test("a revert or empty return data is an on-chain answer", () => {
    expect(isContractRevert(reverted())).toBe(true);
    expect(isContractRevert(zeroData())).toBe(true);
  });

  test("transport failures are not", () => {
    expect(isContractRevert(rateLimited())).toBe(false);
    expect(isContractRevert(new Error("fetch failed"))).toBe(false);
    expect(isContractRevert(undefined)).toBe(false);
  });
});

describe("cached effects don't turn RPC failures into values", () => {
  const bondManager = { chainId: 1, bondManager: ADDRESS, atBlock: 17_654_400 };
  const balance = {
    chainId: 1,
    tokenAddress: "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5",
    walletAddress: ADDRESS,
    atBlock: 17_654_400,
  };
  const feed = {
    chainId: 1,
    feedAddress: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
    atBlock: 12_000_000,
  };

  test("readBondManagerState throws on a rate limit instead of caching an inactive manager", async () => {
    // 2023-07-08 to 07-10: eight snapshots cached isActive=false this way while
    // the BondManager was active and held 271,221 OHM of bond deposits.
    failWith(rateLimited());
    await expect(run(readBondManagerState, bondManager)).rejects.toThrow();
  });

  test("readBondManagerState still reads a revert as inactive", async () => {
    failWith(reverted());
    await expect(run(readBondManagerState, bondManager)).resolves.toEqual({
      isActive: false,
      teller: "",
    });
  });

  test("readErc20BalanceOf throws on a rate limit instead of caching a zero balance", async () => {
    failWith(rateLimited());
    await expect(run(readErc20BalanceOf, balance)).rejects.toThrow();
  });

  test("readErc20BalanceOf reads a token that isn't deployed yet as zero", async () => {
    failWith(zeroData());
    await expect(run(readErc20BalanceOf, balance)).resolves.toBe("0");
  });

  test("readChainlinkLatestAnswer keeps the no-price default for a proxy with no round", async () => {
    failWith(zeroData());
    await expect(run(readChainlinkLatestAnswer, feed)).resolves.toBe("0");
  });
});
