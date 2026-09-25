import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";
import { describe, expect, test, vi } from "vitest";
import { parse } from "yaml";
import { pushTokenBalanceRecords } from "../../src/handlers/BlockHandlers";
import {
  buildTreasuryTransferWhere,
  handleTreasuryTransfer,
} from "../../src/handlers/Erc20Transfers";
import { withPricingCache } from "../../src/pricing";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { computePerChainAggregate } from "../../src/snapshot/global";
import { isActive } from "../../src/snapshot/math";
import type { SerializedTokenRecord } from "../../src/snapshot/types";

const ENA = "0x57e114b691db790c35207b2e685d4a43181e6061";
const SENA = "0x8be3460a480c80728a8c4d7a5d5303c85ba7b3b9";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL = "0xc3db44adc1fcdfd5671f555236eae49f4a8eea18";
const TRSRY = "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613";
const MS = "0x245cc372c84b3645bf0ffe6538620b04a217988b";
const BLOCK = 26_056_046n;
const TIMESTAMP = 1_790_358_395n;
// Ethereum block 26056046: public RPC reads, retained in the PR evidence.
// TWAP fixture is from block 26056846; holding/conversion anchor is 26056046.
// Mixing these inputs is intentional for a controlled unit test, not a historical valuation.
const RATIO = "1018269352422694832";
const SQRT_PRICE = 780550399454001161472712967n;
const ETHEREUM = CHAIN_CONFIGS[1];
const config = {
  ...ETHEREUM,
  tokens: ETHEREUM.tokens.filter((token) => [ENA, SENA, WETH].includes(token.address)),
  protocolAddresses: [TRSRY, MS],
  liquidityHandlers: ETHEREUM.liquidityHandlers.filter(
    (handler) =>
      handler.id === POOL ||
      handler.id === SENA ||
      (handler.kind === "chainlink" && handler.tokens.includes(WETH)),
  ),
};

/** Run production token snapshots with controlled balances and price inputs. */
async function snapshot(
  args: {
    block?: bigint;
    balances?: Array<[string, string, bigint]>;
    ratio?: string;
    poolPresent?: boolean;
    tickDelta?: string;
    sqrtPrice?: bigint;
    liquidityDelta?: string;
    ethPrice?: string;
  } = {},
) {
  const balances = new Map(
    (args.balances ?? []).map(([token, wallet, balance]) => [`1-${token}-${wallet}`, { balance }]),
  );
  const effect = vi.fn(async (def: { name: string }) => {
    if (def.name === "readErc4626AssetsPerShare") return args.ratio ?? RATIO;
    if (def.name === "readUniv3Twap") {
      if (args.poolPresent === false) throw new Error("OLD: insufficient observation history");
      return {
        tickDelta: args.tickDelta ?? "-332729748",
        liquidityDelta: args.liquidityDelta ?? "20249843485504294934",
        sqrtPriceX96: (args.sqrtPrice ?? SQRT_PRICE).toString(),
      };
    }
    // Controlled ETH price: isolates the recorded ENA/WETH and sENA/ENA rates.
    if (def.name === "readChainlinkLatestAnswer") return args.ethPrice ?? "240000000000";
    if (def.name === "readErc20BalanceOf") return "351067464160132271493";
    throw new Error(`Unexpected effect ${def.name}`);
  });
  const context = {
    TokenBalance: { get: async (id: string) => balances.get(id) },
    Univ3PoolState: {
      get: async () => (args.poolPresent === false ? undefined : { sqrtPriceX96: SQRT_PRICE }),
    },
    effect,
    log: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
  } as unknown as EvmOnBlockContext;
  const client = { chain: { id: 1 } } as PublicClient;
  const records: SerializedTokenRecord[] = [];
  await withPricingCache(() =>
    pushTokenBalanceRecords(context, config, client, records, TIMESTAMP, args.block ?? BLOCK),
  );
  return { records, effect };
}

