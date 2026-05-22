import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { snapshotUniv3NftPositions } from "../effects";
import { getPrice } from "../pricing";
import { TYPE_LIQUIDITY } from "../snapshot/global";
import { addr, getTokenDecimals, toDecimal, univ3PositionAmounts, ZERO } from "../snapshot/math";
import { createTokenRecord, createTokenSupply, getContractName } from "../snapshot/records";
import type {
  ChainConfig,
  SerializedTokenRecord,
  SerializedTokenSupply,
} from "../snapshot/types";

// UniV3 NFT POL (Ethereum). For each treasury wallet, walk its
// NonfungiblePositionManager NFT holdings, match each position's token-pair
// to one of the chain's known UniV3 pricing pools, compute token amounts
// from the position's liquidity + the pool's current sqrtPriceX96, and emit:
//   - one TokenRecord per token in the position (priced via the chain's
//     pricing pipeline)
//   - one Liquidity-type TokenSupply per position whose token0 OR token1 is
//     OHM, so OHM held inside UniV3 POL NFTs gets deducted from floating
//     supply (mirrors pushOwnedLiquiditySupply's behavior for UniV2 /
//     Balancer, which can't handle UniV3 because UniV3 LP is NFT-based and
//     getLpTokenForHandler returns null for kind: "univ3"). Empirically,
//     omitting the supply emit caused ohmFloatingSupply to overstate by
//     ~700k OHM on Ethereum vs legacy on 2026-05-20 (fix `a4b714a`).
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

    for (const position of result.positions) {
      const pairKey = [position.token0, position.token1].sort().join("/");
      const pool = univ3Pools.get(pairKey);
      if (!pool) continue;

      // sqrtPriceX96 sourced from indexed Univ3PoolState (no RPC).
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

      // Emit one TokenRecord per token in the position. Skip dust.
      const ohmTokenLower = config.ohmToken.toLowerCase();
      if (!balance0.eq(ZERO)) {
        const rate0 = (await getPrice(config, context, client, position.token0, blockNumber, null))
          .price;
        records.push(
          createTokenRecord(
            config,
            timestamp,
            `${getContractName(config, position.token0)} - UniV3 POL (${getContractName(config, pool.id)})`,
            position.token0,
            getContractName(config, wallet),
            wallet,
            rate0,
            balance0,
            blockNumber,
          ),
        );
        if (position.token0.toLowerCase() === ohmTokenLower) {
          supplies.push(
            createTokenSupply(
              config,
              timestamp,
              getContractName(config, config.ohmToken),
              config.ohmToken,
              getContractName(config, pool.id),
              pool.id,
              getContractName(config, wallet),
              wallet,
              TYPE_LIQUIDITY,
              balance0,
              blockNumber,
              -1,
            ),
          );
        }
      }
      if (!balance1.eq(ZERO)) {
        const rate1 = (await getPrice(config, context, client, position.token1, blockNumber, null))
          .price;
        records.push(
          createTokenRecord(
            config,
            timestamp,
            `${getContractName(config, position.token1)} - UniV3 POL (${getContractName(config, pool.id)})`,
            position.token1,
            getContractName(config, wallet),
            wallet,
            rate1,
            balance1,
            blockNumber,
          ),
        );
        if (position.token1.toLowerCase() === ohmTokenLower) {
          supplies.push(
            createTokenSupply(
              config,
              timestamp,
              getContractName(config, config.ohmToken),
              config.ohmToken,
              getContractName(config, pool.id),
              pool.id,
              getContractName(config, wallet),
              wallet,
              TYPE_LIQUIDITY,
              balance1,
              blockNumber,
              -1,
            ),
          );
        }
      }
    }
  }
}
