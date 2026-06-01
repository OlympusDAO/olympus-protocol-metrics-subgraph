import BigNumberCtor from "bignumber.js";
import type { EvmOnBlockContext } from "envio";

import { TYPE_OFFSET } from "../snapshot/global";
import { addr, toDecimal, ZERO } from "../snapshot/math";
import { createTokenSupply, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenSupply } from "../snapshot/types";

const SOHM_INDEX_DECIMALS = 9;

// OHM V1 → V2 migration offset (Ethereum). The migration contract held a
// fixed sOHM amount when V1 was retired; on each rebase that staked
// position grows. We deduct it from circulating supply by emitting a
// Liquidity-style negative supply row with the rebase-adjusted OHM amount:
//   offsetAmount = offsetOhm × currentIndex / 1e9
// The window has a hard endBlock — past that point the migration is
// closed and the offset becomes irrelevant.
export async function pushMigrationOffsetSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const offset = config.migrationOffset;
  if (!offset) return;
  if (blockNumber < BigInt(offset.startBlock)) return;
  if (blockNumber >= BigInt(offset.endBlock)) return;

  const indexState = await context.OhmIndexState.get(
    `${config.chainId}-${addr(offset.sOhmAddress)}`,
  );
  if (!indexState || indexState.index === 0n) return;

  const index = toDecimal(indexState.index, SOHM_INDEX_DECIMALS);
  const offsetOhm = new BigNumberCtor(offset.offsetOhm);
  const offsetAmount = offsetOhm.times(index);
  if (offsetAmount.eq(ZERO)) return;

  supplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      getContractName(config, offset.migrationContract),
      offset.migrationContract,
      TYPE_OFFSET,
      offsetAmount,
      blockNumber,
      -1,
    ),
  );
}
