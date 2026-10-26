import type { EvmOnBlockContext } from "envio";
import { describe, expect, test, vi } from "vitest";

import { pushTotalSupply, pushTreasuryOhm } from "../../src/handlers/BlockHandlers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr, ohmTokenAt, ohmTokens } from "../../src/snapshot/math";
import type { SerializedTokenSupply } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const TIMESTAMP = 1_700_000_000n;
const OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const OHM_V2 = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
// OHM v1 creation, and the first OHM v2 mint (the migrator's
// migrateContracts). OHM v2 was deployed at 13,782,589 but had no supply
// until 13,805,112.
const OHM_V1_BLOCK = 12_084_967;
const OHM_V2_FIRST_MINT_BLOCK = 13_805_112;

describe("ohmTokenAt", () => {
  test("Ethereum is OHM v1 up to the first OHM v2 mint, then OHM v2", () => {
    expect(ohmTokenAt(ETHEREUM, BigInt(OHM_V1_BLOCK))).toBe(OHM_V1);
    expect(ohmTokenAt(ETHEREUM, 13_782_589n)).toBe(OHM_V1);
    expect(ohmTokenAt(ETHEREUM, BigInt(OHM_V2_FIRST_MINT_BLOCK - 1))).toBe(OHM_V1);
    expect(ohmTokenAt(ETHEREUM, BigInt(OHM_V2_FIRST_MINT_BLOCK))).toBe(OHM_V2);
    expect(ohmTokenAt(ETHEREUM, 26_000_000n)).toBe(OHM_V2);
  });

  test("Ethereum's OHM supply starts at OHM v1 creation", () => {
    expect(ETHEREUM.ohmStartBlock).toBe(OHM_V1_BLOCK);
    expect(ETHEREUM.ohmEras?.[0]).toEqual({ token: OHM_V1, startBlock: OHM_V1_BLOCK });
  });

  test("chains without eras keep their configured token", () => {
    for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
      if (Number(chainId) === 1) continue;
      expect(config.ohmEras).toBeUndefined();
      expect(ohmTokenAt(config, 10n ** 9n)).toBe(config.ohmToken);
      expect(ohmTokens(config)).toEqual(config.ohmToken ? [config.ohmToken] : []);
    }
  });

  test("every era's token is excluded from backing", () => {
    expect(ohmTokens(ETHEREUM)).toEqual([OHM_V1, OHM_V2]);
  });
});

describe("Ethereum supply by era", () => {
  // OHM v1 total supply at block 13,000,000 (3,166,575 OHM) and OHM v2 at
  // 13,807,200 (6,322,883 OHM). DAO wallet v1 balance at 13,000,000.
  function buildContext() {
    return {
      Erc20Supply: {
        get: async (id: string) => {
          if (id === `1-${OHM_V1}`) return { totalSupply: 3_166_575_000_000_000n };
          if (id === `1-${OHM_V2}`) return { totalSupply: 6_322_883_388_737_804n };
          return undefined;
        },
      },
      TokenBalance: {
        get: async (id: string) =>
          id === `1-${OHM_V1}-${DAO_WALLET}` ? { balance: 226_262_787_070_621n } : undefined,
      },
      OhmIndexState: { get: async () => undefined },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect: vi.fn(async () => "0"),
    } as unknown as EvmOnBlockContext;
  }

  async function suppliesAt(blockNumber: number) {
    const supplies: SerializedTokenSupply[] = [];
    await pushTotalSupply(buildContext(), ETHEREUM, supplies, TIMESTAMP, BigInt(blockNumber));
    await pushTreasuryOhm(buildContext(), ETHEREUM, supplies, TIMESTAMP, BigInt(blockNumber));
    return supplies;
  }

  test("no OHM supply before OHM v1 exists", async () => {
    expect(await suppliesAt(OHM_V1_BLOCK - 1)).toEqual([]);
  });

  test("the v1 era counts OHM v1 total supply and treasury OHM v1", async () => {
    const supplies = await suppliesAt(13_000_000);
    const total = supplies.find((s) => s.type === "Total Supply");
    expect(total?.tokenAddress).toBe(OHM_V1);
    expect(total?.token).toBe("OHM V1");
    expect(total?.supplyBalance).toBe("3166575");
    const dao = supplies.find((s) => s.type === "Treasury" && s.sourceAddress === DAO_WALLET);
    expect(dao?.tokenAddress).toBe(OHM_V1);
    expect(dao?.supplyBalance).toBe("-226262.787070621");
  });

  test("from the first OHM v2 mint, only OHM v2 counts", async () => {
    const supplies = await suppliesAt(OHM_V2_FIRST_MINT_BLOCK);
    expect(supplies.every((s) => s.tokenAddress !== OHM_V1)).toBe(true);
    const total = supplies.find((s) => s.type === "Total Supply");
    expect(total?.tokenAddress).toBe(OHM_V2);
    expect(total?.supplyBalance).toBe("6322883.388737804");
  });
});

