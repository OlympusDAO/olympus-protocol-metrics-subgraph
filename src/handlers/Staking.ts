import { indexer, type JonesStakingPosition, type TreasureDeposit } from "envio";

import { addr } from "../snapshot/math";

function jonesPositionId(chainId: number, poolId: bigint, walletAddress: string): string {
  return `${chainId}-${poolId.toString()}-${addr(walletAddress)}`;
}

function treasureDepositId(chainId: number, walletAddress: string, depositId: bigint): string {
  return `${chainId}-${addr(walletAddress)}-${depositId.toString()}`;
}

async function applyJonesDelta(
  context: {
    JonesStakingPosition: {
      get: (id: string) => Promise<JonesStakingPosition | undefined>;
      set: (entity: JonesStakingPosition) => void;
    };
  },
  chainId: number,
  poolId: bigint,
  user: string,
  delta: bigint,
  blockNumber: number,
): Promise<void> {
  const id = jonesPositionId(chainId, poolId, user);
  const existing = await context.JonesStakingPosition.get(id);
  const previous = existing?.amount ?? 0n;
  const next = previous + delta;
  context.JonesStakingPosition.set({
    id,
    chainId,
    poolId,
    walletAddress: addr(user),
    amount: next < 0n ? 0n : next,
    updatedAtBlock: BigInt(blockNumber),
  });
}

async function applyTreasureDelta(
  context: {
    TreasureDeposit: {
      get: (id: string) => Promise<TreasureDeposit | undefined>;
      set: (entity: TreasureDeposit) => void;
    };
  },
  chainId: number,
  user: string,
  depositId: bigint,
  delta: bigint,
  blockNumber: number,
): Promise<void> {
  const id = treasureDepositId(chainId, user, depositId);
  const existing = await context.TreasureDeposit.get(id);
  const previous = existing?.amount ?? 0n;
  const next = previous + delta;
  context.TreasureDeposit.set({
    id,
    chainId,
    walletAddress: addr(user),
    depositId,
    amount: next < 0n ? 0n : next,
    updatedAtBlock: BigInt(blockNumber),
  });
}

// ---- Jones MasterChef-style staking
indexer.onEvent(
  {
    contract: "JonesStaking",
    event: "Deposit",
  },
  async ({ event, context }) => {
    await applyJonesDelta(
      context,
      event.chainId,
      event.params.pid,
      event.params.user,
      event.params.amount,
      event.block.number,
    );
  },
);

indexer.onEvent(
  {
    contract: "JonesStaking",
    event: "Withdraw",
  },
  async ({ event, context }) => {
    await applyJonesDelta(
      context,
      event.chainId,
      event.params.pid,
      event.params.user,
      -event.params.amount,
      event.block.number,
    );
  },
);

indexer.onEvent(
  {
    contract: "JonesStaking",
    event: "EmergencyWithdraw",
  },
  async ({ event, context }) => {
    await applyJonesDelta(
      context,
      event.chainId,
      event.params.pid,
      event.params.user,
      -event.params.amount,
      event.block.number,
    );
  },
);

// ---- Treasure Atlas Mine (Magic staking)
indexer.onEvent(
  {
    contract: "TreasureMining",
    event: "Deposit",
  },
  async ({ event, context }) => {
    await applyTreasureDelta(
      context,
      event.chainId,
      event.params.user,
      event.params.index,
      event.params.amount,
      event.block.number,
    );
  },
);

indexer.onEvent(
  {
    contract: "TreasureMining",
    event: "Withdraw",
  },
  async ({ event, context }) => {
    await applyTreasureDelta(
      context,
      event.chainId,
      event.params.user,
      event.params.index,
      -event.params.amount,
      event.block.number,
    );
  },
);
