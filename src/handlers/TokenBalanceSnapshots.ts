import {
  type Address,
  BigDecimal,
  createEffect,
  type EvmOnBlockContext,
  type EvmOnEventContext,
  indexer,
  S,
  type TrackedTokenBalanceSnapshot,
} from "envio";

import {
  getClient,
  getDecimals,
  getErc20RawBalance,
  withContractReadCache,
} from "../snapshot/contracts";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr, isActive, same, toDecimal } from "../snapshot/math";
import {
  getTokenTrackingStartBlock,
  getTrackedBalanceLookupKey,
  getTrackedBalanceSnapshotId,
  getTrackedTokenWalletPairs,
  getTrackedWalletAddresses,
} from "../snapshot/tracked-balances";
import type { ChainConfig, TrackedTokenBalanceInput } from "../snapshot/types";

type HandlerContext = EvmOnBlockContext | EvmOnEventContext;
type TrackedERC20TransferEvent = {
  readonly chainId: ChainConfig["chainId"];
  readonly srcAddress: string;
  readonly logIndex: number;
  readonly block: { readonly number: number };
  readonly params: {
    readonly from: string;
    readonly to: string;
    readonly value: bigint;
  };
};

const INITIALIZATION_LOG_INDEX = -1;

const getInitialTrackedTokenBalance = {
  name: "getInitialTrackedTokenBalance",
  input: {
    chainId: S.number,
    tokenAddress: S.string,
    walletAddress: S.string,
    blockNumber: S.number,
  },
  output: S.object(({ field }) => ({
    decimals: field("decimals", S.number),
    balanceRaw: field("balanceRaw", S.string),
    balance: field("balance", S.string),
  })),
  rateLimit: { calls: 1_000_000, per: "second" } as const,
  cache: true,
};

const initialTrackedTokenBalanceEffect = createEffect(
  getInitialTrackedTokenBalance,
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const blockNumber = BigInt(input.blockNumber);
    return withContractReadCache(async () => {
      const [decimals, balanceRaw] = await Promise.all([
        getDecimals(client, input.tokenAddress, blockNumber),
        getErc20RawBalance(client, input.tokenAddress, input.walletAddress, blockNumber),
      ]);
      return {
        decimals,
        balanceRaw: balanceRaw.toString(),
        balance: toDecimal(balanceRaw, decimals).toString(10),
      };
    });
  },
);

indexer.onEvent(
  {
    contract: "TrackedERC20",
    event: "Transfer",
    where: ({ chain }) => {
      const config = CHAIN_CONFIGS[chain.id];
      if (!config) return false;
      const walletAddresses = getTrackedWalletAddresses(config) as Address[];
      return {
        params: [{ from: walletAddresses }, { to: walletAddresses }],
        block: { number: { _gte: config.startBlock } },
      };
    },
  },
  async ({ event, context }) => {
    const config = CHAIN_CONFIGS[event.chainId];
    if (!config) throw new Error(`Unsupported chain ${event.chainId}`);
    const tokenAddress = addr(event.srcAddress);
    if (!isTrackedToken(config, tokenAddress, BigInt(event.block.number))) return;

    const trackedWallets = getTrackedTokenWalletPairs(config, BigInt(event.block.number))
      .filter((pair) => same(pair.tokenAddress, tokenAddress))
      .map((pair) => pair.walletAddress);
    const changedWallets = new Set<string>();
    if (trackedWallets.some((wallet) => same(wallet, event.params.from))) {
      changedWallets.add(addr(event.params.from));
    }
    if (trackedWallets.some((wallet) => same(wallet, event.params.to))) {
      changedWallets.add(addr(event.params.to));
    }
    if (changedWallets.size === 0) return;

    for (const walletAddress of changedWallets) {
      await writeTransferBalanceSnapshot(context, config, tokenAddress, walletAddress, event);
    }
  },
);

export async function getTrackedTokenBalancesForSnapshot(
  context: EvmOnBlockContext,
  config: ChainConfig,
  blockNumber: bigint,
): Promise<TrackedTokenBalanceInput[]> {
  const balances: TrackedTokenBalanceInput[] = [];
  for (const { tokenAddress, walletAddress } of getTrackedTokenWalletPairs(config, blockNumber)) {
    await ensureInitialized(context, config, tokenAddress, walletAddress);
    const latest = await getLatestBalanceSnapshot(
      context,
      config,
      tokenAddress,
      walletAddress,
      blockNumber,
    );
    if (!latest) continue;
    balances.push({
      tokenAddress,
      walletAddress,
      balance: latest.balance.toString(10),
    });
  }
  return balances;
}

