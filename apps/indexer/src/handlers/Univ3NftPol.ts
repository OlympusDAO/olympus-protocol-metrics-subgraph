import BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { snapshotUniv3NftPositions } from "../effects";
import { getPrice } from "../pricing";
import { TYPE_LIQUIDITY } from "../snapshot/global";
import { addr, getTokenDecimals, toDecimal, univ3PositionAmounts, ZERO } from "../snapshot/math";
import { createTokenRecord, createTokenSupply, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenRecord, SerializedTokenSupply } from "../snapshot/types";

// UniV3 NFT POL. For each treasury wallet, walk its NonfungiblePositionManager
// NFT holdings, match each position to a known UniV3 pricing pool, compute
// token amounts from `liquidity` + indexed sqrtPriceX96, then emit:
//
//   - ONE TokenRecord per (wallet, pool), aggregating all NFTs in that pool,
//     with category "Protocol-Owned Liquidity" and
//     `multiplier = nonOhmValue / totalValue` — same shape as
//     `pushOwnedLiquidityRecords` produces for Univ2 / Balancer / Kodiak,
//     and what the legacy treasury subgraph emits via
//     `LiquidityUniswapV3.getLiquidityBalances`. Earlier the handler emitted
//     two rows per pool (one per token side, categorized as
//     Volatile/Stable) — functionally produced the same aggregate
//     liquidBacking but doubled per-position rows and broke any consumer
//     filtering by `category = "Protocol-Owned Liquidity"`.
//
//   - ONE Liquidity-type TokenSupply per (wallet, pool) for the OHM side,
//     so OHM held inside UniV3 POL NFTs is deducted from floating supply
//     (mirrors `pushOwnedLiquiditySupply`'s behaviour for non-NFT POL —
//     needed because `getLpTokenForHandler` returns null for univ3
//     handlers). Without this the floating supply overstated by ~700K OHM
//     on Ethereum vs legacy (fix `a4b714a`).
export async function pushUniv3NftPol(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const manager = config.univ3PositionManager;
  if (!manager) return;
  if (blockNumber < BigInt(manager.startBlock)) return;

  // Build a token-pair → pool lookup from this chain's univ3 handlers so we
  // can match each NFT position to a pool we know about (and have indexed
  // sqrtPriceX96 for).
  const univ3Pools = new Map<string, { id: string; tokens: string[] }>();
  for (const handler of config.liquidityHandlers) {
    if (handler.kind !== "univ3") continue;
    const sorted = [handler.tokens[0]?.toLowerCase(), handler.tokens[1]?.toLowerCase()]
      .filter(Boolean)
      .sort()
      .join("/");
    univ3Pools.set(sorted, { id: handler.id, tokens: handler.tokens });
  }
  if (univ3Pools.size === 0) return;

  const ohmTokenLower = config.ohmToken.toLowerCase();

  for (const wallet of config.protocolAddresses) {
    const result = (await context.effect(snapshotUniv3NftPositions, {
      chainId: config.chainId,
      positionManager: manager.address,
      wallet,
      atBlock: Number(blockNumber),
    })) as {
      positions: Array<{
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
      }>;
    };
    if (result.positions.length === 0) continue;

    // Aggregate per pool. Legacy: "Records are aggregated per wallet (not
    // per position ID)" (inventory-ethereum.md §UniswapV3 Pools). Multiple
    // NFTs in the same pool from the same wallet sum into one row.
    type PoolAgg = {
      poolId: string;
      token0: string;
      token1: string;
      amount0: BigNumber;
      amount1: BigNumber;
    };
    const aggregates = new Map<string, PoolAgg>();
    for (const position of result.positions) {
      const pairKey = [position.token0, position.token1].sort().join("/");
      const pool = univ3Pools.get(pairKey);
      if (!pool) continue;

      const state = await context.Univ3PoolState.get(`${config.chainId}-${addr(pool.id)}`);
      if (!state || state.sqrtPriceX96 === 0n) continue;

      const amounts = univ3PositionAmounts(
        BigInt(position.liquidity),
        state.sqrtPriceX96,
        position.tickLower,
        position.tickUpper,
      );

      const decimals0 = getTokenDecimals(config.tokens, position.token0);
      const decimals1 = getTokenDecimals(config.tokens, position.token1);
      const balance0 = toDecimal(amounts.amount0, decimals0);
      const balance1 = toDecimal(amounts.amount1, decimals1);

      const key = addr(pool.id);
      const existing = aggregates.get(key);
      if (existing) {
        // Sum in token0/token1 order; pair-key sort guarantees consistent
        // ordering across NFTs in the same pool.
        existing.amount0 = existing.amount0.plus(balance0);
        existing.amount1 = existing.amount1.plus(balance1);
      } else {
        aggregates.set(key, {
          poolId: pool.id,
          token0: position.token0,
          token1: position.token1,
          amount0: balance0,
          amount1: balance1,
        });
      }
    }

    for (const agg of aggregates.values()) {
      // Price each side via the chain's pricing router. Both prices are in
      // USD per 1 token, so `amount * price` is USD value of that side.
      const rate0 = (await getPrice(config, context, client, agg.token0, blockNumber, null)).price;
      const rate1 = (await getPrice(config, context, client, agg.token1, blockNumber, null)).price;
      const value0 = agg.amount0.times(rate0);
      const value1 = agg.amount1.times(rate1);
      const totalValue = value0.plus(value1);
      if (totalValue.lte(ZERO)) continue;

      // multiplier = (value of all non-OHM sides) / totalValue. Matches
      // legacy `includedValue / totalValue`. Two OHM sides aren't a valid
      // POL shape, so at most one of value0/value1 is OHM.
      let ohmValue = new BigNumber("0");
      const token0IsOhm = agg.token0.toLowerCase() === ohmTokenLower;
      const token1IsOhm = agg.token1.toLowerCase() === ohmTokenLower;
      if (token0IsOhm) ohmValue = ohmValue.plus(value0);
      if (token1IsOhm) ohmValue = ohmValue.plus(value1);
      const nonOhmValue = totalValue.minus(ohmValue);
      const multiplier = nonOhmValue.div(totalValue);

      // Emit ONE TokenRecord per (wallet, pool). balance=1 + rate=totalValue
      // mirrors how legacy fills these fields for an aggregated POL row
      // (and how `pushOwnedLiquidityRecords` does for Univ2 / Balancer /
      // Kodiak): the pair's value-per-position-unit collapses into `rate`,
      // `balance` is a dimensionless 1.
      records.push(
        createTokenRecord(
          config,
          timestamp,
          getContractName(config, agg.poolId),
          agg.poolId,
          getContractName(config, wallet),
          wallet,
          totalValue,
          new BigNumber("1"),
          blockNumber,
          multiplier,
          "Protocol-Owned Liquidity",
        ),
      );

      // OHM-side liquidity-supply emission (unchanged behaviour): one
      // Liquidity-type TokenSupply per (wallet, pool) carrying the
      // aggregated OHM amount, so cross-chain floating supply correctly
      // deducts OHM locked in UniV3 NFT POL.
      if (token0IsOhm && !agg.amount0.eq(ZERO)) {
        supplies.push(
          createTokenSupply(
            config,
            timestamp,
            getContractName(config, config.ohmToken),
            config.ohmToken,
            getContractName(config, agg.poolId),
            agg.poolId,
            getContractName(config, wallet),
            wallet,
            TYPE_LIQUIDITY,
            agg.amount0,
            blockNumber,
            -1,
          ),
        );
      }
      if (token1IsOhm && !agg.amount1.eq(ZERO)) {
        supplies.push(
          createTokenSupply(
            config,
            timestamp,
            getContractName(config, config.ohmToken),
            config.ohmToken,
            getContractName(config, agg.poolId),
            agg.poolId,
            getContractName(config, wallet),
            wallet,
            TYPE_LIQUIDITY,
            agg.amount1,
            blockNumber,
            -1,
          ),
        );
      }
    }
  }
}
