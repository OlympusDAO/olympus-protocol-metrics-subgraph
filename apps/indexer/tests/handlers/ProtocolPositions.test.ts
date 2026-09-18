import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";

import { pushProtocolPositionRecords } from "../../src/handlers/ProtocolPositions";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { ChainConfig, SerializedTokenRecord } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const TIMESTAMP = 1_700_000_000n;

const STABILITY_POOL = addr("0x66017d22b0f8556afdd19fc67041899eb65a21bb");
const TOKEMAK_STAKING = addr("0x96f98ed74639689c3a11daf38ef86e59f43417d3");
const CONVEX_FRAX_3CRV_POOL = addr("0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e");
const CONVEX_CRV_POOL = addr("0x3fe65692bfcd0e6cf84cb1e7d24108e434a7587e");
const VLCVX = addr("0x72a19342e8F1838460eBFCCEf09F6585e32db86E");
const RARI_ALLOCATOR = addr("0x061C8610A784b8A1599De5B1157631e35180d818");
const LUSD_ALLOCATOR = addr("0x97b3ef4c558ec456d59cb95c65bfb79046e31fca");
const DAO_WALLET = addr("0x245cc372c84b3645bf0ffe6538620b04a217988b");
const CONVEX_ALLOCATOR3 = addr("0xDbf0683fC4FC8Ac11e64a6817d3285ec4f2Fc42d");
const VLCVX_ALLOCATOR = addr("0x2d643df5de4e9ba063760d475beaa62821c71681");
const MYSO = addr("0xb339953fc028b9998775c00594a74dd1488ee2c6");

// On-chain reads at the blocks named in each key (drpc archive), keyed by
// `${contract}:${method}:${arg}`. Anything unlisted reads zero.
const READS: Record<string, bigint> = {
  // Block 15,004,400 (2022-06-21)
  [`${STABILITY_POOL}:stabilityPool.compoundedLusd:${LUSD_ALLOCATOR}`]:
    2_988_135_909_290_264_594_900_161n,
  [`${STABILITY_POOL}:stabilityPool.ethGain:${LUSD_ALLOCATOR}`]: 15_544_016_155_022_287_220_385n,
  [`${STABILITY_POOL}:stabilityPool.lqtyGain:${LUSD_ALLOCATOR}`]: 43_506_418_696_565_575_702_048n,
  // Block 14,694,800 (2022-05-01)
  [`${TOKEMAK_STAKING}:erc20.balanceOf:${DAO_WALLET}`]: 134_411_021_669_741_981_706_593n,
  [`${RARI_ALLOCATOR}:rari.hasId:3`]: 1n,
  [`${RARI_ALLOCATOR}:rari.hasId:4`]: 1n,
  [`${RARI_ALLOCATOR}:rari.amountAllocated:3`]: 10_012_055_823_224_234_682_494_100n,
  [`${RARI_ALLOCATOR}:rari.amountAllocated:4`]: 3_753_515_988_556_546_559_122_583n,
  // Block 15,000,000
  [`${CONVEX_FRAX_3CRV_POOL}:erc20.balanceOf:${CONVEX_ALLOCATOR3}`]:
    24_821_099_751_239_054_661_041_957n,
  // Block 17,358,800 (2023-05-28)
  [`${CONVEX_CRV_POOL}:erc20.balanceOf:${VLCVX_ALLOCATOR}`]: 180_802_664_699_649_017_940_303n,
  [`${VLCVX}:vlCvx.unlockable:${VLCVX_ALLOCATOR}`]: 913_995_434_346_682_696_601_826n,
};

function buildMockClient(): PublicClient {
  return {
    chain: { id: 1 },
    readContract: async () => {
      throw new Error("positions must be read through effects, not the client");
    },
  } as unknown as PublicClient;
}

function buildMockContext() {
  const effect = vi.fn(
    async (_effectDef: unknown, input: { contract: string; method: string; arg: string }) => {
      const arg = /^0x[0-9a-f]{40}$/i.test(input.arg) ? addr(input.arg) : input.arg;
      return (READS[`${addr(input.contract)}:${input.method}:${arg}`] ?? 0n).toString();
    },
  );
  const context = {
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    effect,
  } as unknown as EvmOnBlockContext;
  return { context, effect };
}

// Price every token at $1 so value === balance and the test is about reads.
function atOneDollar(): ChainConfig {
  return {
    ...ETHEREUM,
    liquidityHandlers: [
      { kind: "stable", tokens: ETHEREUM.tokens.map((token) => token.address), id: "stable" },
    ],
  };
}

