import { TYPE_LENDING } from "../snapshot/global";
import { isActive, ZERO } from "../snapshot/math";
import { createTokenSupply, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenSupply } from "../snapshot/types";

// OHM the treasury minted into lending markets (Silo, Euler) to be borrowed.
// Legacy recognised the running deployed amount from a hand-maintained
// schedule, since deployments went through the multisig rather than a
// contract it could read. The OHM is out of circulation, so it leaves backed
// supply as a Lending row.
export function pushLendingDeploymentSupply(
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): void {
  for (const deployment of config.lendingDeployments ?? []) {
    if (!isActive(deployment, blockNumber)) continue;

    let deployed = ZERO;
    for (const entry of deployment.entries) {
      if (blockNumber >= BigInt(entry.block)) deployed = deployed.plus(entry.amount);
    }
    if (deployed.lte(ZERO)) continue;

    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        getContractName(config, deployment.source),
        deployment.source,
        TYPE_LENDING,
        deployed,
        blockNumber,
        -1,
      ),
    );
  }
}
