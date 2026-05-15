import {
  type Erc20Supply,
  type Erc20SupplyUpdate,
  indexer,
  type LenderAmo,
  type TokenBalance,
  type TokenBalanceUpdate,
} from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";
import type { ChainId } from "../snapshot/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function treasuryWalletsForChain(chainId: number): `0x${string}`[] {
  const config = CHAIN_CONFIGS[chainId as ChainId];
  if (!config) return [];
  return config.protocolAddresses as `0x${string}`[];
}

const ZERO_ADDRESS_PARAM: `0x${string}` = ZERO_ADDRESS;

function tokenBalanceId(chainId: number, tokenAddress: string, walletAddress: string): string {
  return `${chainId}-${addr(tokenAddress)}-${addr(walletAddress)}`;
}

function erc20SupplyId(chainId: number, tokenAddress: string): string {
  return `${chainId}-${addr(tokenAddress)}`;
}

// Per @0xJem on PR #315: every state mutation also persists an immutable
// `XxxUpdate` row keyed by (..., block, logIndex). The mutable XxxState
// row is the snapshot's fast O(1) latest pointer.
type EventMeta = { block: number; timestamp: number; logIndex: number };

async function applyTransferToWalletBalance(
  context: {
    TokenBalance: {
      get: (id: string) => Promise<TokenBalance | undefined>;
      set: (entity: TokenBalance) => void;
    };
    TokenBalanceUpdate: { set: (entity: TokenBalanceUpdate) => void };
  },
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  delta: bigint,
  meta: EventMeta,
): Promise<void> {
  const id = tokenBalanceId(chainId, tokenAddress, walletAddress);
  const existing = await context.TokenBalance.get(id);
  const previous = existing?.balance ?? 0n;
  const next = previous + delta;
  const block = BigInt(meta.block);
  const tokenLower = addr(tokenAddress);
  const walletLower = addr(walletAddress);

  context.TokenBalanceUpdate.set({
    id: `${chainId}-${tokenLower}-${walletLower}-${block}-${meta.logIndex}`,
    chainId,
    tokenAddress: tokenLower,
    walletAddress: walletLower,
    delta,
    balance: next,
    block,
    timestamp: BigInt(meta.timestamp),
  });

  context.TokenBalance.set({
    id,
    chainId,
    tokenAddress: tokenLower,
    walletAddress: walletLower,
    balance: next,
    updatedAtBlock: block,
  });
}

async function applyDeployedOhmDelta(
  context: {
    LenderAmo: {
      get: (id: string) => Promise<LenderAmo | undefined>;
      set: (entity: LenderAmo) => void;
    };
  },
  chainId: number,
  amoAddress: string,
  delta: bigint,
  blockNumber: number,
): Promise<void> {
  const id = `${chainId}-${addr(amoAddress)}`;
  const existing = await context.LenderAmo.get(id);
  if (!existing) return; // AMO not yet registered — AMOAdded will fire later
  const next = existing.deployedOhm + delta;
  context.LenderAmo.set({
    ...existing,
    deployedOhm: next < 0n ? 0n : next,
    updatedAtBlock: BigInt(blockNumber),
  });
}

async function applyMintBurnToSupply(
  context: {
    Erc20Supply: {
      get: (id: string) => Promise<Erc20Supply | undefined>;
      set: (entity: Erc20Supply) => void;
    };
    Erc20SupplyUpdate: { set: (entity: Erc20SupplyUpdate) => void };
  },
  chainId: number,
  tokenAddress: string,
  delta: bigint,
  meta: EventMeta,
): Promise<void> {
  const id = erc20SupplyId(chainId, tokenAddress);
  const existing = await context.Erc20Supply.get(id);
  const previous = existing?.totalSupply ?? 0n;
  const nextRaw = previous + delta;
  const next = nextRaw < 0n ? 0n : nextRaw;
  const block = BigInt(meta.block);
  const tokenLower = addr(tokenAddress);

  context.Erc20SupplyUpdate.set({
    id: `${chainId}-${tokenLower}-${block}-${meta.logIndex}`,
    chainId,
    tokenAddress: tokenLower,
    delta,
    totalSupply: next,
    block,
    timestamp: BigInt(meta.timestamp),
  });

  context.Erc20Supply.set({
    id,
    chainId,
    tokenAddress: tokenLower,
    totalSupply: next,
    updatedAtBlock: block,
  });
}

