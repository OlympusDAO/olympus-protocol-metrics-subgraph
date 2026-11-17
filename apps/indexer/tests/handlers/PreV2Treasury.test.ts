import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("UniV3 pricing pools start at creation", () => {
  test.each([
    ["0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa", 15_384_250], // WETH-wstETH
    ["0xdf9ab3c649005ebfdf682d2302ca1f673e0d37a2", 13_826_232], // WETH-BTRFLY v1
  ])("%s starts at %i (getCode)", (pool, startBlock) => {
    expect(ETHEREUM.liquidityHandlers.find((handler) => handler.id === pool)?.startBlock).toBe(
      startBlock,
    );
  });
});

describe("SPELL, PRIME and agEUR", () => {
  const SPELL = addr("0x090185f2135308BaD17527004364eBcC2D37e5F6");
  const PRIME = addr("0x43D4A3cd90ddD2F8f4f693170C9c8098163502ad");
  const AGEUR = addr("0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8");
  const SUSHI_SPELL_WETH = addr("0xb5De0C3753b6E1B4dBA616Db82767F17513E6d4E");
  const BALANCER_D2D_USDC = "0x27c9f71cc31464b906e0006d4fcbc8900f48f15f00020000000000000000010f";
  const CHAINLINK_EUR_USD = addr("0xb49f677943BC038e9857d61E7d053CaA2C1734C1");

  test.each([
    [SPELL, true, 12_454_535],
    [PRIME, false, 13_726_726],
    [AGEUR, true, 13_473_069],
  ])("%s is a volatile treasury token from its creation", (token, isLiquid, startBlock) => {
    expect(getTokenDefinition(ETHEREUM, token)).toMatchObject({
      category: "Volatile",
      isLiquid,
      startBlock,
      decimals: 18,
    });
  });

  test("each is priced from its deepest source", () => {
    const handler = (id: string) => ETHEREUM.liquidityHandlers.find((value) => value.id === id);
    expect(handler(SUSHI_SPELL_WETH)).toMatchObject({ kind: "univ2", startBlock: 12_519_150 });
    expect(handler(SUSHI_SPELL_WETH)?.tokens).toContain(SPELL);
    expect(handler(BALANCER_D2D_USDC)).toMatchObject({ kind: "balancer", startBlock: 13_823_879 });
    expect(handler(BALANCER_D2D_USDC)?.tokens).toContain(PRIME);
    expect(handler(CHAINLINK_EUR_USD)).toMatchObject({
      kind: "chainlink",
      tokens: [AGEUR],
      decimals: 8,
    });
  });

  test("their Transfers are indexed for protocol wallets", () => {
    const config = readFileSync(resolve(__dirname, "../../config.yaml"), "utf8").toLowerCase();
    for (const token of [SPELL, PRIME, AGEUR]) expect(config).toContain(`"${token}"`);
    expect(config).toContain(`"${SUSHI_SPELL_WETH}"`);
  });
});

