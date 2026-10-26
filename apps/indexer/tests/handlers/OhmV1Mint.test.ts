import { describe, expect, test, vi } from "vitest";

import { buildOhmTransferWhere, handleOhmTransfer } from "../../src/handlers/Erc20Transfers";
import { addr } from "../../src/snapshot/math";

const OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const OHM_V2 = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
const ZERO = "0x0000000000000000000000000000000000000000";
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
const OUTSIDER = addr("0xd7c4208aeb0961972b3ea717be25f2194d5f0331");

function buildContext() {
  const store = new Map<string, Record<string, unknown>>();
  const table = (name: string) => ({
    get: async (id: string) => store.get(`${name}:${id}`),
    set: vi.fn((entity: { id: string }) => store.set(`${name}:${entity.id}`, entity)),
  });
  return {
    store,
    context: {
      TokenBalance: table("TokenBalance"),
      TokenBalanceUpdate: table("TokenBalanceUpdate"),
      Erc20Supply: table("Erc20Supply"),
      Erc20SupplyUpdate: table("Erc20SupplyUpdate"),
      LenderAmo: table("LenderAmo"),
    },
  };
}

const transfer = (token: string, from: string, to: string, value: bigint, logIndex = 0) => ({
  chainId: 1,
  srcAddress: token,
  logIndex,
  block: { number: 12_085_665, timestamp: 1_616_380_000 },
  params: { from, to, value },
});

// OHM v1 (OlympusERC20Token) mints with Transfer(address(this), to, amount)
// rather than from the zero address: its first mint, 68,260 OHM at block
// 12,085,665, is Transfer(OHM v1, 0xd7c4…, 68,260e9). 1,187 such mints minus
// two burns to 0x0 reproduce totalSupply() at 12,643,200 exactly.
describe("OHM v1 self-addressed mints", () => {
  test("Transfer from the token itself counts as a mint", async () => {
    const { context, store } = buildContext();
    await handleOhmTransfer({
      event: transfer(OHM_V1, OHM_V1, OUTSIDER, 68_260_000_000_000n),
      context: context as never,
    });
    expect(store.get(`Erc20Supply:1-${OHM_V1}`)).toMatchObject({
      totalSupply: 68_260_000_000_000n,
    });
  });

  test("a self-addressed mint to a protocol wallet also credits the wallet", async () => {
    const { context, store } = buildContext();
    await handleOhmTransfer({
      event: transfer(OHM_V1, OHM_V1, DAO_WALLET, 5_000_000_000n),
      context: context as never,
    });
    expect(store.get(`Erc20Supply:1-${OHM_V1}`)).toMatchObject({ totalSupply: 5_000_000_000n });
    expect(store.get(`TokenBalance:1-${OHM_V1}-${DAO_WALLET}`)).toMatchObject({
      balance: 5_000_000_000n,
    });
  });

  test("burns to the zero address still reduce supply", async () => {
    const { context, store } = buildContext();
    await handleOhmTransfer({
      event: transfer(OHM_V1, OHM_V1, OUTSIDER, 10n),
      context: context as never,
    });
    await handleOhmTransfer({
      event: transfer(OHM_V1, OUTSIDER, ZERO, 4n, 1),
      context: context as never,
    });
    expect(store.get(`Erc20Supply:1-${OHM_V1}`)).toMatchObject({ totalSupply: 6n });
  });

  test("OHM v2 sent from its own address is a plain transfer, not a mint", async () => {
    const { context, store } = buildContext();
    await handleOhmTransfer({
      event: transfer(OHM_V2, OHM_V2, OUTSIDER, 10n),
      context: context as never,
    });
    expect(store.get(`Erc20Supply:1-${OHM_V2}`)).toBeUndefined();
  });

  test("the Ethereum filter subscribes to OHM v1's self-addressed Transfers", () => {
    const where = buildOhmTransferWhere({ chain: { id: 1 } });
    expect(where).not.toBe(false);
    const params = (where as unknown as { params: Record<string, string[]>[] }).params;
    expect(params).toContainEqual({ from: [OHM_V1] });
  });
});
