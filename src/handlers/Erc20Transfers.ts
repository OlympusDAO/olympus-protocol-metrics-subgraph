import { type Erc20Supply, indexer, type LenderAmo, type TokenBalance } from "envio";

import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr } from "../snapshot/math";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type ChainId = 42161 | 80094;

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

async function applyTransferToWalletBalance(
  context: {
    TokenBalance: {
      get: (id: string) => Promise<TokenBalance | undefined>;
      set: (entity: TokenBalance) => void;
    };
  },
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  delta: bigint,
  blockNumber: number,
): Promise<void> {
  const id = tokenBalanceId(chainId, tokenAddress, walletAddress);
  const existing = await context.TokenBalance.get(id);
  const previous = existing?.balance ?? 0n;
  const next = previous + delta;
  context.TokenBalance.set({
    id,
    chainId,
    tokenAddress: addr(tokenAddress),
    walletAddress: addr(walletAddress),
    balance: next,
    updatedAtBlock: BigInt(blockNumber),
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
  },
  chainId: number,
  tokenAddress: string,
  delta: bigint,
  blockNumber: number,
): Promise<void> {
  const id = erc20SupplyId(chainId, tokenAddress);
  const existing = await context.Erc20Supply.get(id);
  const previous = existing?.totalSupply ?? 0n;
  const next = previous + delta;
  context.Erc20Supply.set({
    id,
    chainId,
    tokenAddress: addr(tokenAddress),
    totalSupply: next < 0n ? 0n : next,
    updatedAtBlock: BigInt(blockNumber),
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

    if (wallets.has(from)) {
      await applyTransferToWalletBalance(
        context,
        event.chainId,
        token,
        from,
        -value,
        event.block.number,
      );
    }
    if (wallets.has(to)) {
      await applyTransferToWalletBalance(
        context,
        event.chainId,
        token,
        to,
        value,
        event.block.number,
      );
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

    if (from === ZERO_ADDRESS) {
      await applyMintBurnToSupply(context, event.chainId, token, value, event.block.number);
      // Mint to an active Lender AMO → deployedOhm += value. Replaces the
      // per-snapshot getDeployedOhm RPC call.
      await applyDeployedOhmDelta(context, event.chainId, to, value, event.block.number);
    } else if (wallets.has(from)) {
      await applyTransferToWalletBalance(
        context,
        event.chainId,
        token,
        from,
        -value,
        event.block.number,
      );
    }

    if (to === ZERO_ADDRESS) {
      await applyMintBurnToSupply(context, event.chainId, token, -value, event.block.number);
      // Burn from an active Lender AMO → deployedOhm -= value.
      await applyDeployedOhmDelta(context, event.chainId, from, -value, event.block.number);
    } else if (wallets.has(to)) {
      await applyTransferToWalletBalance(
        context,
        event.chainId,
        token,
        to,
        value,
        event.block.number,
      );
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
    block: { number: number };
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

  if (from === ZERO_ADDRESS) {
    await applyMintBurnToSupply(context, event.chainId, token, value, event.block.number);
  } else if (wallets.has(from)) {
    await applyTransferToWalletBalance(
      context,
      event.chainId,
      token,
      from,
      -value,
      event.block.number,
    );
  }

  if (to === ZERO_ADDRESS) {
    await applyMintBurnToSupply(context, event.chainId, token, -value, event.block.number);
  } else if (wallets.has(to)) {
    await applyTransferToWalletBalance(
      context,
      event.chainId,
      token,
      to,
      value,
      event.block.number,
    );
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