async function snapshot(blockNumber: bigint) {
  const { context, effect } = buildMockContext();
  const records: SerializedTokenRecord[] = [];
  await pushProtocolPositionRecords(
    context,
    atOneDollar(),
    buildMockClient(),
    records,
    TIMESTAMP,
    blockNumber,
  );
  const byLabel = (source: string, label: string) =>
    records.find((r) => r.sourceAddress === addr(source) && r.token === label);
  return { records, byLabel, effect };
}

describe("pushProtocolPositionRecords", () => {
  test("stability pool counts the compounded LUSD deposit plus ETH and LQTY gains", async () => {
    const { byLabel } = await snapshot(15_004_400n);

    expect(byLabel(LUSD_ALLOCATOR, "LUSD - Stability Pool")?.balance).toBe(
      "2988135.909290264594900161",
    );
    expect(byLabel(LUSD_ALLOCATOR, "wETH - Stability Pool")?.balance).toBe(
      "15544.016155022287220385",
    );
    expect(byLabel(LUSD_ALLOCATOR, "LQTY - Stability Pool")?.balance).toBe(
      "43506.418696565575702048",
    );
    expect(byLabel(LUSD_ALLOCATOR, "LUSD - Stability Pool")?.category).toBe("Stable");
  });

  test("Convex FRAX3CRV staked in a reward pool is a liquid stable position", async () => {
    const { byLabel } = await snapshot(15_000_000n);
    const record = byLabel(
      CONVEX_ALLOCATOR3,
      "Curve FRAX3Pool - Convex FRAX3CRV Reward Pool (cvxFRAX3CRV)",
    );
    expect(record?.balance).toBe("24821099.751239054661041957");
    expect(record?.source).toBe("Convex Allocator 3");
    expect(record?.isLiquid).toBe(true);
  });

  test("Rari allocations only read ids the allocator lists, and stop after legacy's cutoff", async () => {
    const { byLabel, records } = await snapshot(14_694_800n);
    expect(byLabel(RARI_ALLOCATOR, "DAI")?.balance).toBe("10012055.8232242346824941");
    expect(byLabel(RARI_ALLOCATOR, "TRIBE")?.balance).toBe("3753515.988556546559122583");
    expect(byLabel(DAO_WALLET, "TOKE - Staked")?.balance).toBe("134411.021669741981706593");

    const after = await snapshot(14_983_059n);
    expect(after.records.filter((r) => r.sourceAddress === RARI_ALLOCATOR)).toHaveLength(0);
    expect(records.length).toBeGreaterThan(0);
  });

  test("cvxCRV stays in market value but leaves liquid backing after the write-off", async () => {
    const before = await snapshot(17_358_800n);
    const beforeRecord = before.byLabel(VLCVX_ALLOCATOR, "Curve - Convex CRV Reward Pool (cvxCRV)");
    expect(beforeRecord?.valueExcludingOhm).toBe(beforeRecord?.value);

    const after = await snapshot(18_121_728n);
    const afterRecord = after.byLabel(VLCVX_ALLOCATOR, "Curve - Convex CRV Reward Pool (cvxCRV)");
    expect(afterRecord?.value).toBe("180802.664699649017940303");
    expect(afterRecord?.valueExcludingOhm).toBe("0");
  });

  test("vlCVX unlockable balance is valued under legacy's Unlocked label", async () => {
    const { byLabel } = await snapshot(17_358_800n);
    expect(byLabel(VLCVX_ALLOCATOR, "Convex - Unlocked (vlCVX)")?.balance).toBe(
      "913995.434346682696601826",
    );
  });

  test("fixed lending principal nets deployments, repayments and write-offs", async () => {
    const deployed = await snapshot(16_900_000n);
    expect(deployed.byLabel(MYSO, "DAI")?.balance).toBe("500000");
    expect(deployed.byLabel(MYSO, "DAI")?.source).toBe("Myso Finance");

    const partlyRepaid = await snapshot(17_000_000n);
    expect(partlyRepaid.byLabel(MYSO, "DAI")?.balance).toBe("28813.5151768475");

    const writtenOff = await snapshot(18_185_779n);
    expect(writtenOff.byLabel(MYSO, "DAI")).toBeUndefined();
  });

  test("only reads the wallets configured for a position", async () => {
    const { effect } = await snapshot(15_004_400n);
    const stabilityReads = effect.mock.calls
      .map(([, input]) => input as { contract: string; method: string; arg: string })
      .filter((input) => input.method === "stabilityPool.compoundedLusd");
    expect(stabilityReads.map((input) => addr(input.arg)).sort()).toEqual(
      [LUSD_ALLOCATOR, DAO_WALLET].sort(),
    );
  });
});
