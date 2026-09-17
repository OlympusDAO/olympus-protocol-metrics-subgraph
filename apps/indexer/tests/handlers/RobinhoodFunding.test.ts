import type { EvmOnBlockContext } from "envio";
import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  type PublicClient,
  parseEventLogs,
} from "viem";
import { describe, expect, test, vi } from "vitest";
import { readErc20BalanceAtBlock } from "../../src/effects";
import { pushTokenBalanceRecords } from "../../src/handlers/BlockHandlers";
import { ROBINHOOD, ROBINHOOD_START_BLOCK } from "../../src/snapshot/chains/robinhood";
import { aggregateAcrossChains, computePerChainAggregate } from "../../src/snapshot/global";
import type { SerializedTokenRecord } from "../../src/snapshot/types";

// Receipt-anchored historical fixture, not a current balance assertion.
const TX = "0x76e566c7dc4f6d12bc12d3cb07df31a42745bc05b7ca5b31f45f13e98b81c87d";
const FUNDING_BLOCK = 65047107n;
const FUNDING_HASH = "0x4d5e65b0a24547c3092f29fd3d0eb833920b8f1a9bb2f657c4a9d4fe2fc24dd6";
const RAW = 499977966094n;
const wallet = getAddress(ROBINHOOD.protocolAddresses[0]);
const asset = getAddress(ROBINHOOD.tokens[0].address);
type BalanceInput = Parameters<typeof readErc20BalanceAtBlock>[0];

async function snapshot(
  block: bigint,
  timestamp: bigint,
  read: (input: BalanceInput) => Promise<string>,
) {
  const records: SerializedTokenRecord[] = [];
  const effect = vi.fn(async (definition: { name: string }, input: BalanceInput) => {
    expect(definition.name).toBe("readErc20BalanceOf");
    expect(input).toEqual({
      chainId: 4663,
      tokenAddress: asset.toLowerCase(),
      walletAddress: wallet.toLowerCase(),
      atBlock: Number(block),
    });
    return read(input);
  });
  await pushTokenBalanceRecords(
    { effect } as unknown as EvmOnBlockContext,
    ROBINHOOD,
    {} as PublicClient,
    records,
    timestamp,
    block,
  );
  const chain = computePerChainAggregate(
    4663,
    "Robinhood",
    "2026-09-17",
    block,
    timestamp,
    records,
    [],
  );
  const total = aggregateAcrossChains("2026-09-17", [chain]);
  return { records, total, effect };
}

describe("Robinhood funded USDG snapshot", () => {
  test("empty baseline then receipt-sized balance emits one correctly normalized aggregate", async () => {
    const before = await snapshot(BigInt(ROBINHOOD_START_BLOCK), 1789615687n, async () => "0");
    expect(before.records).toEqual([]);
    expect(before.total.treasuryMarketValue.toString()).toBe("0");
    const after = await snapshot(FUNDING_BLOCK, 1789615919n, async () => RAW.toString());
    expect(after.effect).toHaveBeenCalledTimes(1);
    expect(after.records).toHaveLength(1);
    expect(after.records[0].sourceAddress).toBe(wallet.toLowerCase());
    expect(after.records[0].value).toBe("499977.966094");
    expect(after.total.treasuryMarketValue.toString()).toBe("499977.966094");
    expect(after.total.treasuryLiquidBacking.toString()).toBe("499977.966094");
    expect(after.total.chainsMissing).not.toContain(4663);
  });
  test("unavailable Robinhood RPC state fails instead of publishing a zero", async () => {
    const client = {
      readContract: vi.fn().mockRejectedValue(new Error("historical state unavailable")),
    } as unknown as PublicClient;
    await expect(
      snapshot(FUNDING_BLOCK, 1789615919n, (input) => readErc20BalanceAtBlock(input, client)),
    ).rejects.toThrow("refusing zero fallback");
  });
});

// Opt-in read-only verification, not HyperSync ingestion or publisher deployment proof.
test.skipIf(process.env.ROBINHOOD_LIVE_VERIFY !== "1")(
  "live receipt and current funded snapshot reconcile",
  async () => {
    const client = createPublicClient({
      transport: http(
        process.env.ENVIO_ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
        { retryCount: 0 },
      ),
    });
    expect(await client.getChainId()).toBe(4663);
    const receipt = await client.getTransactionReceipt({ hash: TX });
    expect(receipt.status).toBe("success");
    expect(receipt.blockNumber).toBe(FUNDING_BLOCK);
    expect(receipt.blockHash).toBe(FUNDING_HASH);
    const transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: "Transfer",
      logs: receipt.logs.filter((log) => log.address.toLowerCase() === asset.toLowerCase()),
    }).filter((log) => log.args.to.toLowerCase() === wallet.toLowerCase());
    expect(transfers).toHaveLength(1);
    expect(transfers[0].args.value).toBe(RAW);
    expect(
      await client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }),
    ).toBe(6);
    const block = await client.getBlock();
    const actual = await client.readContract({
      address: asset,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
      blockNumber: block.number,
    });
    // This funding-only check must fail if the position has subsequently moved.
    expect(actual).toBe(RAW);
    const result = await snapshot(block.number, block.timestamp, (input) =>
      readErc20BalanceAtBlock(input, client as PublicClient),
    );
    expect(result.records).toHaveLength(1);
    expect(result.total.treasuryMarketValue.toString()).toBe("499977.966094");
    expect(result.total.treasuryLiquidBacking.toString()).toBe("499977.966094");
    process.stdout.write(
      JSON.stringify({
        verification: "receipt + live idle-USDG snapshot; no HyperSync/publisher claim",
        block: block.number.toString(),
        hash: block.hash,
        timestamp: block.timestamp.toString(),
        rawBalance: actual.toString(),
        recordCount: result.records.length,
        value: result.total.treasuryMarketValue.toString(),
      }),
    );
    process.stdout.write("\n");
  },
  60000,
);
