import type { PublicClient } from "viem";

import { OLYMPUS_LENDER_ABI } from "../abis/olympus-lender";
import { OLYMPUS_LENDER, SENTIMENT_LTOKEN, SILO_COLLATERAL } from "../chains/arbitrum";
import { safeRead } from "../contracts";
import { addr, toDecimal } from "../math";
import { createTokenSupply, getContractName } from "../records";
import { pushMarketSupply } from "../token-supplies";
import type { ChainConfig, Snapshot } from "../types";

export async function pushArbitrumLendingSupply(
  snapshot: Snapshot,
  config: ChainConfig,
  client: PublicClient,
  timestamp: bigint,
  blockNumber: bigint,
) {
  const count = await safeRead(
    client,
    OLYMPUS_LENDER,
    OLYMPUS_LENDER_ABI,
    "activeAMOCount",
    [],
    blockNumber,
  );
  if (count !== null) {
    for (let i = 0n; i < count; i++) {
      const amo = await safeRead(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "activeAMOs",
        [i],
        blockNumber,
      );
      if (!amo) continue;
      const deployed = await safeRead(
        client,
        OLYMPUS_LENDER,
        OLYMPUS_LENDER_ABI,
        "getDeployedOhm",
        [amo],
        blockNumber,
      );
      if (!deployed || deployed === 0n) continue;
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
    { name: getContractName(config, SILO_COLLATERAL), address: SILO_COLLATERAL },
    { name: getContractName(config, SENTIMENT_LTOKEN), address: SENTIMENT_LTOKEN },
  ]) {
    await pushMarketSupply(snapshot, config, client, timestamp, blockNumber, market);
  }
}
