import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { readMasterChefStake } from "../../src/effects";
import { pushLiquidityPositionRecords } from "../../src/handlers/LiquidityPositions";
import { withPricingCache } from "../../src/pricing";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr, getTokenDecimals } from "../../src/snapshot/math";
import { getTokenDefinition } from "../../src/snapshot/records";
import type { SerializedTokenRecord, SerializedTokenSupply } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const TIMESTAMP = 1_630_000_000n;

const OHM_V1 = addr("0x383518188c0c6d7730d91b2c03a03c837814a899");
const CVX = addr("0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b");
const TREASURY_V1 = addr("0x886CE997aa9ee4F8c2282E182aB72A705762399D");
const TREASURY_V2 = addr("0x31f8cc382c9898b273eff4e0b7626a6987c846e8");
const TREASURY_V3 = addr("0x9A315BdF513367C0377FB36545857d12e85813Ef");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
const ONSEN_ALLOCATOR = addr("0x0316508a1b5abf1CAe42912Dc2C8B9774b682fFC");
const MASTERCHEF = addr("0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd");
const CONVEX_CVX_ALLOCATOR = addr("0xdfc95aaf0a107daae2b350458ded4b7906e7f728");
const VLCVX_V1 = addr("0xD18140b4B819b895A3dba5442F959fA44994AF50");

const LP = {
  ohmDaiV1: addr("0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c"),
  ohmEthV1: addr("0xfffae4a0f4ac251f4705717cd24cadccc9f33e06"),
  ohmFraxV1: addr("0x2dce0dda1c2f98e0f171de8333c3c6fe1bbf4877"),
  ohmLusdV1: addr("0xfdf12d1f85b5082877a6e070524f50f6c84faa6b"),
  ohmFraxV2: addr("0xB612c37688861f1f90761DC7F382C2aF3a50Cc39"),
  ohmLusdV2: addr("0x46E4D8A1322B9448905225E52F914094dBd6dDdF"),
};

describe("pre-v2 protocol-owned liquidity config", () => {
  const position = (lpToken: string) =>
    ETHEREUM.liquidityPositions?.find((value) => value.lpToken === lpToken);

  test.each([
    [LP.ohmDaiV1, "SushiSwap OHM V1-DAI Liquidity Pool", 12_092_097],
    [LP.ohmEthV1, "SushiSwap OHM V1-ETH Liquidity Pool", 12_310_798],
    [LP.ohmFraxV1, "Uniswap V2 OHM V1-FRAX Liquidity Pool", 12_563_434],
    [LP.ohmLusdV1, "SushiSwap OHM V1-LUSD Liquidity Pool", 13_327_921],
    [LP.ohmFraxV2, "Uniswap V2 OHM V2-FRAX Liquidity Pool", 13_823_710],
    [LP.ohmLusdV2, "SushiSwap OHM V2-LUSD Liquidity Pool", 14_381_693],
  ])("%s is valued from its creation block", (lpToken, label, startBlock) => {
    const value = position(lpToken);
    expect(value?.poolLabel).toBe(label);
    expect(value?.startBlock).toBe(startBlock);
    expect(value?.pricing.kind).toBe("univ2");
    expect(value?.pricing.id).toBe(lpToken);
    expect(value?.pricing.startBlock).toBe(startBlock);
    const wallets = value?.sources.find((source) => source.kind === "wallet");
    expect(wallets?.wallets).toEqual([TREASURY_V1, TREASURY_V2, TREASURY_V3, DAO_WALLET]);
  });

  test("OHM-FRAX v2 and OHM-LUSD v2 value POL only, they aren't OHM price sources", () => {
    const priceSources = new Set(ETHEREUM.liquidityHandlers.map((handler) => handler.id));
    expect(priceSources.has(LP.ohmFraxV2)).toBe(false);
    expect(priceSources.has(LP.ohmLusdV2)).toBe(false);
  });

  test("the Onsen allocator's staked SLP is read from MasterChef v1, not as a protocol wallet", () => {
    for (const [lpToken, pid] of [
      [LP.ohmDaiV1, 185],
      [LP.ohmLusdV1, 323],
    ] as const) {
      const source = position(lpToken)?.sources.find((value) => value.kind === "masterchef");
      expect(source).toMatchObject({
        kind: "masterchef",
        contract: MASTERCHEF,
        pid,
        wallets: [ONSEN_ALLOCATOR],
        startBlock: 12_744_441,
        lastActiveBlock: 14_360_925,
      });
    }
    expect(ETHEREUM.protocolAddresses).not.toContain(ONSEN_ALLOCATOR);
  });
});

