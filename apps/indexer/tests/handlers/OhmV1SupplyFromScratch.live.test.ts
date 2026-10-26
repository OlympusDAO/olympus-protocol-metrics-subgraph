import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { describe, expect, it, vi } from "vitest";

import { buildOhmTransferWhere, handleOhmTransfer } from "../../src/handlers/Erc20Transfers";
import { addr } from "../../src/snapshot/math";

// Needs HyperSync (ENVIO_API_TOKEN) for the logs and an Ethereum archive RPC
// for the state reads; skipped without them, never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
// OHM v1's creation, to a block a month later.
const FROM = 12_084_967;
const TO = 12_240_000;

// Replays every OHM v1 Transfer the OhmERC20 filter delivers through the real
// handler, starting from an empty Erc20Supply, and compares with the chain.
// It doesn't use createTestIndexer, which applies each event in a range twice
// (tasks/lessons.md, 2026-10-26). A ledger seeded from balanceOf can't catch a
// missed mint path; this one starts from nothing.
describe.skipIf(!canRun)("OHM v1 supply from an empty ledger — live", () => {
  it(`rebuilds totalSupply() and the DAO wallet's OHM v1 from Transfers, ${FROM}-${TO}`, async () => {
    const client = createPublicClient({ transport: http(RPC_URL) });
    const where = buildOhmTransferWhere({ chain: { id: 1 } });
    if (where === false) throw new Error("no OhmERC20 filter on Ethereum");
    const fromFilter = where.params.flatMap((clause) =>
      "from" in clause && clause.from ? clause.from : [],
    );
    const toFilter = where.params.flatMap((clause) =>
      "to" in clause && clause.to ? clause.to : [],
    );

    // The filter's clauses are OR'd: one HyperSync log selection per side
    // (the same source the runtime uses), merged by log id.
    const pad = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
    const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const logs = new Map<
      string,
      { from: string; to: string; value: bigint; block: bigint; logIndex: number }
    >();
    let next = FROM;
    while (next <= TO) {
      const response = await fetch("https://eth.hypersync.xyz/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.ENVIO_API_TOKEN}`,
        },
        body: JSON.stringify({
          from_block: next,
          to_block: TO + 1,
          logs: [
            { address: [OHM_V1], topics: [[TRANSFER_TOPIC], fromFilter.map(pad)] },
            { address: [OHM_V1], topics: [[TRANSFER_TOPIC], [], toFilter.map(pad)] },
          ],
          field_selection: {
            log: ["block_number", "log_index", "transaction_hash", "topic1", "topic2", "data"],
          },
        }),
      });
      if (!response.ok) throw new Error(`HyperSync ${response.status}`);
      const body = (await response.json()) as {
        data?: { logs?: Record<string, string | number>[] }[];
        next_block: number;
      };
      for (const log of (body.data ?? []).flatMap((page) => page.logs ?? [])) {
        logs.set(`${log.transaction_hash}-${log.log_index}`, {
          from: `0x${String(log.topic1).slice(26)}`,
          to: `0x${String(log.topic2).slice(26)}`,
          value: BigInt(String(log.data)),
          block: BigInt(log.block_number),
          logIndex: Number(log.log_index),
        });
      }
      if (body.next_block <= next) break;
      next = body.next_block;
    }

    const store = new Map<string, Record<string, unknown>>();
    const table = (name: string) => ({
      get: async (id: string) => store.get(`${name}:${id}`),
      set: vi.fn((entity: { id: string }) => store.set(`${name}:${entity.id}`, entity)),
    });
    const context = {
      TokenBalance: table("TokenBalance"),
      TokenBalanceUpdate: table("TokenBalanceUpdate"),
      Erc20Supply: table("Erc20Supply"),
      Erc20SupplyUpdate: table("Erc20SupplyUpdate"),
      LenderAmo: table("LenderAmo"),
    };
    const ordered = [...logs.values()].sort((a, b) =>
      a.block === b.block ? a.logIndex - b.logIndex : Number(a.block - b.block),
    );
    for (const log of ordered) {
      await handleOhmTransfer({
        event: {
          chainId: 1,
          srcAddress: OHM_V1,
          logIndex: log.logIndex,
          block: { number: Number(log.block), timestamp: 0 },
          params: { from: log.from, to: log.to, value: log.value },
        },
        context: context as never,
      });
    }

    const erc20 = parseAbi([
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
    ]);
    const [supply, dao] = await Promise.all([
      client.readContract({
        address: getAddress(OHM_V1),
        abi: erc20,
        functionName: "totalSupply",
        blockNumber: BigInt(TO),
      }),
      client.readContract({
        address: getAddress(OHM_V1),
        abi: erc20,
        functionName: "balanceOf",
        args: [getAddress(DAO_WALLET)],
        blockNumber: BigInt(TO),
      }),
    ]);
    process.stderr.write(`${ordered.length} OHM v1 Transfers; totalSupply ${supply}, DAO ${dao}\n`);
    expect(ordered.length).toBeGreaterThan(0);
    expect(supply).toBeGreaterThan(0n);
    expect((store.get(`Erc20Supply:1-${OHM_V1}`) as { totalSupply: bigint }).totalSupply).toBe(
      supply,
    );
    expect(
      (store.get(`TokenBalance:1-${OHM_V1}-${DAO_WALLET}`) as { balance: bigint }).balance,
    ).toBe(dao);
  }, 900_000);
});
