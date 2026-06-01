import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { readCoolerPrincipalReceivables, readMonoCoolerTotalDebt } from "../effects";
import { getPrice } from "../pricing";
import { getTokenDecimals, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenRecord } from "../snapshot/types";

// Cooler Loans receivables (Ethereum). Each configured clearinghouse exposes
// either `principalReceivables()` (V1 / V1.1 / V2) or `totalDebt()`
// (MonoCooler). Both return the receivable principal in the clearinghouse's
// `receivableToken` units; we price it via the same chain's pricing pipeline
// (priceToken overrides where the receivable isn't directly priced — e.g.
// MonoCooler holds USDS debt but legacy prices it via the DAI feed).
export async function pushCoolerReceivables(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const clearinghouses = config.coolerClearinghouses ?? [];
  if (clearinghouses.length === 0) return;

  for (const clearinghouse of clearinghouses) {
    if (clearinghouse.startBlock && blockNumber < BigInt(clearinghouse.startBlock)) continue;

    const raw =
      clearinghouse.kind === "monocooler"
        ? ((await context.effect(readMonoCoolerTotalDebt, {
            chainId: config.chainId,
            monoCooler: clearinghouse.address,
            atBlock: Number(blockNumber),
          })) as string)
        : ((await context.effect(readCoolerPrincipalReceivables, {
            chainId: config.chainId,
            clearinghouse: clearinghouse.address,
            atBlock: Number(blockNumber),
          })) as string);
    if (raw === "") continue;

    // Receivable decimals come from the chain's token definition for the
    // receivableToken (DAI/USDS/USDC on Ethereum, all 18-decimal today;
    // looking it up rather than hard-coding 18 makes future tokens with
    // different decimals — e.g. a USDC-denominated clearinghouse on a
    // chain that uses 6-decimal USDC — work without a code change).
    const receivableDecimals = getTokenDecimals(config.tokens, clearinghouse.receivableToken);
    const receivable = toDecimal(BigInt(raw), receivableDecimals);
    if (receivable.eq(ZERO)) continue;

    const priceLookupToken = clearinghouse.priceToken ?? clearinghouse.receivableToken;
    const rate = (await getPrice(config, context, client, priceLookupToken, blockNumber, null))
      .price;
    if (rate.eq(ZERO)) continue;

    const receivableTokenLabel = `${getContractName(config, clearinghouse.receivableToken)} - Borrowed Through ${clearinghouse.name}`;
    records.push(
      createTokenRecord(
        config,
        timestamp,
        receivableTokenLabel,
        clearinghouse.receivableToken,
        clearinghouse.name,
        clearinghouse.address,
        rate,
        receivable,
        blockNumber,
      ),
    );
  }
}