describe("non-circulating OHM v1 (the v1 CirculatingSupply oracle's list)", () => {
  // nonCirculatingOHMAddresses on 0x0EFFf9199Aa1Ac3C3E34E957567C1BE8bF295034,
  // besides the DAO wallet (already a protocol wallet).
  const EXCLUDED = {
    "Staking Distributor V1": addr("0xbe731507810C8747C3E01E62c676b1cA6F93242f"),
    "Staking Distributor V1 (2)": addr("0xcE6568338708400D03F430d29F2Eb40a33a3f4C4"),
    "OHM-DAI SLP Bond V1": addr("0xd27001d1aAEd5f002C722Ad729de88a91239fF29"),
    "OHM-DAI SLP Bond V1 (2)": addr("0x13E8484a86327f5882d1340ed0D7643a29548536"),
    "aOHM Migration": addr("0xC7f56EC779cB9e60afA116d73F3708761197dB3d"),
    "Circulating Supply Exclusion 0x39Ba": addr("0x39Baa524eab3f5C9D0738BdF781c3eC9C8D34867"),
  };
  const ASSOCIATION = addr("0x4c71db02aeeb336cbd8f3d2cc866911f6e2fbd94");

  // Every excluded wallet holds 1,000 of whatever OHM token is read.
  function buildContext() {
    const effect = vi.fn(async (_effect: unknown, _input: unknown) => "1000000000000");
    return {
      context: {
        Erc20Supply: { get: async () => undefined },
        TokenBalance: { get: async () => undefined },
        OhmIndexState: { get: async () => undefined },
        log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
        effect,
      } as unknown as EvmOnBlockContext,
      effect,
    };
  }

  async function extraRowsAt(blockNumber: number) {
    const { context, effect } = buildContext();
    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(context, ETHEREUM, supplies, TIMESTAMP, BigInt(blockNumber));
    return { rows: supplies, effect };
  }

  test("each wallet's OHM v1 is deducted as treasury OHM in the v1 era", async () => {
    const { rows, effect } = await extraRowsAt(13_000_000);
    for (const [name, address] of Object.entries(EXCLUDED)) {
      const row = rows.find((s) => s.sourceAddress === address);
      expect(row?.source).toBe(name);
      expect(row?.type).toBe("Treasury");
      expect(row?.tokenAddress).toBe(OHM_V1);
      expect(row?.supplyBalance).toBe("-1000");
    }
    // The balance is read from OHM v1 at the snapshot block.
    expect(effect).toHaveBeenCalledWith(expect.anything(), {
      chainId: 1,
      tokenAddress: OHM_V1,
      walletAddress: EXCLUDED["Staking Distributor V1"],
      atBlock: 13_000_000,
    });
    expect(rows.some((s) => s.sourceAddress === ASSOCIATION)).toBe(false);
  });

  test("none of them is read in the v2 era", async () => {
    const { rows, effect } = await extraRowsAt(OHM_V2_FIRST_MINT_BLOCK);
    const excluded = new Set<string>(Object.values(EXCLUDED));
    expect(rows.some((s) => excluded.has(s.sourceAddress ?? ""))).toBe(false);
    const readWallets = effect.mock.calls.map(
      ([, input]) => (input as unknown as { walletAddress: string }).walletAddress,
    );
    expect(readWallets.some((wallet) => excluded.has(wallet))).toBe(false);
  });

  test("the Olympus Association stays OHM v2 only, up to 17,114,999", async () => {
    expect((await extraRowsAt(OHM_V2_FIRST_MINT_BLOCK)).rows).toContainEqual(
      expect.objectContaining({ sourceAddress: ASSOCIATION, tokenAddress: OHM_V2 }),
    );
    expect((await extraRowsAt(17_115_000)).rows.some((s) => s.sourceAddress === ASSOCIATION)).toBe(
      false,
    );
  });
});
