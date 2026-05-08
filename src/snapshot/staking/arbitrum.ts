import type BigNumber from "bignumber.js";
import type { Address, PublicClient } from "viem";

import { JONES_STAKING_ABI } from "../abis/jones-staking";
import { TREASURE_MINING_ABI } from "../abis/treasure-mining";
import {
  ARBITRUM_START_BLOCK,
  ERC20_JONES,
  ERC20_MAGIC,
  JONES_STAKING,
  TREASURE_ATLAS_MINE,
} from "../chains/arbitrum";
import { getDecimals, readContract } from "../contracts";
import { isActive, same, toDecimal, ZERO } from "../math";
import { getPrice } from "../pricing";
import { createTokenRecord, getContractName } from "../records";
import type { ChainConfig, Snapshot, TokenDefinition } from "../types";

const JONES_STAKING_POOL_IDS = [0n];
const JONES_WRITE_OFF_BLOCK = 130_482_707n;

function getContractNameWithSuffix(
  config: ChainConfig,
  contractAddress: string,
  suffix: string,
  abbreviation?: string,
) {
  const lower = contractAddress.toLowerCase();
  const name = config.names[lower] ?? lower;
  const ticker = abbreviation ?? config.abbreviations[lower];
  return `${name} - ${suffix}${ticker ? ` (${ticker})` : ""}`;
}

export async function pushArbitrumStakingRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  definition: TokenDefinition,
  timestamp: bigint,
  blockNumber: bigint,
) {
  if (!isActive({ startBlock: ARBITRUM_START_BLOCK }, blockNumber)) return;

  if (same(definition.address, ERC20_JONES)) {
    await pushJonesStakingRecords(snapshot, config, client, definition, timestamp, blockNumber);
  }

  if (same(definition.address, ERC20_MAGIC)) {
    await pushTreasureStakingRecords(snapshot, config, client, definition, timestamp, blockNumber);
  }
}

async function pushJonesStakingRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  definition: TokenDefinition,
  timestamp: bigint,
  blockNumber: bigint,
) {
  let rate: BigNumber | null = null;
  const decimals = await getDecimals(client, definition.address, blockNumber);

  for (const wallet of config.protocolAddresses) {
    for (const poolId of JONES_STAKING_POOL_IDS) {
      const poolInfo = await readContract(
        client,
        JONES_STAKING,
        JONES_STAKING_ABI,
        "poolInfo",
        [poolId],
        blockNumber,
      );
      if (!same(poolInfo[0], definition.address)) continue;

      const deposited = await readContract(
        client,
        JONES_STAKING,
        JONES_STAKING_ABI,
        "deposited",
        [poolId, wallet as Address],
        blockNumber,
      );
      const balance = toDecimal(deposited, decimals);
      if (balance.eq(ZERO)) continue;

      rate ??= await getPrice(config, client, definition.address, blockNumber, null);
      if (rate.eq(ZERO)) continue;

      const record = createTokenRecord(
        config,
        timestamp,
        getContractNameWithSuffix(config, definition.address, "Staked"),
        definition.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      );
      if (blockNumber >= JONES_WRITE_OFF_BLOCK) {
        record.multiplier = "0";
        record.valueExcludingOhm = "0";
      }
      snapshot.tokenRecords.push(record);
    }
  }
}

async function pushTreasureStakingRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  definition: TokenDefinition,
  timestamp: bigint,
  blockNumber: bigint,
) {
  let rate: BigNumber | null = null;

  for (const wallet of config.protocolAddresses) {
    const depositIds = await readContract(
      client,
      TREASURE_ATLAS_MINE,
      TREASURE_MINING_ABI,
      "getAllUserDepositIds",
      [wallet as Address],
      blockNumber,
    );

    for (const depositId of depositIds) {
      const userInfo = await readContract(
        client,
        TREASURE_ATLAS_MINE,
        TREASURE_MINING_ABI,
        "userInfo",
        [wallet as Address, depositId],
        blockNumber,
      );
      const balance = toDecimal(userInfo[1], 18);
      if (balance.eq(ZERO)) continue;

      rate ??= await getPrice(config, client, definition.address, blockNumber, null);
      if (rate.eq(ZERO)) continue;

      const record = createTokenRecord(
        config,
        timestamp,
        getContractNameWithSuffix(config, definition.address, "Staked", "veMAGIC"),
        definition.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      );
      record.isLiquid = false;
      snapshot.tokenRecords.push(record);
    }
  }
}
