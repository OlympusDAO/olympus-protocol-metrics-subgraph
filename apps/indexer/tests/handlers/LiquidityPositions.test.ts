import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushLiquidityPositionRecords } from "../../src/handlers/LiquidityPositions";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type {
  ChainConfig,
  SerializedTokenRecord,
  SerializedTokenSupply,
} from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const TIMESTAMP = 1_700_000_000n;

const OHM = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
const DAI = addr("0x6b175474e89094c44da98b954eedeac495271d0f");
const WETH = addr("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const FRAX = addr("0x853d955acef822db058eb8505911ed77f175b99e");
const USDC = addr("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const TREASURY_V3 = addr("0x9A315BdF513367C0377FB36545857d12e85813Ef");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
const AURA_ALLOCATOR = addr("0x872ebDd8129Aa328C89f6BF032bBD77a4c4BaC7e");
const SUSHI_OHM_DAI = addr("0x055475920a8c93cffb64d039a8205f7acc7722d3");
const BPT_OHM_DAI_WETH = addr("0xc45d42f801105e861e86658648e3678ad7aa70f9");
const POOL_ID_OHM_DAI_WETH = "0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e";
const AURA_POOL_OHM_DAI_WETH = addr("0xF01e29461f1FCEdD82f5258Da006295E23b4Fab3");
const AURA_DEPOSIT_OHM_DAI_WETH = addr("0x622A725a79C7fE37AD839C640cD62d546712B3A9");
const FRAX_FARM_FRAXBP = addr("0x963f487796d54d2f27bA6F3Fbe91154cA103b199");
const CONVEX_STAKING_PROXY_FRAXBP = addr("0x943C1dfA7dA96e54242bD2c78DD3eF5C7b24b18C");
const STKCVX_FRAXBP = addr("0x8a53ee42FB458D4897e15cc7dEa3F75D0F1c3475");

// On-chain state at block 14,694,800 (2022-05-01) and 16,835,600 (2023-03-15).
// Wallet balances and the Frax lock equal legacy's record balances exactly.
const STATE = {
  sushiReserves: { reserve0: 953_699_545_842_375n, reserve1: 19_555_934_706_675_190_473_282_844n },
  sushiSupply: 133_154_272_771_679_037_704n,
  sushiTreasuryV3: 132_170_296_734_877_254_208n,
  bptBalances: [
    226_840_363_655_203n,
    2_336_317_882_578_807_099_260_919n,
    833_269_147_638_070_406_870n,
  ],
  bptSupply: 298_681_586_807_706_691_062_017n,
  bptTreasuryV3: 298_662_366_783_754_198_236_698n,
  auraStaked: 1_000_000_000_000_000_000_000n,
  fraxBpBalances: ["275856940035312766768640373", "189427363614594"],
  fraxBpSupply: "464725553098471255441886156",
  fraxFarmLocked: 58_572_239_931_533_782_701_566_271n,
};

function buildMockClient(): PublicClient {
  return {
    chain: { id: 1 },
    readContract: async () => {
      throw new Error("liquidity positions must read through effects and entities");
    },
  } as unknown as PublicClient;
}

function buildMockContext() {
  const effect = vi.fn(async (_effectDef: unknown, input: Record<string, unknown>) => {
    if (input.method !== undefined) {
      const key = `${addr(String(input.contract))}:${input.method}:${addr(String(input.arg))}`;
      if (key === `${AURA_POOL_OHM_DAI_WETH}:erc20.balanceOf:${DAO_WALLET}`) {
        return (50n * 10n ** 18n).toString();
      }
      if (key === `${AURA_POOL_OHM_DAI_WETH}:erc20.balanceOf:${AURA_ALLOCATOR}`) {
        return STATE.auraStaked.toString();
      }
      if (key === `${FRAX_FARM_FRAXBP}:frax.lockedLiquidity:${CONVEX_STAKING_PROXY_FRAXBP}`) {
        return STATE.fraxFarmLocked.toString();
      }
      return "0";
    }
    if (input.lpToken !== undefined) {
      return { balances: STATE.fraxBpBalances, totalSupply: STATE.fraxBpSupply };
    }
    return "";
  });
  const tokenBalances = new Map<string, bigint>([
    [`1-${SUSHI_OHM_DAI}-${TREASURY_V3}`, STATE.sushiTreasuryV3],
    [`1-${BPT_OHM_DAI_WETH}-${TREASURY_V3}`, STATE.bptTreasuryV3],
    [`1-${BPT_OHM_DAI_WETH}-${DAO_WALLET}`, 100n * 10n ** 18n],
  ]);
  const supplies = new Map<string, bigint>([
    [`1-${SUSHI_OHM_DAI}`, STATE.sushiSupply],
    [`1-${BPT_OHM_DAI_WETH}`, STATE.bptSupply],
  ]);
  const context = {
    TokenBalance: {
      get: async (id: string) =>
        tokenBalances.has(id) ? { balance: tokenBalances.get(id) } : undefined,
    },
    Erc20Supply: {
      get: async (id: string) => (supplies.has(id) ? { totalSupply: supplies.get(id) } : undefined),
    },
    Univ2PoolState: {
      get: async (id: string) => (id === `1-${SUSHI_OHM_DAI}` ? STATE.sushiReserves : undefined),
    },
    BalancerPoolState: {
      get: async (id: string) =>
        id === `1-${POOL_ID_OHM_DAI_WETH}`
          ? { tokens: [OHM, DAI, WETH], balances: STATE.bptBalances }
          : undefined,
    },
    Univ3PoolState: { get: async () => undefined },
    KodiakPool: { get: async () => undefined },
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect,
  } as unknown as EvmOnBlockContext;
  return { context, effect };
}

async function snapshot(blockNumber: bigint, config: ChainConfig) {
  const { context, effect } = buildMockContext();
  const records: SerializedTokenRecord[] = [];
  const supplies: SerializedTokenSupply[] = [];
  await pushLiquidityPositionRecords(
    context,
    config,
    buildMockClient(),
    records,
    supplies,
    TIMESTAMP,
    blockNumber,
  );
  const find = (source: string, label: string) =>
    records.find((r) => r.sourceAddress === addr(source) && r.token === label);
  return { records, supplies, find, effect };
}

// Every coin at $1: keeps the expected numbers exact.
function atOneDollar(): ChainConfig {
  return {
    ...ETHEREUM,
    liquidityHandlers: [{ kind: "stable", tokens: [OHM, DAI, WETH, FRAX, USDC], id: "stable" }],
  };
}

describe("pushLiquidityPositionRecords", () => {
  test("SushiSwap OHM-DAI in Treasury Wallet V3 is POL at the LP unit price with OHM excluded", async () => {
    const { find } = await snapshot(14_694_800n, atOneDollar());
    const record = find(TREASURY_V3, "SushiSwap OHM V2-DAI Liquidity Pool");

    const ohm = new BigNumber("953699.545842375");
    const dai = new BigNumber("19555934.706675190473282844");
    const supply = new BigNumber("133.154272771679037704");
    expect(record?.tokenAddress).toBe(SUSHI_OHM_DAI);
    expect(record?.category).toBe("Protocol-Owned Liquidity");
    expect(record?.isLiquid).toBe(true);
    expect(record?.balance).toBe("132.170296734877254208");
    expect(record?.rate).toBe(ohm.plus(dai).div(supply).toString(10));
    expect(record?.multiplier).toBe(dai.div(ohm.plus(dai)).toString(10));
  });

  test("Balancer OHM-DAI-wETH values both the wallet BPT and the Aura-staked position", async () => {
    const { find } = await snapshot(14_694_800n, atOneDollar());
    const wallet = find(TREASURY_V3, "Balancer OHM-DAI-wETH Liquidity Pool");
    const staked = find(
      AURA_ALLOCATOR,
      "Balancer OHM-DAI-wETH Liquidity Pool - Staked in Aura OHM-DAI-wETH Deposit Vault",
    );

    expect(wallet?.tokenAddress).toBe(BPT_OHM_DAI_WETH);
    expect(wallet?.balance).toBe("298662.366783754198236698");
    expect(staked?.tokenAddress).toBe(AURA_DEPOSIT_OHM_DAI_WETH);
    expect(staked?.balance).toBe("1000");
    expect(staked?.rate).toBe(wallet?.rate);
    expect(staked?.multiplier).toBe(wallet?.multiplier);
  });

  test("FraxBP locked in the Frax farm keeps legacy's Stable, fully liquid classification", async () => {
    const { find } = await snapshot(16_835_600n, atOneDollar());
    const record = find(CONVEX_STAKING_PROXY_FRAXBP, "Curve FraxBP - Staked in Frax");

    expect(record?.tokenAddress).toBe(STKCVX_FRAXBP);
    expect(record?.category).toBe("Stable");
    expect(record?.isLiquid).toBe(true);
    expect(record?.multiplier).toBe("1");
    expect(record?.balance).toBe("58572239.931533782701566271");
    // (275.86M FRAX + 189.43M USDC) / 464.73M LP at $1 each; legacy priced it at
    // 1.001385 with live FRAX / USDC rates.
    expect(Number(record?.rate)).toBeCloseTo(1.0012, 5);
  });

  test("a pool the treasury holds nothing in is never priced", async () => {
    const { records, effect } = await snapshot(14_694_800n, atOneDollar());
    expect(records.some((r) => r.token.includes("FraxSwap"))).toBe(false);
    const curveSnapshots = effect.mock.calls.filter(
      ([, input]) => (input as { lpToken?: string }).lpToken !== undefined,
    );
    expect(curveSnapshots).toHaveLength(0);
  });
});

describe("liquidity position OHM supply", () => {
  test("OHM in SushiSwap OHM-DAI held by Treasury Wallet V3 leaves backed supply", async () => {
    const { supplies } = await snapshot(14_694_800n, atOneDollar());
    const row = supplies.find(
      (s) => s.poolAddress === SUSHI_OHM_DAI && s.sourceAddress === TREASURY_V3,
    );
    const ohmPerLp = new BigNumber("953699.545842375").div(new BigNumber("133.154272771679037704"));
    expect(row?.type).toBe("Liquidity");
    expect(row?.tokenAddress).toBe(OHM);
    expect(row?.pool).toBe("SushiSwap OHM V2-DAI Liquidity Pool");
    expect(row?.supplyBalance).toBe(
      new BigNumber("132.170296734877254208").times(ohmPerLp).times(-1).toString(10),
    );
  });

  test("a wallet's staked and unstaked LP in one pool is one supply row", async () => {
    const { supplies } = await snapshot(14_694_800n, atOneDollar());
    const rows = supplies.filter(
      (s) => s.poolAddress === BPT_OHM_DAI_WETH && s.sourceAddress === DAO_WALLET,
    );
    const ohmPerLp = new BigNumber("226840.363655203").div(
      new BigNumber("298681.586807706691062017"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].balance).toBe(new BigNumber(150).times(ohmPerLp).toString(10));
  });

  test("pools without OHM emit no supply rows", async () => {
    const { supplies } = await snapshot(16_835_600n, atOneDollar());
    expect(supplies.some((s) => s.sourceAddress === CONVEX_STAKING_PROXY_FRAXBP)).toBe(false);
  });
});

describe("Ethereum liquidity position config", () => {
  const configYaml = readFileSync(resolve(__dirname, "../../config.yaml"), "utf8").toLowerCase();

  test("SushiSwap OHM pairs are OHM price sources, as in legacy", () => {
    const sushi = ETHEREUM.liquidityHandlers.find((handler) => handler.id === SUSHI_OHM_DAI);
    expect(sushi?.tokens).toContain(OHM);
    expect(configYaml).toContain(SUSHI_OHM_DAI);
  });

  test("Curve OHM-ETH prices its LP token with the pool's WETH coin", () => {
    const handler = ETHEREUM.liquidityHandlers.find(
      (value) => value.id === addr("0x6ec38b3228251a0C5D491Faf66858e2E23d7728B"),
    );
    expect(handler?.kind).toBe("curve");
    if (handler?.kind !== "curve") return;
    expect(handler.lpToken).toBe(addr("0x3660bd168494d61ffdac21e403d0f6356cf90fd7"));
    expect(handler.coins).toEqual([OHM, WETH]);
  });

  test("wallet-held LP tokens are registered so the ledger and LP supply exist", () => {
    for (const position of ETHEREUM.liquidityPositions ?? []) {
      if (!position.sources.some((source) => source.kind === "wallet")) continue;
      expect(configYaml, position.lpToken).toContain(position.lpToken);
    }
  });

  test("Balancer OHM-DAI-wETH POL is valued from deployment", () => {
    const position = ETHEREUM.liquidityPositions?.find(
      (value) => value.lpToken === BPT_OHM_DAI_WETH,
    );
    expect(position?.startBlock).toBe(13_929_694);
    expect(position?.pricing.startBlock).toBe(13_929_694);
  });
});
