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
