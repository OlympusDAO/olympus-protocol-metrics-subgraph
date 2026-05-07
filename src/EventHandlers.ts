import {
  ArbitrumSnapshotAnchor,
  BerachainSnapshotAnchor,
  BigDecimal,
  onBlock,
  type TokenRecord,
  type TokenSupply,
} from "generated";
import { getSnapshot, type Snapshot } from "./snapshot";

ArbitrumSnapshotAnchor.Transfer.handler(async () => {});
BerachainSnapshotAnchor.Transfer.handler(async () => {});

const BLOCK_HANDLERS = [
  {
    name: "ArbitrumEightHourSnapshot",
    chain: 42161 as const,
    startBlock: 450845846,
    interval: 115042,
  },
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
      context.log.info(`Processing ${name} block ${block.number} on chain ${block.chainId}`);

      const snapshot = (await context.effect(getSnapshot, {
        chainId: block.chainId,
        blockNumber: Number(block.number),
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
    },
  );
});