describe("pre-v2 POL valuation", () => {
  function buildContext(state: {
    reserves: Record<string, { reserve0: bigint; reserve1: bigint }>;
    lpSupply: Record<string, bigint>;
    balances: Record<string, bigint>;
    staked?: Record<string, string>;
  }) {
    const effect = vi.fn(async (definition: unknown, input: Record<string, unknown>) => {
      if (definition === readMasterChefStake) {
        return state.staked?.[`${input.pid}:${addr(String(input.wallet))}`] ?? "0";
      }
      // Chainlink DAI/USD: $1.
      if (input.feedAddress !== undefined) return "100000000";
      return "0";
    });
    const context = {
      Univ2PoolState: { get: async (id: string) => state.reserves[id.slice(2)] },
      Univ3PoolState: { get: async () => undefined },
      BalancerPoolState: { get: async () => undefined },
      KodiakPool: { get: async () => undefined },
      Erc20Supply: {
        get: async (id: string) =>
          state.lpSupply[id.slice(2)] === undefined
            ? undefined
            : { totalSupply: state.lpSupply[id.slice(2)] },
      },
      TokenBalance: {
        get: async (id: string) =>
          state.balances[id.slice(2)] === undefined
            ? undefined
            : { balance: state.balances[id.slice(2)] },
      },
      OhmIndexState: { get: async () => undefined },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect,
    } as unknown as EvmOnBlockContext;
    return { context, effect };
  }

  async function run(context: EvmOnBlockContext, block: bigint) {
    const records: SerializedTokenRecord[] = [];
    const supplies: SerializedTokenSupply[] = [];
    await withPricingCache(() =>
      pushLiquidityPositionRecords(
        context,
        ETHEREUM,
        {} as PublicClient,
        records,
        supplies,
        TIMESTAMP,
        block,
      ),
    );
    return { records, supplies };
  }

  test("OHM-DAI v1 in the v1 era splits like the v2 pools", async () => {
    // Block 13,000,000: 57,952.73 OHM v1 / 23,737,950.63 DAI over 32.3654 LP,
    // 28.9409 LP in Treasury V2.
    const { context } = buildContext({
      reserves: {
        [LP.ohmDaiV1]: {
          reserve0: 57_952_733_574_972n,
          reserve1: 23_737_950_634_680_499_314_363_618n,
        },
      },
      lpSupply: { [LP.ohmDaiV1]: 32_365_424_341_764_861_449n },
      balances: { [`${LP.ohmDaiV1}-${TREASURY_V2}`]: 28_940_892_700_577_562_925n },
    });
    const { records, supplies } = await run(context, 13_000_000n);

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record.token).toBe("SushiSwap OHM V1-DAI Liquidity Pool");
    expect(record.sourceAddress).toBe(TREASURY_V2);
    // Both sides priced (OHM v1 at ~$409.6), so the non-OHM share is 0.5.
    expect(Number(record.multiplier)).toBeCloseTo(0.5, 9);
    expect(Number(record.value)).toBeCloseTo((2 * 23_737_950.63 * 28.9409) / 32.36542, -2);
    expect(Number(record.valueExcludingOhm)).toBeCloseTo((23_737_950.63 * 28.9409) / 32.36542, -2);

    const liquidity = supplies.find((s) => s.type === "Liquidity");
    expect(liquidity?.tokenAddress).toBe(OHM_V1);
    expect(liquidity?.pool).toBe("SushiSwap OHM V1-DAI Liquidity Pool");
    expect(Number(liquidity?.supplyBalance)).toBeCloseTo((-57_952.733 * 28.9409) / 32.36542, 1);
  });

  test("while OHM-DAI v1 is the only v1 pool, its OHM side is priced off its own reserves", async () => {
    // Block 12,300,000, before OHM-ETH v1 (12,310,798): 9,160.55 OHM v1 /
    // 11,216,125.19 DAI over 9.3917 LP, 7.0765 LP in Treasury V1.
    const { context } = buildContext({
      reserves: {
        [LP.ohmDaiV1]: {
          reserve0: 9_160_552_719_788n,
          reserve1: 11_216_125_188_516_627_565_920_026n,
        },
      },
      lpSupply: { [LP.ohmDaiV1]: 9_391_696_850_905_281_074n },
      balances: { [`${LP.ohmDaiV1}-${TREASURY_V1}`]: 7_076_455_292_110_634_567n },
    });
    const { records } = await run(context, 12_300_000n);
    expect(records).toHaveLength(1);
    expect(Number(records[0].multiplier)).toBeCloseTo(0.5, 9);
  });

  test("a v1 pool held after the v2 switch keeps its OHM v1 out of backing and supply", async () => {
    // Block 13,850,000: OHM-LUSD v1 with 67,093.10 OHM v1 / 32,085,369.44
    // LUSD over 45.8303 LP; 30.7568 LP in Treasury V2 and 15 LP staked in
    // Onsen. LUSD at $1 (Chainlink).
    const { context } = buildContext({
      reserves: {
        [LP.ohmLusdV1]: {
          reserve0: 67_093_099_325_688n,
          reserve1: 32_085_369_436_733_098_541_948_094n,
        },
        [LP.ohmDaiV1]: { reserve0: 1_000_000_000_000n, reserve1: 400_000n * 10n ** 18n },
      },
      lpSupply: { [LP.ohmLusdV1]: 45_830_269_515_786_940_686n },
      balances: { [`${LP.ohmLusdV1}-${TREASURY_V2}`]: 30_756_806_064_811_241_596n },
      staked: { [`323:${ONSEN_ALLOCATOR}`]: (15n * 10n ** 18n).toString() },
    });
    const { records, supplies } = await run(context, 13_850_000n);

    const lusd = records.filter((r) => r.token.startsWith("SushiSwap OHM V1-LUSD"));
    expect(lusd.map((r) => [r.token, r.sourceAddress, r.balance])).toEqual([
      ["SushiSwap OHM V1-LUSD Liquidity Pool", TREASURY_V2, "30.756806064811241596"],
      ["SushiSwap OHM V1-LUSD Liquidity Pool - Staked in Onsen", ONSEN_ALLOCATOR, "15"],
    ]);
    for (const record of lusd) {
      expect(record.tokenAddress).toBe(LP.ohmLusdV1);
      expect(Number(record.multiplier)).toBeLessThan(1);
      expect(Number(record.multiplier)).toBeGreaterThan(0);
    }
    // OHM v1 isn't part of v2 supply.
    expect(supplies).toEqual([]);
  });
});