async function writeTransferBalanceSnapshot(
  context: EvmOnEventContext,
  config: ChainConfig,
  tokenAddress: string,
  walletAddress: string,
  event: TrackedERC20TransferEvent,
) {
  const initializationBlock = await ensureInitialized(context, config, tokenAddress, walletAddress);
  const eventBlock = BigInt(event.block.number);
  if (eventBlock <= initializationBlock) return;

  const latest = await getLatestBalanceSnapshot(
    context,
    config,
    tokenAddress,
    walletAddress,
    eventBlock,
    event.logIndex,
  );
  if (!latest) {
    throw new Error(
      `Missing initialized tracked balance for ${config.chainId}/${tokenAddress}/${walletAddress}`,
    );
  }

  let deltaRaw = 0n;
  if (same(walletAddress, event.params.from)) deltaRaw -= event.params.value;
  if (same(walletAddress, event.params.to)) deltaRaw += event.params.value;
  if (deltaRaw === 0n) return;

  const balanceRaw = latest.balanceRaw + deltaRaw;
  const balance = toDecimal(balanceRaw, latest.decimals);
  context.TrackedTokenBalanceSnapshot.set({
    id: getTrackedBalanceSnapshotId(
      config.chainId,
      tokenAddress,
      walletAddress,
      eventBlock,
      event.logIndex,
    ),
    lookupKey: getTrackedBalanceLookupKey(config.chainId, tokenAddress, walletAddress),
    chainId: config.chainId,
    tokenAddress,
    walletAddress,
    block: eventBlock,
    logIndex: event.logIndex,
    decimals: latest.decimals,
    balanceRaw,
    balance: new BigDecimal(balance.toString(10)),
    deltaRaw,
    delta: new BigDecimal(toDecimal(deltaRaw, latest.decimals).toString(10)),
    source: "transfer",
  });
}

async function ensureInitialized(
  context: HandlerContext,
  config: ChainConfig,
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> {
  const blockNumber = BigInt(getTokenTrackingStartBlock(config, tokenAddress));
  const id = getTrackedBalanceSnapshotId(
    config.chainId,
    tokenAddress,
    walletAddress,
    blockNumber,
    INITIALIZATION_LOG_INDEX,
  );
  const existing = await context.TrackedTokenBalanceSnapshot.get(id);
  if (existing) return existing.block;

  const initial = (await context.effect(initialTrackedTokenBalanceEffect, {
    chainId: config.chainId,
    tokenAddress,
    walletAddress,
    blockNumber: Number(blockNumber),
  })) as { decimals: number; balanceRaw: string; balance: string };
  const balanceRaw = BigInt(initial.balanceRaw);
  context.TrackedTokenBalanceSnapshot.set({
    id,
    lookupKey: getTrackedBalanceLookupKey(config.chainId, tokenAddress, walletAddress),
    chainId: config.chainId,
    tokenAddress,
    walletAddress,
    block: blockNumber,
    logIndex: INITIALIZATION_LOG_INDEX,
    decimals: initial.decimals,
    balanceRaw,
    balance: new BigDecimal(initial.balance),
    deltaRaw: balanceRaw,
    delta: new BigDecimal(initial.balance),
    source: "initialization",
  });
  return blockNumber;
}

async function getLatestBalanceSnapshot(
  context: HandlerContext,
  config: ChainConfig,
  tokenAddress: string,
  walletAddress: string,
  blockNumber: bigint,
  beforeLogIndex?: number,
): Promise<TrackedTokenBalanceSnapshot | undefined> {
  const lookupKey = getTrackedBalanceLookupKey(config.chainId, tokenAddress, walletAddress);
  const snapshots = await context.TrackedTokenBalanceSnapshot.getWhere({
    lookupKey: { _eq: lookupKey },
  });
  return snapshots
    .filter(
      (snapshot) =>
        snapshot.block < blockNumber ||
        (snapshot.block === blockNumber &&
          (beforeLogIndex === undefined || snapshot.logIndex < beforeLogIndex)),
    )
    .sort((left, right) => {
      if (left.block !== right.block) return left.block > right.block ? -1 : 1;
      return right.logIndex - left.logIndex;
    })[0];
}

function isTrackedToken(config: ChainConfig, tokenAddress: string, blockNumber: bigint) {
  if (!getTrackedTokenWalletPairs(config).some((pair) => same(pair.tokenAddress, tokenAddress))) {
    return false;
  }
  const definition = config.tokens.find((token) => same(token.address, tokenAddress));
  if (definition) return isActive(definition, blockNumber);
  if (same(config.ohmToken, tokenAddress) && config.ohmStartBlock !== undefined) {
    return blockNumber >= BigInt(config.ohmStartBlock);
  }
  return true;
}