describe("Ethereum ENA/sENA treasury coverage", () => {
  test("registers both assets and the price pool exactly once without duplicate vault events", () => {
    const yaml = parse(readFileSync(resolve(__dirname, "../../config.yaml"), "utf8"));
    const contracts = yaml.chains.find((chain: { id: number }) => chain.id === 1)
      .contracts as Array<{ name: string; address: string[] }>;
    for (const [address, startBlock] of [
      [ENA, 19_371_662],
      [SENA, 20_713_442],
    ] as const) {
      const definition = ETHEREUM.tokens.find((token) => token.address === address);
      expect(definition).toMatchObject({
        category: "Volatile",
        isLiquid: false,
        isBluechip: false,
        decimals: 18,
        startBlock,
      });
      if (!definition) throw new Error("Missing Ethena definition");
      expect(isActive(definition, BigInt(startBlock - 1))).toBe(false);
      expect(isActive(definition, BigInt(startBlock))).toBe(true);
      expect(
        contracts
          .filter((contract) => contract.address.some((a) => a.toLowerCase() === address))
          .map((contract) => contract.name),
      ).toEqual(["TreasuryERC20"]);
    }
    expect(
      contracts
        .filter((contract) => contract.address.some((a) => a.toLowerCase() === POOL))
        .map((contract) => contract.name),
    ).toEqual(["UniswapV3Pool"]);
    expect(ETHEREUM.protocolAddresses).toEqual(expect.arrayContaining([TRSRY, MS]));
  });

  test("values anchored sENA balances through non-unit conversion and excludes all value from liquid backing", async () => {
    const { records } = await snapshot({
      balances: [
        [SENA, TRSRY, 26440160000000000000000n],
        [SENA, MS, 15094030000000000000000n],
        [ENA, MS, 10n ** 18n],
      ],
    });
    expect(records).toHaveLength(3);
    const enaPrice = new BigNumber(
      "0.23251189604702704665875370820623958119844532174113462484271823767",
    );
    const senaPrice = enaPrice.times(new BigNumber(RATIO).div(1e18));
    const sena = records.filter((record) => record.tokenAddress === SENA);
    expect(sena).toHaveLength(2);
    for (const record of sena) {
      expect(record.token).toBe("Staked ENA (sENA)");
      expect(Number(record.rate)).toBeCloseTo(senaPrice.toNumber(), 12);
      expect(Number(record.value)).toBeCloseTo(
        new BigNumber(record.balance).times(senaPrice).toNumber(),
        8,
      );
      expect(record.isLiquid).toBe(false);
    }
    const aggregate = computePerChainAggregate(
      1,
      "Ethereum",
      "2026-09-25",
      BLOCK,
      TIMESTAMP,
      records,
      [],
    );
    expect(aggregate.treasuryMarketValue.toNumber()).toBeCloseTo(
      senaPrice.times("41534.19").plus(enaPrice).toNumber(),
      8,
    );
    expect(aggregate.treasuryLiquidBacking.isZero()).toBe(true);
    expect(new Set(records.map((r) => `${r.tokenAddress}-${r.sourceAddress}`)).size).toBe(3);
  });

  test("WETH pricing never invokes the auxiliary ENA TWAP", async () => {
    const { records, effect } = await snapshot({
      poolPresent: false,
      balances: [[WETH, MS, 10n ** 18n]],
    });
    expect(Number(records[0].rate)).toBe(2400);
    expect(effect.mock.calls.some(([def]) => def.name === "readUniv3Twap")).toBe(false);
  });

  test("zero holdings create no phantom treasury records", async () => {
    const { records, effect } = await snapshot({ poolPresent: false });
    expect(records).toEqual([]);
    expect(effect).not.toHaveBeenCalled();
  });

  test("pre-deployment state avoids sENA conversion and treasury records", async () => {
    const { records, effect } = await snapshot({ block: 19_371_661n });
    expect(records).toEqual([]);
    expect(effect.mock.calls.some(([def]) => def.name === "readErc4626AssetsPerShare")).toBe(false);
  });

  test("unavailable TWAP history fails instead of using spot or omitting held sENA", async () => {
    await expect(
      snapshot({ poolPresent: false, balances: [[SENA, TRSRY, 10n ** 18n]] }),
    ).rejects.toThrow("OLD");
  });

  test("spot manipulation beyond 10% fails instead of publishing distorted value", async () => {
    await expect(
      snapshot({ sqrtPrice: SQRT_PRICE * 2n, balances: [[ENA, MS, 10n ** 18n]] }),
    ).rejects.toThrow("deviation");
  });

  test("modest spot changes do not alter the TWAP valuation", async () => {
    const balances: Array<[string, string, bigint]> = [[ENA, MS, 10n ** 18n]];
    const baseline = await snapshot({ balances });
    const moved = await snapshot({ balances, sqrtPrice: (SQRT_PRICE * 101n) / 100n });
    expect(moved.records[0].rate).toBe(baseline.records[0].rate);
    expect(moved.effect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "readUniv3Twap" }),
      expect.objectContaining({ atBlock: Number(BLOCK), seconds: 3600 }),
    );
  });

  test.each(["0", "-1"])("invalid liquidity delta %s fails closed", async (liquidityDelta) => {
    await expect(snapshot({ liquidityDelta, balances: [[ENA, MS, 10n ** 18n]] })).rejects.toThrow(
      "observation",
    );
  });

  test.each([
    "0",
    "-1",
  ])("invalid secondary price %s fails rather than omitting held assets", async (ethPrice) => {
    await expect(snapshot({ ethPrice, balances: [[ENA, MS, 10n ** 18n]] })).rejects.toThrow(
      "secondary price",
    );
  });

  test("out-of-range tick fails closed", async () => {
    await expect(
      snapshot({ tickDelta: "4000000000", balances: [[ENA, MS, 10n ** 18n]] }),
    ).rejects.toThrow("observation");
  });

  test("missing conversion never values sENA at one ENA", async () => {
    expect((await snapshot({ ratio: "", balances: [[SENA, TRSRY, 10n ** 18n]] })).records).toEqual(
      [],
    );
  });
});

