import type { PublicClient } from "viem";

import { OLYMPUS_LENDER_ABI } from "../abis/olympus-lender";
import { OLYMPUS_LENDER, SENTIMENT_LTOKEN, SILO_COLLATERAL } from "../chains/arbitrum";
import { readContract } from "../contracts";
import { addr, toDecimal } from "../math";
import { createTokenSupply, getContractName } from "../records";
import { pushMarketSupply } from "../token-supplies";
import type { ChainConfig, Snapshot } from "../types";

const ARBITRUM_DYNAMIC_LENDING_START_BLOCK = 130482707n;
const SILO_COLLATERAL_START_BLOCK = 99067079n;
const SENTIMENT_LTOKEN_START_BLOCK = 100875583n;

export async function pushArbitrumLendingSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  if (blockNumber >= ARBITRUM_DYNAMIC_LENDING_START_BLOCK) {
    const count = await readContract(
      client,
      OLYMPUS_LENDER,
      OLYMPUS_LENDER_ABI,
      "activeAMOCount",
      [],
      blockNumber,
    );
    for (let i = 0n; i < count; i++) {
      const amo = await readContract(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "activeAMOs",
        [i],
        blockNumber,
      );
      const deployed = await readContract(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "getDeployedOhm",
        [amo],
        blockNumber,
      );
      if (deployed === 0n) continue;
      snapshot.tokenSupplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          undefined,
          undefined,
          `${getContractName(config, OLYMPUS_LENDER)} - ${addr(amo)}`,
          addr(amo),
          "Lending",
          toDecimal(deployed, 9),
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
    },
    {
      name: getContractName(config, SENTIMENT_LTOKEN),
      address: SENTIMENT_LTOKEN,
      startBlock: SENTIMENT_LTOKEN_START_BLOCK,
    },
  ]) {
    if (blockNumber < market.startBlock) continue;
    await pushMarketSupply(snapshot, config, client, timestamp, blockNumber, market);
  }
}