// Treasury-only ERC20 Transfer: maintain TokenBalance for treasury wallets only.
// HyperSync filtering keeps the event firehose tiny — these contracts (USDC, WETH,
// etc.) emit millions of transfers; we only see the ones touching us.
indexer.onEvent(
  {
    contract: "TreasuryERC20",
    event: "Transfer",
    where: ({ chain }) => {
      const wallets = treasuryWalletsForChain(chain.id);
      if (wallets.length === 0) return false;
      return { params: [{ from: wallets }, { to: wallets }] };
    },
  },
  async ({ event, context }) => {
    const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
    const from = addr(event.params.from);
    const to = addr(event.params.to);
    const value = event.params.value;
    const token = addr(event.srcAddress);
    const meta: EventMeta = {
      block: event.block.number,
      timestamp: event.block.timestamp,
      logIndex: event.logIndex,
    };

    if (wallets.has(from)) {
      await applyTransferToWalletBalance(context, event.chainId, token, from, -value, meta);
    }
    if (wallets.has(to)) {
      await applyTransferToWalletBalance(context, event.chainId, token, to, value, meta);
    }
  },
);

// OHM ERC20 Transfer: track BOTH treasury balances and totalSupply (mints/burns).
indexer.onEvent(
  {
    contract: "OhmERC20",
    event: "Transfer",
    where: ({ chain }) => {
      const wallets = treasuryWalletsForChain(chain.id);
      if (wallets.length === 0) return false;
      return {
        params: [
          { from: wallets },
          { to: wallets },
          { from: [ZERO_ADDRESS_PARAM] },
          { to: [ZERO_ADDRESS_PARAM] },
        ],
      };
    },
  },
  async ({ event, context }) => {
    const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
    const from = addr(event.params.from);
    const to = addr(event.params.to);
    const value = event.params.value;
    const token = addr(event.srcAddress);
    const meta: EventMeta = {
      block: event.block.number,
      timestamp: event.block.timestamp,
      logIndex: event.logIndex,
    };

    if (from === ZERO_ADDRESS) {
      await applyMintBurnToSupply(context, event.chainId, token, value, meta);
      // Mint to an active Lender AMO → deployedOhm += value. Replaces the
      // per-snapshot getDeployedOhm RPC call.
      await applyDeployedOhmDelta(context, event.chainId, to, value, event.block.number);
    } else if (wallets.has(from)) {
      await applyTransferToWalletBalance(context, event.chainId, token, from, -value, meta);
    }

    if (to === ZERO_ADDRESS) {
      await applyMintBurnToSupply(context, event.chainId, token, -value, meta);
      // Burn from an active Lender AMO → deployedOhm -= value.
      await applyDeployedOhmDelta(context, event.chainId, from, -value, event.block.number);
    } else if (wallets.has(to)) {
      await applyTransferToWalletBalance(context, event.chainId, token, to, value, meta);
    }
  },
);

// LP token Transfer: tracks treasury POL balances + LP totalSupply (mint/burn).
// Same logic is reused for UniswapV2Pool Transfer events because Univ2 pairs ARE
// the LP token, so we can't register them under both "LpERC20" and "UniswapV2Pool".
export const buildLpTransferWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return {
    params: [
      { from: wallets },
      { to: wallets },
      { from: [ZERO_ADDRESS_PARAM] },
      { to: [ZERO_ADDRESS_PARAM] },
    ],
  };
};

export async function handleLpTransfer(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { from: string; to: string; value: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0] &
    Parameters<typeof applyMintBurnToSupply>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const from = addr(event.params.from);
  const to = addr(event.params.to);
  const value = event.params.value;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };

  if (from === ZERO_ADDRESS) {
    await applyMintBurnToSupply(context, event.chainId, token, value, meta);
  } else if (wallets.has(from)) {
    await applyTransferToWalletBalance(context, event.chainId, token, from, -value, meta);
  }

  if (to === ZERO_ADDRESS) {
    await applyMintBurnToSupply(context, event.chainId, token, -value, meta);
  } else if (wallets.has(to)) {
    await applyTransferToWalletBalance(context, event.chainId, token, to, value, meta);
  }
}

indexer.onEvent(
  {
    contract: "LpERC20",
    event: "Transfer",
    where: buildLpTransferWhere,
  },
  handleLpTransfer,
);

indexer.onEvent(
  {
    contract: "UniswapV2Pool",
    event: "Transfer",
    where: buildLpTransferWhere,
  },
  handleLpTransfer,
);