describe("Ethena production transfer filtering", () => {
  test("both treasury wallets are selected by the live handler filter", () => {
    const where = buildTreasuryTransferWhere({ chain: { id: 1 } });
    if (!where) throw new Error("Ethereum production filter is missing");
    expect(where.params).toEqual([
      { from: expect.arrayContaining([TRSRY, MS]) },
      { to: expect.arrayContaining([TRSRY, MS]) },
    ]);
  });
  test.each([
    ENA,
    SENA,
  ])("%s incoming transfer persists balance and immutable history once", async (token) => {
    const context = {
      TokenBalance: { get: vi.fn(async () => undefined), set: vi.fn() },
      TokenBalanceUpdate: { set: vi.fn() },
    };
    await handleTreasuryTransfer({
      context,
      event: {
        chainId: 1,
        srcAddress: token,
        logIndex: 7,
        block: { number: Number(BLOCK), timestamp: Number(TIMESTAMP) },
        params: {
          from: "0x0000000000000000000000000000000000000000",
          to: TRSRY,
          value: 5n * 10n ** 18n,
        },
      },
    });
    expect(context.TokenBalance.set).toHaveBeenCalledTimes(1);
    expect(context.TokenBalanceUpdate.set).toHaveBeenCalledTimes(1);
    expect(context.TokenBalanceUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `1-${token}-${TRSRY}-${BLOCK}-7`,
        block: BLOCK,
        timestamp: TIMESTAMP,
        tokenAddress: token,
        walletAddress: TRSRY,
        delta: 5n * 10n ** 18n,
        balance: 5n * 10n ** 18n,
      }),
    );
  });
});

describe("sENA transfer ledger", () => {
  test("mint, treasury transfer and burn track shares exactly once", async () => {
    type Context = Parameters<typeof handleTreasuryTransfer>[0]["context"];
    type Balance = Parameters<Context["TokenBalance"]["set"]>[0];
    const store = new Map<string, Balance>();
    const updates: unknown[] = [];
    const context: Context = {
      TokenBalance: {
        get: async (id) => store.get(id),
        set: (row) => {
          store.set(row.id, row);
        },
      },
      TokenBalanceUpdate: {
        set: (row) => {
          updates.push(row);
        },
      },
    };
    const zero = "0x0000000000000000000000000000000000000000";
    const transfer = async (from: string, to: string, value: bigint, logIndex: number) =>
      handleTreasuryTransfer({
        context,
        event: {
          chainId: 1,
          srcAddress: SENA,
          logIndex,
          block: { number: Number(BLOCK), timestamp: Number(TIMESTAMP) },
          params: { from, to, value },
        },
      });
    await transfer(zero, TRSRY, 100n * 10n ** 18n, 1);
    await transfer(TRSRY, MS, 40n * 10n ** 18n, 2);
    await transfer(MS, zero, 10n * 10n ** 18n, 3);
    expect(store.get(`1-${SENA}-${TRSRY}`)?.balance).toBe(60n * 10n ** 18n);
    expect(store.get(`1-${SENA}-${MS}`)?.balance).toBe(30n * 10n ** 18n);
    expect(updates).toHaveLength(4); // one write per affected treasury wallet
  });
});
