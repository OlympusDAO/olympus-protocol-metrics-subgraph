import type { EvmOnBlockContext } from "envio";

import { OLYMPUS_LENDER, SENTIMENT_LTOKEN, SILO_COLLATERAL } from "../snapshot/chains/arbitrum";
import { TYPE_LENDING } from "../snapshot/global";
import { addr, toDecimal, ZERO } from "../snapshot/math";
import {
  createTokenSupply,
  getContractName,
  getWalletAddressesForContract,
} from "../snapshot/records";
import type { ChainConfig, SerializedTokenSupply } from "../snapshot/types";
import { readTokenBalance } from "./SnapshotHelpers";

const SENTIMENT_LTOKEN_START_BLOCK = 100875583n;
const SILO_COLLATERAL_START_BLOCK = 99067079n;
const ARBITRUM_DYNAMIC_LENDING_START_BLOCK = 130482707n;
const LENDING_OHM_DECIMALS = 9;

// Arbitrum lending supply attribution. Two distinct paths:
//
// 1. OlympusLender / AMO (post-block 130482707): mint events update the
//    LenderAmo.deployedOhm entity via Erc20Transfers.ts. We just read the
//    entity here.
// 2. Silo + Sentiment markets (pre-dynamic, hardcoded): read the OHM
//    TokenBalance entity for the configured market addresses and attribute
//    it to each wallet that holds the market token.
export async function pushArbitrumLendingSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  if (blockNumber >= ARBITRUM_DYNAMIC_LENDING_START_BLOCK) {
    // deployedOhm is now maintained by Erc20Transfers.ts from OHM mints/burns
    // involving each AMO. Just read the entity and emit supply records.
    const activeAmos = await context.LenderAmo.getWhere({ active: { _eq: true } });
    for (const amo of activeAmos) {
      if (amo.chainId !== config.chainId) continue;
      if (amo.deployedOhm === 0n) continue;
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          undefined,
          undefined,
          `${getContractName(config, OLYMPUS_LENDER)} - ${addr(amo.amoAddress)}`,
          addr(amo.amoAddress),
          TYPE_LENDING,
          toDecimal(amo.deployedOhm, LENDING_OHM_DECIMALS),
          blockNumber,
          -1,
        ),
      );
    }
  }

  for (const market of [
    {
      name: getContractName(config, SILO_COLLATERAL),
      address: SILO_COLLATERAL,
      startBlock: SILO_COLLATERAL_START_BLOCK,
      decimals: LENDING_OHM_DECIMALS,
    },
    {
      name: getContractName(config, SENTIMENT_LTOKEN),
      address: SENTIMENT_LTOKEN,
      startBlock: SENTIMENT_LTOKEN_START_BLOCK,
      decimals: LENDING_OHM_DECIMALS,
    },
  ]) {
    if (blockNumber < market.startBlock) continue;
    const wallets = getWalletAddressesForContract(config, market.address);
    for (const wallet of wallets) {
      const balance = await readTokenBalance(
        context,
        config.chainId,
        market.address,
        wallet,
        market.decimals,
      );
      if (balance.eq(ZERO)) continue;
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          market.name,
          market.address,
          getContractName(config, wallet),
          wallet,
          TYPE_LENDING,
          balance,
          blockNumber,
          -1,
        ),
      );
    }
  }
}
