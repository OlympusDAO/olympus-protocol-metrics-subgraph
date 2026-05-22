import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";

import { getPrice } from "../pricing";
import { addr, isActive, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, getContractName } from "../snapshot/records";
import { getClient } from "../snapshot/rpc-client";
import type { ChainConfig, SerializedTokenRecord } from "../snapshot/types";

// Arbitrum staking records (Jones + Treasure). Both pull from
// HyperSync-indexed entities (JonesStakingPosition / TreasureDeposit) rather
// than RPC reads. JONES staked positions were written off at the
// post-bankruptcy block; MAGIC veMAGIC is marked illiquid (record.isLiquid
// = false) per legacy semantics.
const JONES_STAKED_POOL_ID = 0n;
const JONES_WRITE_OFF_BLOCK = 130_482_707n;
const TREASURE_STAKED_LP_DECIMALS = 18;
const JONES_TOKEN_ADDRESS = "0x10393c20975cf177a3513071bc110f7962cd67da";
const MAGIC_TOKEN_ADDRESS = "0x539bde0d7dbd336b79148aa742883198bbf60342";

export async function pushArbitrumStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  await pushJonesStakingRecords(context, config, records, timestamp, blockNumber);
  await pushTreasureStakingRecords(context, config, records, timestamp, blockNumber);
}

async function pushJonesStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const jonesToken = config.tokens.find((token) => token.address === addr(JONES_TOKEN_ADDRESS));
  if (!jonesToken || !isActive(jonesToken, blockNumber)) return;

  const client = getClient(config);
  let rate: BigNumber | null = null;
  for (const wallet of config.protocolAddresses) {
    const id = `${config.chainId}-${JONES_STAKED_POOL_ID.toString()}-${addr(wallet)}`;
    const entity = await context.JonesStakingPosition.get(id);
    if (!entity || entity.amount === 0n) continue;

    rate ??= (await getPrice(config, context, client, jonesToken.address, blockNumber, null)).price;
    if (rate.eq(ZERO)) continue;

    const balance = toDecimal(entity.amount, 18); // JONES is 18 decimals
    const record = createTokenRecord(
      config,
      timestamp,
      `${getContractName(config, jonesToken.address)} - Staked`,
      jonesToken.address,
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
    records.push(record);
  }
}

async function pushTreasureStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const magicToken = config.tokens.find((token) => token.address === addr(MAGIC_TOKEN_ADDRESS));
  if (!magicToken || !isActive(magicToken, blockNumber)) return;

  const client = getClient(config);
  let rate: BigNumber | null = null;
  for (const wallet of config.protocolAddresses) {
    const deposits = await context.TreasureDeposit.getWhere({
      walletAddress: { _eq: addr(wallet) },
    });
    for (const deposit of deposits) {
      if (deposit.chainId !== config.chainId) continue;
      if (deposit.amount === 0n) continue;

      rate ??= (await getPrice(config, context, client, magicToken.address, blockNumber, null))
        .price;
      if (rate.eq(ZERO)) break;

      const balance = toDecimal(deposit.amount, TREASURE_STAKED_LP_DECIMALS);
      const record = createTokenRecord(
        config,
        timestamp,
        `${getContractName(config, magicToken.address)} - Staked (veMAGIC)`,
        magicToken.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      );
      record.isLiquid = false;
      records.push(record);
    }
  }
}