describe("vlCVX v1", () => {
  test("is vote-locked CVX, priced as CVX, illiquid, read for the CVX allocator only", () => {
    const definition = getTokenDefinition(ETHEREUM, VLCVX_V1);
    expect(definition).toMatchObject({
      category: "Volatile",
      isLiquid: false,
      startBlock: 13_153_663,
      positionRead: { method: "erc20.balanceOf", wallets: [CONVEX_CVX_ALLOCATOR] },
    });
    expect(getTokenDecimals(ETHEREUM.tokens, VLCVX_V1)).toBe(18);
    expect(ETHEREUM.liquidityHandlers.find((handler) => handler.id === VLCVX_V1)).toMatchObject({
      kind: "remap",
      target: CVX,
    });
  });

  test("unlocked but unwithdrawn vlCVX v1 counts as CVX", () => {
    const unlocked = ETHEREUM.protocolPositions?.find(
      (position) => position.kind === "read" && position.contract === VLCVX_V1,
    );
    expect(unlocked).toMatchObject({
      kind: "read",
      method: "vlCvx.unlockable",
      token: CVX,
      label: "Convex - Unlocked (vlCVX V1)",
      wallets: [CONVEX_CVX_ALLOCATOR],
      startBlock: 13_153_663,
    });
  });
});
