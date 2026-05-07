import type { Address, PublicClient } from "viem";

import { getErc20DecimalBalance, getNativeBalance } from "./contracts";
import { toDecimal, ZERO } from "./math";
import { getLiquidityBalance, getPrice, getTotalValue, getUnitPrice } from "./pricing";
import { createTokenRecord, getContractName, getWalletAddressesForContract } from "./records";
import type { ChainConfig, LiquidityHandler, Snapshot, TokenDefinition } from "./types";

export async function pushTokenBalanceRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  definition: TokenDefinition,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const wallets = getWalletAddressesForContract(config, definition.address);
  const rate = await getPrice(config, client, definition.address, blockNumber, null);
  if (rate.eq(ZERO)) return;

  for (const wallet of wallets) {
    const balance =
      definition.address === config.nativeToken
        ? toDecimal(await getNativeBalance(client, wallet as Address, blockNumber), 18)
        : await getErc20DecimalBalance(client, definition.address, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenRecords.push(
      createTokenRecord(
        config,
        timestamp,
        getContractName(config, definition.address),
        definition.address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }
}

export async function pushOwnedLiquidityRecords(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  handler: LiquidityHandler,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const totalValue = await getTotalValue(config, client, handler, [], blockNumber);
  if (!totalValue || totalValue.eq(ZERO)) return;
  const includedValue = await getTotalValue(
    config,
    client,
    handler,
    [config.ohmToken],
    blockNumber,
  );
  if (!includedValue) return;
  const multiplier = includedValue.div(totalValue);
  const unitRate = await getUnitPrice(config, client, handler, blockNumber);
  if (!unitRate) return;

  for (const wallet of config.protocolAddresses) {
    const balance = await getLiquidityBalance(config, client, handler, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenRecords.push(
      createTokenRecord(
        config,
        timestamp,
        getContractName(config, handler.id),
        handler.id,
        getContractName(config, wallet),
        wallet,
        unitRate,
        balance,
        blockNumber,
        multiplier,
        "Protocol-Owned Liquidity",
      ),
    );
  }
}
