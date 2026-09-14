import type { EvmOnBlockContext } from "envio";
import { describe, expect, test, vi } from "vitest";

import { pushTreasuryOhm } from "../../src/handlers/BlockHandlers";
import { pushIncurDebtSupply } from "../../src/handlers/BlvSupply";
import { pushGnosisAuctionSupply } from "../../src/handlers/GnosisAuctions";
import { pushLendingDeploymentSupply } from "../../src/handlers/LendingDeployments";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr } from "../../src/snapshot/math";
import type { SerializedTokenSupply } from "../../src/snapshot/types";

const ETHEREUM = CHAIN_CONFIGS[1];
const TIMESTAMP = 1_700_000_000n;
const SILO = addr("0xb2374f84b3cEeFF6492943Df613C9BcF45322a0c");
const EULER = addr("0x27182842E098f60e3D576794A5bFFb0777E025d3");
const INCUR_DEBT = addr("0xd9d87586774fb9d036fa95a5991474513ff6c96e");
const ASSOCIATION = addr("0x4c71db02aeeb336cbd8f3d2cc866911f6e2fbd94");

function lendingAt(blockNumber: bigint) {
  const supplies: SerializedTokenSupply[] = [];
  pushLendingDeploymentSupply(ETHEREUM, supplies, TIMESTAMP, blockNumber);
  return Object.fromEntries(supplies.map((s) => [s.sourceAddress, s]));
}

describe("lending deployments", () => {
  test("Silo and Euler reproduce legacy's 50,842 OHM on 2023-03-15", () => {
    const rows = lendingAt(16_835_600n);
    expect(rows[SILO]?.supplyBalance).toBe("-48081.19399535");
    expect(rows[SILO]?.source).toBe("Silo Router");
    expect(rows[EULER]?.supplyBalance).toBe("-2760.806004641");
    expect(rows[EULER]?.type).toBe("Lending");
  });

  test("Euler settled to zero and Silo grew to 73,081 OHM by 2023-06-01", () => {
    const rows = lendingAt(17_387_600n);
    expect(rows[SILO]?.supplyBalance).toBe("-73081.19399535");
    expect(rows[EULER]).toBeUndefined();
  });

  test("the Silo schedule ends where legacy switched to collateral balances", () => {
    expect(lendingAt(18_121_728n)[SILO]).toBeUndefined();
  });
});

describe("IncurDebt", () => {
  function contextReturning(raw: string) {
    const effect = vi.fn(async () => raw);
    return {
      context: { effect, log: { info: vi.fn() } } as unknown as EvmOnBlockContext,
      effect,
    };
  }

  test("outstanding debt counts as Boosted Liquidity Vault supply", async () => {
    // totalOutstandingGlobalDebt() at block 17,700,000: 85,939 OHM.
    const { context } = contextReturning("85939000000000");
    const supplies: SerializedTokenSupply[] = [];
    await pushIncurDebtSupply(context, ETHEREUM, supplies, TIMESTAMP, 17_700_000n);

    expect(supplies).toHaveLength(1);
    expect(supplies[0].type).toBe("Boosted Liquidity Vault");
    expect(supplies[0].sourceAddress).toBe(INCUR_DEBT);
    expect(supplies[0].source).toBe("IncurDebt");
    expect(supplies[0].supplyBalance).toBe("-85939");
  });

  test("isn't applied before legacy's 17,620,000 start", async () => {
    const { context, effect } = contextReturning("85939000000000");
    const supplies: SerializedTokenSupply[] = [];
    await pushIncurDebtSupply(context, ETHEREUM, supplies, TIMESTAMP, 17_619_999n);

    expect(supplies).toHaveLength(0);
    expect(effect).not.toHaveBeenCalled();
  });
});

