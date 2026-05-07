import {
  ArbitrumFraxUsdTriggerNew,
  ArbitrumFraxUsdTriggerOld,
  BerachainSnapshotAnchor,
  BigDecimal,
  onBlock,
  type ArbitrumFraxUsdTriggerNew_NewRound_handlerArgs,
  type ArbitrumFraxUsdTriggerOld_NewRound_handlerArgs,
  type handlerContext,
  type TokenRecord,
  type TokenSupply,
} from "generated";
import { getSnapshot, type Snapshot } from "./snapshot";

BerachainSnapshotAnchor.Transfer.handler(async () => {});

const ARBITRUM_TRIGGER_SWITCH_BLOCK = 451191255;

ArbitrumFraxUsdTriggerOld.NewRound.handler(
  async ({ event, context }: ArbitrumFraxUsdTriggerOld_NewRound_handlerArgs) => {
    if (event.block.number >= ARBITRUM_TRIGGER_SWITCH_BLOCK) return;
    await processSnapshot("ArbitrumFraxUsdTriggerOld", event.block.number, event.chainId, context);
  },
);

ArbitrumFraxUsdTriggerNew.NewRound.handler(
  async ({ event, context }: ArbitrumFraxUsdTriggerNew_NewRound_handlerArgs) => {
    if (event.block.number < ARBITRUM_TRIGGER_SWITCH_BLOCK) return;
    await processSnapshot("ArbitrumFraxUsdTriggerNew", event.block.number, event.chainId, context);
  },
);

const BLOCK_HANDLERS = [
  {
    name: "BerachainEightHourSnapshot",
    chain: 80094 as const,
    startBlock: 799194,
    interval: 14917,
  },
];

BLOCK_HANDLERS.forEach(({ name, chain, startBlock, interval }) => {
  onBlock(
    {
      name,
      chain,
      startBlock,
      interval,
    },
    async ({ block, context }) => {
      await processSnapshot(name, block.number, block.chainId, context);
    },
  );
});

async function processSnapshot(
  name: string,
  blockNumber: number,
  chainId: number,
  context: handlerContext,
): Promise<void> {
  if (context.isPreload) return;

  context.log.info(`Processing ${name} block ${blockNumber} on chain ${chainId}`);

  const snapshot = (await context.effect(getSnapshot, {
    chainId,
    blockNumber: Number(blockNumber),
  })) as Snapshot;

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
      recordType: supply.recordType,
      balance: new BigDecimal(supply.balance),
      supplyBalance: new BigDecimal(supply.supplyBalance),
    };
    context.TokenSupply.set(entity);
  }
}
