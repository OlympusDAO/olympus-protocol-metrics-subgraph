import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { readMakerDsrBalance } from "../effects";
import { getPrice } from "../pricing";
import { getTokenDecimals, toDecimal, ZERO } from "../snapshot/math";
import {
  createTokenRecord,
  getContractName,
  getWalletAddressesForContract,
} from "../snapshot/records";
import type { ChainConfig, SerializedTokenRecord } from "../snapshot/types";

// Maker DSR deposits (Ethereum). DAI deposited into the DSR leaves the ERC20
// ledger entirely — it becomes normalized shares in the Pot (`pie(wallet)`)
// that accrue via `chi()` — so neither Transfer tracking nor `balanceOf` sees
// it. Mirrors legacy `getMakerDSRRecords`: every wallet that can hold DAI is
// checked, and any DSR balance is emitted as a "DAI - Deposited in DSR" record
// that inherits DAI's category and liquidity.
export async function pushMakerDsrRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const dsr = config.makerDsr;
  if (!dsr || blockNumber < BigInt(dsr.startBlock)) return;

  const decimals = getTokenDecimals(config.tokens, dsr.depositToken);
  const tokenLabel = `${getContractName(config, dsr.depositToken)} - Deposited in DSR`;
  let rate = ZERO;

  for (const wallet of getWalletAddressesForContract(config, dsr.depositToken)) {
    const raw = (await context.effect(readMakerDsrBalance, {
      chainId: config.chainId,
      pot: dsr.pot,
      wallet,
      atBlock: Number(blockNumber),
    })) as string;
    if (raw === "") continue;

    const balance = toDecimal(BigInt(raw), decimals);
    if (balance.eq(ZERO)) continue;

    // Price lazily: most snapshots have no DSR balance at all.
    if (rate.eq(ZERO)) {
      rate = (await getPrice(config, context, client, dsr.depositToken, blockNumber, null)).price;
      if (rate.eq(ZERO)) return;
    }

    records.push(
      createTokenRecord(
        config,
        timestamp,
        tokenLabel,
        dsr.depositToken,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }
}
