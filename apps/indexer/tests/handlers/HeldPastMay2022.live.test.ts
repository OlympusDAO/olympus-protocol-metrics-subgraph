import BigNumber from "bignumber.js";
import { createTestIndexer } from "envio";
import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { describe, expect, it } from "vitest";

import "../../src/handlers/BackfillTokenBalances";
import "../../src/handlers/BalancerPools";
import "../../src/handlers/BlockHandlers";
import "../../src/handlers/BondManager";
import "../../src/handlers/BophadesKernel";
import "../../src/handlers/Erc20Transfers";
import "../../src/handlers/GnosisEasyAuction";
import "../../src/handlers/SOhmV3";
import "../../src/handlers/Univ2Pools";
import "../../src/handlers/Univ3Pools";
import { addr } from "../../src/snapshot/math";

// Needs HyperSync (ENVIO_API_TOKEN) and an Ethereum archive RPC; skipped
// without them, never passed.
const RPC_URL = process.env.ENVIO_ETHEREUM_RPC_URL;
const canRun = Boolean(process.env.ENVIO_API_TOKEN && RPC_URL);

const TREASURY_V2 = addr("0x31f8cc382c9898b273eff4e0b7626a6987c846e8");
const TREASURY_V3 = addr("0x9A315BdF513367C0377FB36545857d12e85813Ef");
const SPELL = addr("0x090185f2135308BaD17527004364eBcC2D37e5F6");
const PRIME = addr("0x43D4A3cd90ddD2F8f4f693170C9c8098163502ad");
const AGEUR = addr("0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8");
const SUSHI_SPELL_WETH = addr("0xb5De0C3753b6E1B4dBA616Db82767F17513E6d4E");
const VAULT = "0xba12222222228d8ba445958a75a0704d566bf2c8";
const D2D_USDC = "0x27c9f71cc31464b906e0006d4fcbc8900f48f15f00020000000000000000010f";
const FEED = {
  eth: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
  usdc: "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6",
  eur: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1",
};
const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function getPoolTokens(bytes32) view returns (address[], uint256[], uint256)",
  "function latestAnswer() view returns (int256)",
]);
// 2022-05-01, the first published date: SPELL and agEUR in Treasury V3,
// PRIME in Treasury V2.
const BLOCK = 14_690_400;

type Row = Record<string, unknown>;

describe.skipIf(!canRun)("SPELL, PRIME and agEUR — live, against the price sources", () => {
  let rpc: ReturnType<typeof createPublicClient> | undefined;
  const client = () => {
    rpc ??= createPublicClient({ transport: http(RPC_URL) });
    return rpc;
  };
  const read = (address: string, functionName: string, block: number, args: unknown[] = []) =>
    client().readContract({
      address: getAddress(address),
      abi: ABI,
      functionName: functionName as never,
      args: args as never,
      blockNumber: BigInt(block),
    }) as Promise<never>;
  const decimal = (raw: bigint, decimals: number) =>
    new BigNumber(raw.toString()).div(new BigNumber(10).pow(decimals));

  it(`values them at ${BLOCK} from the pools and Chainlink`, async () => {
    const holdings: [string, string][] = [
      [SPELL, TREASURY_V3],
      [PRIME, TREASURY_V2],
      [AGEUR, TREASURY_V3],
    ];
    const indexer = createTestIndexer();
    for (const [token, wallet] of holdings) {
      indexer.TokenBalance.set({
        id: `1-${token}-${wallet}`,
        chainId: 1,
        tokenAddress: token,
        walletAddress: wallet,
        balance: await read(token, "balanceOf", BLOCK - 1, [wallet]),
        updatedAtBlock: BigInt(BLOCK - 1),
      });
    }
    const [spellReserve, wethReserve] = (await read(
      SUSHI_SPELL_WETH,
      "getReserves",
      BLOCK - 1,
    )) as bigint[];
    indexer.Univ2PoolState.set({
      id: `1-${SUSHI_SPELL_WETH}`,
      chainId: 1,
      poolAddress: SUSHI_SPELL_WETH,
      reserve0: spellReserve,
      reserve1: wethReserve,
      updatedAtBlock: BigInt(BLOCK - 1),
    });
    const [poolTokens, poolBalances] = (await read(VAULT, "getPoolTokens", BLOCK - 1, [
      D2D_USDC,
    ])) as [string[], bigint[]];
    indexer.BalancerPoolState.set({
      id: `1-${D2D_USDC}`,
      chainId: 1,
      poolId: D2D_USDC,
      tokens: poolTokens.map(addr),
      balances: poolBalances,
      updatedAtBlock: BigInt(BLOCK - 1),
    });

    const result = await indexer.process({ chains: { 1: { startBlock: BLOCK, endBlock: BLOCK } } });
    const records = result.changes
      .filter((change) => change.block === BLOCK)
      .flatMap((change) => (change.TokenRecord?.sets ?? []) as unknown as Row[]);

    // Independent marks from the same block's state.
    const [s, w] = (await read(SUSHI_SPELL_WETH, "getReserves", BLOCK)) as bigint[];
    const ethUsd = decimal(await read(FEED.eth, "latestAnswer", BLOCK), 8);
    const [, balances] = (await read(VAULT, "getPoolTokens", BLOCK, [D2D_USDC])) as [
      string[],
      bigint[],
    ];
    const usdcUsd = decimal(await read(FEED.usdc, "latestAnswer", BLOCK), 8);
    const expectedPrice: Record<string, BigNumber> = {
      [SPELL]: decimal(w, 18).div(decimal(s, 18)).times(ethUsd),
      // 80/20 weighted pool spot price.
      [PRIME]: decimal(balances[1], 6)
        .div(0.2)
        .div(decimal(balances[0], 18).div(0.8))
        .times(usdcUsd),
      [AGEUR]: decimal(await read(FEED.eur, "latestAnswer", BLOCK), 8),
    };

    for (const [token, wallet] of holdings) {
      const row = records.find((r) => r.tokenAddress === token && r.sourceAddress === wallet);
      expect(row, token).toBeDefined();
      const balance = decimal(await read(token, "balanceOf", BLOCK, [wallet]), 18);
      const rate = new BigNumber(String(row?.rate));
      process.stderr.write(
        `${String(row?.token)}: ${balance.toFixed(2)} × ${rate.toPrecision(6)} = $${new BigNumber(String(row?.value)).toFixed(0)} (liquid ${String(row?.isLiquid)})\n`,
      );
      expect(new BigNumber(String(row?.balance)).toFixed(18)).toBe(balance.toFixed(18));
      expect(
        rate.minus(expectedPrice[token]).abs().div(expectedPrice[token]).toNumber(),
      ).toBeLessThan(1e-9);
    }
  }, 900_000);
});
