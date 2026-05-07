import type { PublicClient } from "viem";

import { getErc20DecimalBalance, getErc20TotalSupply } from "./contracts";
import { matches, ZERO } from "./math";
import { getUnderlyingTokenBalance } from "./pricing";
import { createTokenSupply, getContractName, getWalletAddressesForContract } from "./records";
import type { ChainConfig, Snapshot } from "./types";

export async function pushTotalSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const balance = await getErc20TotalSupply(client, config.ohmToken, blockNumber);
  snapshot.tokenSupplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      undefined,
      undefined,
      "Total Supply",
      balance,
      blockNumber,
    ),
  );
}

export async function pushTreasuryOhm(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  for (const wallet of config.circulatingSupplyWallets) {
    const balance = await getErc20DecimalBalance(client, config.ohmToken, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenSupplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        getContractName(config, wallet),
        wallet,
        "Treasury",
        balance,
        blockNumber,
        -1,
      ),
    );
  }
}

export async function pushOwnedLiquiditySupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  for (const handler of config.ownedLiquidityHandlers) {
    if (!matches(handler, config.ohmToken)) continue;
    for (const wallet of config.circulatingSupplyWallets) {
      const balance = await getUnderlyingTokenBalance(
        config,
        client,
        handler,
        wallet,
        config.ohmToken,
        blockNumber,
      );
      if (balance.eq(ZERO)) continue;
      snapshot.tokenSupplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          getContractName(config, handler.id),
          handler.id,
          getContractName(config, wallet),
          wallet,
          "Liquidity",
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}

export async function pushMarketSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
  market: { name: string; address: string },
) {
  for (const wallet of getWalletAddressesForContract(config, market.address)) {
    const balance = await getErc20DecimalBalance(client, market.address, wallet, blockNumber);
    if (balance.eq(ZERO)) continue;
    snapshot.tokenSupplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        market.name,
        market.address,
        getContractName(config, wallet),
        wallet,
        "Lending",
        balance,
        blockNumber,
        -1,
      ),
    );
  }
}
