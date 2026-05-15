import {
  type BalancerPoolState,
  type BalancerPoolUpdate,
  type EvmOnEventContext,
  indexer,
} from "envio";

import { seedBalancerPool } from "../effects";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";
import type { ChainId } from "../snapshot/types";

// Per @0xJem on PR #315 every state mutation also persists an immutable
// `BalancerPoolUpdate` row keyed by (chainId, poolId, block, logIndex).
function setBalancerPoolBoth(
  context: {
    BalancerPoolState: { set: (entity: BalancerPoolState) => void };
    BalancerPoolUpdate: { set: (entity: BalancerPoolUpdate) => void };
  },
  state: BalancerPoolState,
  meta: { block: bigint; timestamp: bigint; logIndex: number },
): void {
  context.BalancerPoolUpdate.set({
    id: `${state.chainId}-${state.poolId}-${meta.block}-${meta.logIndex}`,
    chainId: state.chainId,
    poolId: state.poolId,
    tokens: state.tokens,
    balances: state.balances,
    block: meta.block,
    timestamp: meta.timestamp,
  });
  context.BalancerPoolState.set(state);
}

// The Balancer V2 Vault is one shared contract per chain that hosts *every*
// pool. Without an event-level filter on poolId, HyperSync would deliver every
// Swap on every Balancer pool — millions of events. We narrow to the pools
// we actually care about (from the chain config's `kind: "balancer"` handlers).
function poolIdsForChain(chainId: number): `0x${string}`[] {
  const config = CHAIN_CONFIGS[chainId as ChainId];
  if (!config) return [];
  return config.liquidityHandlers
    .filter((handler) => handler.kind === "balancer")
    .map((handler) => handler.id as `0x${string}`);
}

const buildBalancerPoolIdWhere = ({ chain }: { chain: { id: number } }) => {
  const poolIds = poolIdsForChain(chain.id);
  if (poolIds.length === 0) return false as const;
  return { params: { poolId: poolIds } };
};

function balancerPoolStateId(chainId: number, poolId: string): string {
  return `${chainId}-${poolId.toLowerCase()}`;
}

async function ensurePoolState(
  context: EvmOnEventContext,
  chainId: number,
  vault: string,
  poolId: string,
  meta: { block: bigint; timestamp: bigint; logIndex: number },
): Promise<{ state: BalancerPoolState; isSeed: boolean }> {
  const id = balancerPoolStateId(chainId, poolId);
  const existing = await context.BalancerPoolState.get(id);
  if (existing) return { state: existing, isSeed: false };

  // Pool not seen before — seed from on-chain getPoolTokens at this block. The
  // call hits RPC once per pool ever (cached effect), then state is maintained
  // purely from events.
  const seed = (await context.effect(seedBalancerPool, {
    chainId,
    vault: addr(vault),
    poolId: poolId.toLowerCase(),
    atBlock: Number(meta.block),
  })) as { tokens: string[]; balances: string[] };

  const state: BalancerPoolState = {
    id,
    chainId,
    poolId: poolId.toLowerCase(),
    tokens: seed.tokens,
    balances: seed.balances.map((value) => BigInt(value)),
    updatedAtBlock: meta.block,
  };
  setBalancerPoolBoth(context, state, meta);
  return { state, isSeed: true };
}

function indexOfToken(tokens: readonly string[], target: string): number {
  const lower = target.toLowerCase();
  return tokens.findIndex((value) => value.toLowerCase() === lower);
}

// TokensRegistered fires when a pool registers its token set. On networks where
// our chain start_block predates this event we'll seed via getPoolTokens
// instead and ignore this event; otherwise we get the canonical token order
// for free.
indexer.onEvent(
  {
    contract: "BalancerVault",
    event: "TokensRegistered",
    where: buildBalancerPoolIdWhere,
  },
  async ({ event, context }) => {
    const poolId = event.params.poolId.toLowerCase();
    const tokens = event.params.tokens.map((value) => addr(value));
    const id = balancerPoolStateId(event.chainId, poolId);
    const existing = await context.BalancerPoolState.get(id);
    if (existing) {
      // Token set is already known. TokensRegistered is invariant per pool so
      // we don't expect this to fire twice — log and skip.
      return;
    }
    const block = BigInt(event.block.number);
    setBalancerPoolBoth(
      context,
      {
        id,
        chainId: event.chainId,
        poolId,
        tokens,
        balances: tokens.map(() => 0n),
        updatedAtBlock: block,
      },
      { block, timestamp: BigInt(event.block.timestamp), logIndex: event.logIndex },
    );
  },
);

// PoolBalanceChanged emits deltas applied to each token in the pool's
// canonical order, along with the protocol fees skimmed during the operation.
// Pool balance after = pool balance before + delta - protocolFee.
indexer.onEvent(
  {
    contract: "BalancerVault",
    event: "PoolBalanceChanged",
    where: buildBalancerPoolIdWhere,
  },
  async ({ event, context }) => {
    const block = BigInt(event.block.number);
    const meta = { block, timestamp: BigInt(event.block.timestamp), logIndex: event.logIndex };
    const { state, isSeed } = await ensurePoolState(
      context,
      event.chainId,
      event.srcAddress,
      event.params.poolId,
      meta,
    );
    // The seed read used the same block as the event so the new balances are
    // already reflected in the seed. Skip applying the delta to avoid
    // double-counting.
    if (isSeed) return;

    const balances = [...state.balances];
    const tokens = event.params.tokens;
    const deltas = event.params.deltas;
    const fees = event.params.protocolFeeAmounts;
    for (let i = 0; i < tokens.length; i++) {
      const idx = indexOfToken(state.tokens, tokens[i]);
      if (idx < 0) continue;
      balances[idx] = balances[idx] + deltas[i] - fees[i];
    }

    setBalancerPoolBoth(
      context,
      {
        ...state,
        balances,
        updatedAtBlock: block,
      },
      meta,
    );
  },
);

// Vault Swap: pool balance change is +amountIn on tokenIn, -amountOut on
// tokenOut. The event doesn't carry the full token array, so we look up the
// tokens through the stored canonical order from a prior event.
indexer.onEvent(
  {
    contract: "BalancerVault",
    event: "Swap",
    where: buildBalancerPoolIdWhere,
  },
  async ({ event, context }) => {
    const block = BigInt(event.block.number);
    const meta = { block, timestamp: BigInt(event.block.timestamp), logIndex: event.logIndex };
    const { state, isSeed } = await ensurePoolState(
      context,
      event.chainId,
      event.srcAddress,
      event.params.poolId,
      meta,
    );
    if (isSeed) return;

    const idxIn = indexOfToken(state.tokens, event.params.tokenIn);
    const idxOut = indexOfToken(state.tokens, event.params.tokenOut);
    if (idxIn < 0 || idxOut < 0) return;

    const balances = [...state.balances];
    balances[idxIn] = balances[idxIn] + event.params.amountIn;
    balances[idxOut] = balances[idxOut] - event.params.amountOut;

    setBalancerPoolBoth(
      context,
      {
        ...state,
        balances,
        updatedAtBlock: block,
      },
      meta,
    );
  },
);
