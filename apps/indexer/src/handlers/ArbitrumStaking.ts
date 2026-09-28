import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";

import { getPrice } from "../pricing";
import { addr, isActive, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, getContractName } from "../snapshot/records";
import { getClient } from "../snapshot/rpc-client";
import type { ChainConfig, SerializedTokenRecord } from "../snapshot/types";

// Treasure staking records pull from HyperSync-indexed TreasureDeposit
// entities rather than RPC reads. The perpetual-hold JONES allocation is not
// a treasury asset or backing, so JonesStakingPosition emits no TokenRecord.
// MAGIC veMAGIC remains illiquid (record.isLiquid = false) per legacy semantics.
const TREASURE_STAKED_LP_DECIMALS = 18;
const MAGIC_TOKEN_ADDRESS = "0x539bde0d7dbd336b79148aa742883198bbf60342";

/**
 * Append eligible Arbitrum staking records to the caller's snapshot collection.
 * Only Treasure deposits are valued: the perpetual-hold JONES allocation is
 * excluded across indexed history, without reading its staking entity or price.
 * The snapshot timestamp is in Unix seconds and blockNumber pins valuation.
 */
export async function pushArbitrumStakingRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  await pushTreasureStakingRecords(context, config, records, timestamp, blockNumber);
}

/**
 * Value nonzero, chain-matched Treasure deposits for configured protocol wallets.
 * Convert raw 18-decimal deposit amounts to token units and fetch the MAGIC
 * price at blockNumber once per call. Append explicitly non-liquid records;
 * inactive tokens, empty deposits and a zero price produce no record.
 */
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
