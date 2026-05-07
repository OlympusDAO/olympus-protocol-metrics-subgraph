import { createEffect, S } from "envio";

import { CHAIN_CONFIGS } from "./chains";
import { getClient } from "./contracts";
import { pushArbitrumLendingSupply } from "./lending/arbitrum";
import { pushOwnedLiquidityRecords, pushTokenBalanceRecords } from "./token-records";
import { pushOwnedLiquiditySupply, pushTotalSupply, pushTreasuryOhm } from "./token-supplies";
import type { ChainConfig, Snapshot } from "./types";

export type { Snapshot } from "./types";

export const getSnapshot = createEffect(
  {
    name: "getSnapshot",
    input: { chainId: S.number, blockNumber: S.number },
    output: S.unknown,
    rateLimit: false,
    cache: false,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    return generateSnapshot(config, BigInt(input.blockNumber));
  },
);

async function generateSnapshot(config: ChainConfig, blockNumber: bigint): Promise<Snapshot> {
  const client = getClient(config);
  const block = await client.getBlock({ blockNumber });
  const timestamp = block.timestamp;
  const snapshot: Snapshot = { tokenRecords: [], tokenSupplies: [] };

  for (const category of ["Stable", "Volatile"]) {
    for (const definition of config.tokens.filter((value) => value.category === category)) {
      await pushTokenBalanceRecords(snapshot, config, client, definition, timestamp, blockNumber);
    }
  }

  for (const handler of config.ownedLiquidityHandlers) {
    await pushOwnedLiquidityRecords(snapshot, config, client, handler, timestamp, blockNumber);
  }

  await pushTotalSupply(snapshot, config, client, timestamp, blockNumber);
  await pushTreasuryOhm(snapshot, config, client, timestamp, blockNumber);
  await pushOwnedLiquiditySupply(snapshot, config, client, timestamp, blockNumber);

  if (config.chainId === 42161) {
    await pushArbitrumLendingSupply(snapshot, config, client, timestamp, blockNumber);
  }

  return snapshot;
}
