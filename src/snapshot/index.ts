import { createEffect, S } from "envio";

import { CHAIN_CONFIGS } from "./chains";
import { getBlock, getClient, withContractReadCache } from "./contracts";
import { pushArbitrumLendingSupply } from "./lending/arbitrum";
import { withPricingCache } from "./pricing";
import { getContractName } from "./records";
import { pushArbitrumStakingRecords } from "./staking/arbitrum";
import { pushOwnedLiquidityRecords, pushTokenBalanceRecords } from "./token-records";
import { pushOwnedLiquiditySupply, pushTotalSupply, pushTreasuryOhm } from "./token-supplies";
import { toTrackedBalanceMap } from "./tracked-balances";
import type { ChainConfig, Snapshot, TrackedTokenBalanceInput } from "./types";

export type { Snapshot } from "./types";

export const getSnapshot = createEffect(
  {
    name: "getSnapshot",
    input: {
      chainId: S.number,
      blockNumber: S.number,
      trackedTokenBalances: S.optional(
        S.array(
          S.object(({ field }) => ({
            tokenAddress: field("tokenAddress", S.string),
            walletAddress: field("walletAddress", S.string),
            balance: field("balance", S.string),
          })),
        ),
      ),
    },
    output: S.unknown,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: false,
  },
  async ({ input, context }) => {
    const config = CHAIN_CONFIGS[input.chainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const startedAt = Date.now();
    context.log.info(`Starting getSnapshot for ${config.blockchain} block ${input.blockNumber}`);
    const snapshot = await withContractReadCache(() =>
      withPricingCache(() =>
        generateSnapshot(
          config,
          BigInt(input.blockNumber),
          (message, metadata) => context.log.info(message, metadata),
          input.trackedTokenBalances,
        ),
      ),
    );
    context.log.info(
      `Finished getSnapshot for ${config.blockchain} block ${input.blockNumber} in ${
        Date.now() - startedAt
      }ms`,
      {
        tokenRecords: snapshot.tokenRecords.length,
        tokenSupplies: snapshot.tokenSupplies.length,
      },
    );
    return snapshot;
  },
);

type SnapshotLogger = (message: string, metadata?: Record<string, unknown>) => void;

async function generateSnapshot(
  config: ChainConfig,
  blockNumber: bigint,
  log: SnapshotLogger,
  trackedTokenBalances?: TrackedTokenBalanceInput[],
): Promise<Snapshot> {
  const client = getClient(config);
  const block = await runSnapshotStep(
    log,
    "fetch block",
    { blockNumber: blockNumber.toString() },
    () => getBlock(client, blockNumber),
  );
  const timestamp = block.timestamp;
  const snapshot: Snapshot = { tokenRecords: [], tokenSupplies: [] };
  const trackedBalances = toTrackedBalanceMap(trackedTokenBalances);

  for (const category of ["Stable", "Volatile"]) {
    for (const definition of config.tokens.filter((value) => value.category === category)) {
      const tokenMetadata = {
        category,
        token: getContractName(config, definition.address),
        address: definition.address,
        blockNumber: blockNumber.toString(),
      };
      await runSnapshotStep(log, "push token balance records", tokenMetadata, () =>
        pushTokenBalanceRecords(
          snapshot,
          config,
          client,
          definition,
          timestamp,
          blockNumber,
          trackedBalances,
        ),
      );
      if (config.chainId === 42161) {
        await runSnapshotStep(log, "push Arbitrum staking records", tokenMetadata, () =>
          pushArbitrumStakingRecords(
            snapshot,
            config,
            client,
            definition,
            timestamp,
            blockNumber,
            log,
          ),
        );
      }
    }
  }

  for (const handler of config.ownedLiquidityHandlers) {
    await runSnapshotStep(
      log,
      "push owned liquidity records",
      {
        handler: getContractName(config, handler.id),
        id: handler.id,
        blockNumber: blockNumber.toString(),
      },
      () => pushOwnedLiquidityRecords(snapshot, config, client, handler, timestamp, blockNumber),
    );
  }

  await runSnapshotStep(log, "push total supply", { blockNumber: blockNumber.toString() }, () =>
    pushTotalSupply(snapshot, config, client, timestamp, blockNumber),
  );
  await runSnapshotStep(
    log,
    "push treasury OHM supply",
    { blockNumber: blockNumber.toString() },
    () => pushTreasuryOhm(snapshot, config, client, timestamp, blockNumber, trackedBalances),
  );
  await runSnapshotStep(
    log,
    "push owned liquidity supply",
    { blockNumber: blockNumber.toString() },
    () => pushOwnedLiquiditySupply(snapshot, config, client, timestamp, blockNumber),
  );

  if (config.chainId === 42161) {
    await runSnapshotStep(
      log,
      "push Arbitrum lending supply",
      { blockNumber: blockNumber.toString() },
      () => pushArbitrumLendingSupply(snapshot, config, client, timestamp, blockNumber),
    );
  }

  return snapshot;
}

async function runSnapshotStep<T>(
  log: SnapshotLogger,
  name: string,
  metadata: Record<string, unknown>,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  log(`Starting snapshot step: ${name}`, metadata);
  try {
    const result = await operation();
    log(`Finished snapshot step: ${name}`, {
      ...metadata,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    log(`Failed snapshot step: ${name}`, {
      ...metadata,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
