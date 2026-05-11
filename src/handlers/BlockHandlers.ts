import {
  BigDecimal,
  type EvmOnBlockContext,
  indexer,
  type TokenRecord,
  type TokenSupply,
} from "envio";

import { getSnapshot, type Snapshot } from "../snapshot";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { getTrackedTokenBalancesForSnapshot } from "./TokenBalanceSnapshots";

const BLOCK_HANDLERS = [
  {
    name: "ArbitrumEightHourSnapshot",
    chain: 42161 as const,
    startBlock: 10950000,
    interval: 115200,
  },
  {
    name: "BerachainEightHourSnapshot",
    chain: 80094 as const,
    startBlock: 799194,
    interval: 14917,
  },
];

indexer.onBlock(
  {
    name: "EightHourSnapshot",
    where: ({ chain }) => {
      const handler = BLOCK_HANDLERS.find((value) => value.chain === chain.id);
      if (!handler) {
        throw new Error(`Unsupported chain ${chain.id} for EightHourSnapshot block handler`);
      }
      return {
        block: {
          number: {
            _gte: handler.startBlock,
            _every: handler.interval,
          },
        },
      };
    },
  },
  async ({ block, context }) => {
    const handler = BLOCK_HANDLERS.find((value) => value.chain === context.chain.id);
    if (!handler) {
      throw new Error(
        `Unsupported chain ${context.chain.id} for EightHourSnapshot block ${block.number}`,
      );
    }
    await processSnapshot(handler.name, block.number, context.chain.id, context);
  },
);

async function processSnapshot(
  name: string,
  blockNumber: number,
  chainId: number,
  context: EvmOnBlockContext,
): Promise<void> {
  context.log.info(`Processing ${name} block ${blockNumber} on chain ${chainId}`);

  const effectStartedAt = Date.now();
  context.log.info(
    `Calling getSnapshot effect for ${name} block ${blockNumber} on chain ${chainId}`,
  );
  const config = CHAIN_CONFIGS[chainId];
  if (!config) throw new Error(`Unsupported chain ${chainId} for ${name} block ${blockNumber}`);
  const trackedTokenBalances = await getTrackedTokenBalancesForSnapshot(
    context,
    config,
    BigInt(blockNumber),
  );
  const snapshot = (await context.effect(getSnapshot, {
    chainId,
    blockNumber: Number(blockNumber),
    trackedTokenBalances,
  })) as Snapshot;
  context.log.info(
    `Finished getSnapshot effect for ${name} block ${blockNumber} on chain ${chainId} in ${
      Date.now() - effectStartedAt
    }ms`,
    {
      tokenRecords: snapshot.tokenRecords.length,
      tokenSupplies: snapshot.tokenSupplies.length,
    },
  );

  context.log.info(
    `Queueing snapshot entities for ${name} block ${blockNumber} on chain ${chainId}`,
    {
      tokenRecords: snapshot.tokenRecords.length,
      tokenSupplies: snapshot.tokenSupplies.length,
    },
  );
  for (const record of snapshot.tokenRecords) {
    const entity: TokenRecord = {
      ...record,
      block: BigInt(record.block),
      timestamp: BigInt(record.timestamp),
      rate: new BigDecimal(record.rate),
      balance: new BigDecimal(record.balance),
      multiplier: new BigDecimal(record.multiplier),
      value: new BigDecimal(record.value),
      valueExcludingOhm: new BigDecimal(record.valueExcludingOhm),
    };
    context.TokenRecord.set(entity);
  }

  for (const supply of snapshot.tokenSupplies) {
    const entity: TokenSupply = {
      id: supply.id,
      block: BigInt(supply.block),
      date: supply.date,
      timestamp: BigInt(supply.timestamp),
      token: supply.token,
      tokenAddress: supply.tokenAddress,
      pool: supply.pool,
      poolAddress: supply.poolAddress,
      source: supply.source,
      sourceAddress: supply.sourceAddress,
      type: supply.type,
      balance: new BigDecimal(supply.balance),
      supplyBalance: new BigDecimal(supply.supplyBalance),
    };
    context.TokenSupply.set(entity);
  }
  context.log.info(
    `Finished queueing snapshot entities for ${name} block ${blockNumber} on chain ${chainId}; Envio will persist them when the batch commits`,
  );
}
