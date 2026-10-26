import {
  ContractFunctionExecutionError,
  ContractFunctionZeroDataError,
  HttpRequestError,
} from "viem";
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

import { readNextOhmDistribution, readPreV3SOhmState } from "../../src/effects/index";

const SOHM_V1 = "0x31932e6e45012476ba3a3a4953cba62aee77fbbe";
const SOHM_V2 = "0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f";
const ABI = [
  {
    inputs: [],
    name: "index",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const notDeployed = () =>
  new ContractFunctionExecutionError(new ContractFunctionZeroDataError({ functionName: "index" }), {
    abi: ABI,
    functionName: "index",
    contractAddress: SOHM_V2,
  });

type Reads = Partial<Record<string, bigint | readonly bigint[] | Error>>;
function chainState(reads: Reads) {
  readContract.mockImplementation(
    async ({ address, functionName }: { address: string; functionName: string }) => {
      const value = reads[`${address.toLowerCase()}.${functionName}`];
      if (value === undefined) throw notDeployed();
      if (value instanceof Error) throw value;
      return value;
    },
  );
}

type Handler = { handler: (args: { input: unknown; context: unknown }) => Promise<unknown> };
const run = (atBlock: number) =>
  (readPreV3SOhmState as unknown as Handler).handler({
    input: { chainId: 1, sOhmV1: SOHM_V1, sOhmV2: SOHM_V2, atBlock },
    context: {},
  });

beforeEach(() => {
  readContract.mockReset();
});

describe("readPreV3SOhmState", () => {
  test("before sOHM v2, the index is sOHM v1 totalSupply over its 500,000 initial supply", async () => {
    // Block 13,000,000-era values: sOHM v1 totalSupply 5,019,903.08 → index
    // 10.03980616; circulating 5,470.23.
    chainState({
      [`${SOHM_V1}.totalSupply`]: 5_019_903_084_040_782n,
      [`${SOHM_V1}.circulatingSupply`]: 5_470_226_752_915n,
    });
    expect(await run(12_600_000)).toEqual({
      index: "10039806168",
      circulatingSupply: "5470226752915",
    });
  });

  test("sOHM v2 deployed but not yet rebased (index 0) still reads v1", async () => {
    // At 12,625,200 sOHM v2 reported index 0 and circulatingSupply 5,000,000.
    chainState({
      [`${SOHM_V1}.totalSupply`]: 2_205_730_009_174_596n,
      [`${SOHM_V1}.circulatingSupply`]: 294_977_300_333_387n,
      [`${SOHM_V2}.index`]: 0n,
      [`${SOHM_V2}.circulatingSupply`]: 5_000_000_000_000_000n,
    });
    expect(await run(12_625_200)).toEqual({
      index: "4411460018",
      circulatingSupply: "294977300333387",
    });
  });

  test("once sOHM v2 has rebased, its index; staked supply is v1 plus v2", async () => {
    // 12,639,600, mid-migration: v1 177,293.19 and v2 133,037.54 staked.
    chainState({
      [`${SOHM_V1}.totalSupply`]: 2_304_359_235_034_931n,
      [`${SOHM_V1}.circulatingSupply`]: 177_293_188_306_678n,
      [`${SOHM_V2}.index`]: 4_600_685_057n,
      [`${SOHM_V2}.circulatingSupply`]: 133_037_539_870_218n,
    });
    expect(await run(12_639_600)).toEqual({
      index: "4600685057",
      circulatingSupply: (177_293_188_306_678n + 133_037_539_870_218n).toString(),
    });
  });

  test("before sOHM v1 exists, everything is 0", async () => {
    chainState({});
    expect(await run(12_000_000)).toEqual({ index: "0", circulatingSupply: "0" });
  });

  test("a transport error is thrown, never cached as 0", async () => {
    chainState({
      [`${SOHM_V2}.index`]: new HttpRequestError({ url: "https://rpc.example", status: 429 }),
    });
    await expect(run(12_639_600)).rejects.toThrow();
  });
});

describe("readNextOhmDistribution (APY numerator) before sOHM v3", () => {
  const STAKING_V1 = "0x0822f3c03dcc24d200aff33493dc08d0e1f274a2";
  const STAKING_V2 = "0xfd31c7d00ca47653c6ce64af53c1571f9c36566a";
  const STAKING_V3 = "0xb63cac384247597756545b500253ff8e607a8020";
  const runAt = (atBlock: number) =>
    (readNextOhmDistribution as unknown as Handler).handler({
      input: {
        chainId: 1,
        stakingV1: STAKING_V1,
        stakingV2: STAKING_V2,
        stakingV2StartBlock: 12_622_679,
        stakingV3: STAKING_V3,
        stakingV3StartBlock: 13_804_019,
        atBlock,
      },
      context: {},
    });

  test("the v1 era reads staking v1's ohmToDistributeNextEpoch only", async () => {
    // 12,620,400: 1,792.50 OHM.
    chainState({ [`${STAKING_V1}.ohmToDistributeNextEpoch`]: 1_792_495_169_829n });
    expect(await runAt(12_620_400)).toBe("1792495169829");
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  test("during the v1 to v2 staking migration, both are summed", async () => {
    // 12,639,600: v1 830.29 + v2 epoch().distribute 1,069.57.
    chainState({
      [`${STAKING_V1}.ohmToDistributeNextEpoch`]: 830_288_462_082n,
      [`${STAKING_V2}.epoch`]: [2_200n, 1n, 1_623_600_000n, 1_069_568_700_907n],
    });
    expect(await runAt(12_639_600)).toBe((830_288_462_082n + 1_069_568_700_907n).toString());
  });
});
