import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { readPositionAmount } from "../effects";
import { getPrice } from "../pricing";
import { getTokenDecimals, isActive, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, getContractName } from "../snapshot/records";
import type { ChainConfig, PositionReadMethod, SerializedTokenRecord } from "../snapshot/types";

// Treasury positions that live inside another protocol's contract rather
// than as a wallet ERC20 balance: Liquity stability pool deposits and gains,
// LQTY / TOKE / auraBAL staking, Convex reward pools, vote-lock unlockables,
// Aura rewards, Rari allocations, and fixed-principal lending markets.
// Ported from legacy TokenStablecoins / TokenVolatile helpers; each record
// keeps the legacy token label so parity diffs line up.
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
  const rateOf = async (token: string) => {
    const cached = rates.get(token);
    if (cached) return cached;
    const rate = (await getPrice(config, context, client, token, blockNumber, null)).price;
    rates.set(token, rate);
    return rate;
  };

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

  const push = async (args: {
    label: string;
    token: string;
    source: string;
    amount: BigNumber;
    nonOhmMultiplier?: BigNumber;
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
        args.nonOhmMultiplier,
      ),
    );
  };

  for (const position of positions) {
    if (!isActive(position, blockNumber)) continue;

    if (position.kind === "read") {
      const decimals = getTokenDecimals(config.tokens, position.token);
      const writtenOff =
        position.writeOffFromBlock !== undefined &&
        blockNumber >= BigInt(position.writeOffFromBlock);
      for (const wallet of position.wallets) {
        const raw = await read(position.contract, position.method, wallet);
        await push({
          label: position.label,
          token: position.token,
          source: wallet,
          amount: toDecimal(raw, decimals),
          nonOhmMultiplier: writtenOff ? ZERO : undefined,
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