describe("tokens legacy tracked and the Envio port dropped", () => {
  const T = {
    ALCX: addr("0xdbdb4d16eda451d0503b854cf79d55697f90c8df"),
    CRV: addr("0xd533a949740bb3306d119cc777fa900ba034cd52"),
    FDT: addr("0xed1480d12be41d92f36f5f7bdd88212e381a3677"),
    FOX: addr("0xc770eefad204b5180df6a14ee197d99d808ee52d"),
    FPIS: addr("0xc2544a32872a91f4a553b404c6950e89de901fdb"),
    KP3R: addr("0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44"),
    SUSHI: addr("0x6b3595068778dd592e39a122f4f5a5cf09c90fe2"),
    SYN: addr("0x0f2d719407fdbeff09d87557abb7232601fd9f29"),
    THOR: addr("0xa5f2211b9b8170f694421f2046281775e8468044"),
  };
  const WETH = addr("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  const FRAX = addr("0x853d955acef822db058eb8505911ed77f175b99e");
  const handler = (id: string) =>
    ETHEREUM.liquidityHandlers.find((value) => value.id.toLowerCase() === id.toLowerCase());

  test.each([
    ["ALCX", T.ALCX, "Alchemix", 11_937_199],
    ["CRV", T.CRV, "Curve", 10_647_806],
    ["FDT", T.FDT, "FDT", 13_542_271],
    ["FOX", T.FOX, "FOX", 7_446_830],
    ["FPIS", T.FPIS, "FPIS", 14_482_720],
    ["KP3R", T.KP3R, "KP3R", 11_143_904],
    ["SUSHI", T.SUSHI, "SushiSwap", 10_736_094],
    ["SYN", T.SYN, "SYN", 13_025_432],
    ["THOR", T.THOR, "THOR", 13_456_700],
  ])(
    "%s is a liquid volatile token named as legacy named it, from its creation",
    (symbol, token, name, startBlock) => {
      expect(getTokenDefinition(ETHEREUM, token)).toMatchObject({
        category: "Volatile",
        isLiquid: true,
        isBluechip: false,
        startBlock,
        decimals: 18,
      });
      expect(ETHEREUM.names[token]).toBe(name);
      expect(ETHEREUM.abbreviations[token]).toBe(symbol);
    },
  );

  test("Chainlink prices CRV and FOX in USD, ALCX, KP3R and SUSHI through ETH", () => {
    expect(handler("0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f")).toMatchObject({
      kind: "chainlink",
      tokens: [T.CRV],
      decimals: 8,
    });
    expect(handler("0xccA02FFEFAcE21325befD6616cB4Ba5fCB047480")).toMatchObject({
      kind: "chainlink",
      tokens: [T.FOX],
      decimals: 8,
      startBlock: 13_810_120,
    });
    for (const [feed, token] of [
      ["0x194a9AaF2e0b67c35915cD01101585A33Fe25CAa", T.ALCX],
      ["0xe7015CCb7E5F788B8c1010FC22343473EaaC3741", T.KP3R],
      ["0xe572CeF69f43c2E488b33924AF04BDacE19079cf", T.SUSHI],
    ]) {
      expect(handler(feed)).toMatchObject({
        kind: "chainlink",
        tokens: [token],
        decimals: 18,
        quote: WETH,
      });
    }
  });

  test("the rest price from pools, with FOX-ETH covering FOX before its feed", () => {
    expect(handler("0x470e8de2ebaef52014a47cb5e6af86884947f08c")).toMatchObject({ kind: "univ2" });
    expect(handler("0x470e8de2ebaef52014a47cb5e6af86884947f08c")?.tokens).toEqual(
      expect.arrayContaining([T.FOX, WETH]),
    );
    expect(handler("0x4a86c01d67965f8cb3d0aaa2c655705e64097c31")).toMatchObject({
      kind: "univ2",
      startBlock: 13_116_399,
    });
    expect(handler("0x4a86c01d67965f8cb3d0aaa2c655705e64097c31")?.tokens).toEqual(
      expect.arrayContaining([T.SYN, WETH]),
    );
    expect(handler("0x3d3f13f2529ec3c84b2940155effbf9b39a8f3ec")).toMatchObject({
      kind: "univ2",
      startBlock: 13_547_236,
    });
    expect(handler("0x3d3f13f2529ec3c84b2940155effbf9b39a8f3ec")?.tokens).toEqual(
      expect.arrayContaining([T.THOR, WETH]),
    );
    expect(
      handler("0x2d344a84bac123660b021eebe4eb6f12ba25fe8600020000000000000000018a"),
    ).toMatchObject({ kind: "balancer", startBlock: 14_528_660 });
    expect(
      handler("0x2d344a84bac123660b021eebe4eb6f12ba25fe8600020000000000000000018a")?.tokens,
    ).toEqual(expect.arrayContaining([T.FDT, WETH]));
    expect(handler("0x8fe536c7dc019455cce34746755c64bbe2aa163b")).toMatchObject({
      kind: "univ3",
      fee: 10000,
      startBlock: 14_546_561,
    });
    expect(handler("0x8fe536c7dc019455cce34746755c64bbe2aa163b")?.tokens).toEqual(
      expect.arrayContaining([T.FPIS, FRAX]),
    );
  });

  test("their Transfers and their pools' events are indexed", () => {
    const config = readFileSync(resolve(__dirname, "../../config.yaml"), "utf8").toLowerCase();
    for (const token of Object.values(T)) expect(config).toContain(`"${token}"`);
    for (const pool of [
      "0x470e8de2ebaef52014a47cb5e6af86884947f08c",
      "0x4a86c01d67965f8cb3d0aaa2c655705e64097c31",
      "0x3d3f13f2529ec3c84b2940155effbf9b39a8f3ec",
      "0x8fe536c7dc019455cce34746755c64bbe2aa163b",
    ]) {
      expect(config).toContain(`"${pool}"`);
    }
  });
});