describe("Olympus Association treasury OHM", () => {
  function buildContext() {
    return {
      TokenBalance: { get: async () => undefined },
      OhmIndexState: { get: async () => undefined },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect: vi.fn(async (_def: unknown, input: { walletAddress?: string }) =>
        // OHM.balanceOf(Association) at block 16,091,600.
        input.walletAddress !== undefined && addr(input.walletAddress) === ASSOCIATION
          ? "90470446320900"
          : "0",
      ),
    } as unknown as EvmOnBlockContext;
  }

  test("counts as treasury OHM before 17,115,000", async () => {
    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(buildContext(), ETHEREUM, supplies, TIMESTAMP, 16_091_600n);
    const row = supplies.find((s) => s.sourceAddress === ASSOCIATION);
    expect(row?.type).toBe("Treasury");
    expect(row?.source).toBe("Olympus Association");
    expect(row?.supplyBalance).toBe("-90470.4463209");
  });

  test("is excluded from 17,115,000", async () => {
    const supplies: SerializedTokenSupply[] = [];
    await pushTreasuryOhm(buildContext(), ETHEREUM, supplies, TIMESTAMP, 17_115_000n);
    expect(supplies.some((s) => s.sourceAddress === ASSOCIATION)).toBe(false);
  });
});

describe("Boosted Liquidity Vault registry", () => {
  test("starts at the registry deployment, not the IncurDebt gate", () => {
    expect(ETHEREUM.blvRegistry?.startBlock).toBe(17_067_350);
  });
});

describe("Gnosis auction bonds", () => {
  const BOND_MANAGER = addr("0xf577c77ee3578c7f216327f41b5d7221ead2b2a3");
  const OHM = addr("0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5");
  const TELLER = addr("0x007fe7c498a2cf30971ad8f2cbc36bd14ac51156");

  // 2023-03-15: one auction still vesting (177,431 OHM bid) and one fully
  // vested (93,790 OHM). OHM.balanceOf(BondManager) at block 16,835,600 was
  // 271,220.846341694, which legacy split into -177,431 vesting deposits and
  // -93,790 burnable deposits.
  function buildContext() {
    const effect = vi.fn(
      async (_def: unknown, input: { bondManager?: string; walletAddress?: string }) => {
        if (input.bondManager !== undefined) return { isActive: true, teller: TELLER };
        if (input.walletAddress !== undefined && addr(input.walletAddress) === BOND_MANAGER) {
          return "271220846341694";
        }
        return "0";
      },
    );
    const context = {
      GnosisAuction: {
        getWhere: async () => [
          {
            marketId: 1n,
            bidQuantity: "177431",
            auctionCloseTimestamp: TIMESTAMP - 100n,
            termSeconds: 1_000n,
            payoutCapacity: "200000",
          },
          {
            marketId: 2n,
            bidQuantity: "93790",
            auctionCloseTimestamp: TIMESTAMP - 2_000n,
            termSeconds: 1_000n,
            payoutCapacity: "0",
          },
        ],
      },
      TokenBalance: { get: async () => undefined },
      log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      effect,
    } as unknown as EvmOnBlockContext;
    return { context, effect };
  }

  test("reads BondManager OHM on-chain, so deposit rows subtract from supply", async () => {
    const { context, effect } = buildContext();
    const supplies: SerializedTokenSupply[] = [];
    const block = BigInt(ETHEREUM.bondManager?.startBlock ?? 0) + 1n;
    await pushGnosisAuctionSupply(context, ETHEREUM, supplies, TIMESTAMP, block);

    const balanceRead = effect.mock.calls.find(
      ([, input]) => (input as { walletAddress?: string }).walletAddress !== undefined,
    );
    expect(balanceRead?.[1]).toMatchObject({ tokenAddress: OHM, walletAddress: BOND_MANAGER });

    const byType = Object.fromEntries(
      supplies.map((s) => [`${s.pool}:${s.type}`, s.supplyBalance]),
    );
    expect(byType["1:Bonds (Vesting Deposits)"]).toBe("-177431");
    expect(byType["2:Bonds (Deposits)"]).toBe("-93789.846341694");
    expect(supplies.every((s) => Number(s.supplyBalance) <= 0)).toBe(true);
  });
});
