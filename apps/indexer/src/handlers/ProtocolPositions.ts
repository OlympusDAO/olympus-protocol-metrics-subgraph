import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { readPositionAmount } from "../effects";
import { getPrice } from "../pricing";
import { getTokenDecimals, isActive, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, getContractName } from "../snapshot/records";
import type { ChainConfig, PositionReadMethod, SerializedTokenRecord } from "../snapshot/types";

/**
 * Append active external-protocol positions to the supplied snapshot records.
 * Read balances and prices at blockNumber, normalize raw amounts by token
 * decimals, and retain legacy labels. Read positions are omitted at and after
 * writeOffFromBlock before balance or price effects, rather than emitted with
 * a zero backing multiplier. Rari allocations and fixed principal retain their
 * configured historical semantics. timestamp is the snapshot's Unix seconds.
 */
export async function pushProtocolPositionRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const positions = config.protocolPositions ?? [];
  if (positions.length === 0) return;

  const rates = new Map<string, BigNumber>();
  /** Cache each token's block-pinned USD price for this snapshot invocation. */
  const rateOf = async (token: string) => {
    const cached = rates.get(token);
    if (cached) return cached;
    const rate = (await getPrice(config, context, client, token, blockNumber, null)).price;
    rates.set(token, rate);
    return rate;
  };

  /** Read a raw position amount at the snapshot block; an empty result is zero. */
  const read = async (contract: string, method: PositionReadMethod, arg: string) => {
    const raw = (await context.effect(readPositionAmount, {
      chainId: config.chainId,
      contract,
      method,
      arg,
      atBlock: Number(blockNumber),
    })) as string;
    return raw === "" ? 0n : BigInt(raw);
  };

  /** Append a valued record for a nonzero normalized amount and nonzero price. */
  const push = async (args: {
    label: string;
    token: string;
    source: string;
    amount: BigNumber;
  }) => {
    if (args.amount.eq(ZERO)) return;
    const rate = await rateOf(args.token);
    if (rate.eq(ZERO)) return;
    records.push(
      createTokenRecord(
        config,
        timestamp,
        args.label,
        args.token,
        getContractName(config, args.source),
        args.source,
        rate,
        args.amount,
        blockNumber,
      ),
    );
  };

  for (const position of positions) {
    if (!isActive(position, blockNumber)) continue;

    if (position.kind === "read") {
      const decimals = getTokenDecimals(config.tokens, position.token);
      if (
        position.writeOffFromBlock !== undefined &&
        blockNumber >= BigInt(position.writeOffFromBlock)
      )
        continue;
      for (const wallet of position.wallets) {
        const raw = await read(position.contract, position.method, wallet);
        await push({
          label: position.label,
          token: position.token,
          source: wallet,
          amount: toDecimal(raw, decimals),
        });
      }
      continue;
    }

    if (position.kind === "rari") {
      // Unknown ids fall through to a default allocation on-chain, so only
      // read ids the allocator actually lists.
      for (const allocation of position.allocations) {
        const id = allocation.id.toString();
        if ((await read(position.allocator, "rari.hasId", id)) === 0n) continue;
        const raw = await read(position.allocator, "rari.amountAllocated", id);
        await push({
          label: allocation.label,
          token: allocation.token,
          source: position.allocator,
          amount: toDecimal(raw, getTokenDecimals(config.tokens, allocation.token)),
        });
      }
      continue;
    }

    // Fixed principal: legacy recognised the deployed amount until repaid or
    // written off, irrespective of the market contract's live balance.
    let principal = ZERO;
    for (const entry of position.entries) {
      if (blockNumber >= BigInt(entry.block)) principal = principal.plus(entry.amount);
    }
    await push({
      label: position.label,
      token: position.token,
      source: position.source,
      amount: principal.gt(ZERO) ? principal : ZERO,
    });
  }
}
