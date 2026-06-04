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
// Reused by Wrapped9 + Erc4626Vault contracts because Envio's address table keys
// on (chainId, address), so each address must live under exactly one contract
// definition. WETH / WFTM / sDAI / etc. live under Wrapped9 / Erc4626Vault and
// reuse this same treasury-balance Transfer logic; Erc4626 supply mint/burn
// accounting is handled by the Deposit/Withdraw handlers below.
export const buildTreasuryTransferWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ from: wallets }, { to: wallets }] };
};

export async function handleTreasuryTransfer(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { from: string; to: string; value: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
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

  if (wallets.has(from)) {
    await applyTransferToWalletBalance(context, event.chainId, token, from, -value, meta);
  }
  if (wallets.has(to)) {
    await applyTransferToWalletBalance(context, event.chainId, token, to, value, meta);
  }
}

indexer.onEvent(
  {
    contract: "TreasuryERC20",
    event: "Transfer",
    where: buildTreasuryTransferWhere,
  },
  handleTreasuryTransfer,
);

indexer.onEvent(
  {
    contract: "Wrapped9",
    event: "Transfer",
    where: buildTreasuryTransferWhere,
  },
  handleTreasuryTransfer,
);

indexer.onEvent(
  {
    contract: "Erc4626Vault",
    event: "Transfer",
    where: buildTreasuryTransferWhere,
  },
  handleTreasuryTransfer,
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

// StakingRewardsVault stake tokens (Beradrome / Infrared / BeraHub on Berachain)
// behave as plain LP receipt tokens for direct ERC20 Transfer activity — the
// wallet-to-wallet hand-offs that don't go through stake() / withdraw(). The
// Staked / Withdrawn handlers below cover the silent stake-balance mutations.
indexer.onEvent(
  {
    contract: "StakingRewardsVault",
    event: "Transfer",
    where: buildLpTransferWhere,
  },
  handleLpTransfer,
);

// WETH9 Deposit (wrap): credits balance to `dst` without emitting Transfer.
// Treat as a synthetic Transfer-from-zero so applyTransferToWalletBalance does
// the right thing for wallets that wrap ETH and forward the wETH. Without this
// handler, a wrap-and-forward pattern (e.g. LUSD_ALLOCATOR receives ETH from
// the Liquity StabilityPool, wraps to wETH, transfers to Treasury) records the
// outflow Transfer but misses the wrap inflow and drifts negative.
export async function handleWrapped9Deposit(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { dst: string; wad: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const dst = addr(event.params.dst);
  if (!wallets.has(dst)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(context, event.chainId, token, dst, event.params.wad, meta);
}

// WETH9 Withdrawal (unwrap): debits balance from `src` without emitting Transfer.
export async function handleWrapped9Withdrawal(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { src: string; wad: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const src = addr(event.params.src);
  if (!wallets.has(src)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(context, event.chainId, token, src, -event.params.wad, meta);
}

const buildWrapped9DepositWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ dst: wallets }] };
};

const buildWrapped9WithdrawalWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ src: wallets }] };
};

indexer.onEvent(
  { contract: "Wrapped9", event: "Deposit", where: buildWrapped9DepositWhere },
  handleWrapped9Deposit,
);

indexer.onEvent(
  { contract: "Wrapped9", event: "Withdrawal", where: buildWrapped9WithdrawalWhere },
  handleWrapped9Withdrawal,
);

// ERC4626 vault Deposit: mints `shares` to `owner`. Most vaults (sDAI verified)
// emit only this event on deposit — no Transfer-from-zero — so subscribing to
// Transfer alone misses every share mint. Routes through the existing balance
// helper so the TokenBalance ledger reflects share holdings correctly.
export async function handleErc4626Deposit(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { sender: string; owner: string; assets: bigint; shares: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const owner = addr(event.params.owner);
  if (!wallets.has(owner)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(
    context,
    event.chainId,
    token,
    owner,
    event.params.shares,
    meta,
  );
}

// ERC4626 vault Withdraw: burns `shares` from `owner`. Same no-Transfer
// behavior as Deposit on most vault implementations.
export async function handleErc4626Withdraw(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { sender: string; receiver: string; owner: string; assets: bigint; shares: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const owner = addr(event.params.owner);
  if (!wallets.has(owner)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(
    context,
    event.chainId,
    token,
    owner,
    -event.params.shares,
    meta,
  );
}

const buildErc4626DepositWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ owner: wallets }] };
};

const buildErc4626WithdrawWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ owner: wallets }] };
};

indexer.onEvent(
  { contract: "Erc4626Vault", event: "Deposit", where: buildErc4626DepositWhere },
  handleErc4626Deposit,
);

indexer.onEvent(
  { contract: "Erc4626Vault", event: "Withdraw", where: buildErc4626WithdrawWhere },
  handleErc4626Withdraw,
);

// Synthetix-style StakingRewards vault Staked: credits the `user`'s stake
// balance without emitting Transfer. The vault contract IS the "stake token"
// address — balanceOf(user) returns the internal _balances[user] entry that
// stake() bumps. Used by Beradrome / Infrared / BeraHub OHM-HONEY vaults.
export async function handleStakingRewardsStaked(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { user: string; amount: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const user = addr(event.params.user);
  if (!wallets.has(user)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(
    context,
    event.chainId,
    token,
    user,
    event.params.amount,
    meta,
  );
}

// Synthetix-style Withdrawn — debits the `user`'s stake balance.
export async function handleStakingRewardsWithdrawn(args: {
  event: {
    chainId: number;
    srcAddress: string;
    logIndex: number;
    block: { number: number; timestamp: number };
    params: { user: string; amount: bigint };
  };
  context: Parameters<typeof applyTransferToWalletBalance>[0];
}): Promise<void> {
  const { event, context } = args;
  const wallets = new Set<string>(treasuryWalletsForChain(event.chainId));
  const user = addr(event.params.user);
  if (!wallets.has(user)) return;
  const token = addr(event.srcAddress);
  const meta: EventMeta = {
    block: event.block.number,
    timestamp: event.block.timestamp,
    logIndex: event.logIndex,
  };
  await applyTransferToWalletBalance(
    context,
    event.chainId,
    token,
    user,
    -event.params.amount,
    meta,
  );
}

const buildStakingRewardsWhere = ({ chain }: { chain: { id: number } }) => {
  const wallets = treasuryWalletsForChain(chain.id);
  if (wallets.length === 0) return false as const;
  return { params: [{ user: wallets }] };
};

indexer.onEvent(
  { contract: "StakingRewardsVault", event: "Staked", where: buildStakingRewardsWhere },
  handleStakingRewardsStaked,
);

indexer.onEvent(
  { contract: "StakingRewardsVault", event: "Withdrawn", where: buildStakingRewardsWhere },
  handleStakingRewardsWithdrawn,
);
