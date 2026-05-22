import type { EvmOnBlockContext } from "envio";

import { snapshotBlvRegistry } from "../effects";
import { TYPE_BLV } from "../snapshot/global";
import { toDecimal, ZERO } from "../snapshot/math";
import { createTokenSupply, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenSupply } from "../snapshot/types";

const BLV_OHM_DECIMALS = 9;

// Boosted Liquidity Vault supplies (Ethereum). Each registered BLV holds an
// OHM "shares" balance representing protocol OHM locked in the vault's
// liquidity position. The snapshotBlvRegistry effect walks the registry
// and returns (vault address, ohm-shares) pairs at the snapshot block.
export async function pushBlvSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const registry = config.blvRegistry;
  if (!registry) return;
  if (blockNumber < BigInt(registry.startBlock)) return;

  const snapshot = (await context.effect(snapshotBlvRegistry, {
    chainId: config.chainId,
    registry: registry.address,
    atBlock: Number(blockNumber),
  })) as { vaults: string[]; ohmShares: string[] };

  for (let i = 0; i < snapshot.vaults.length; i++) {
    const raw = snapshot.ohmShares[i];
    if (!raw || raw === "0") continue;
    const balance = toDecimal(BigInt(raw), BLV_OHM_DECIMALS);
    if (balance.eq(ZERO)) continue;
    const vault = snapshot.vaults[i];
    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        getContractName(config, config.ohmToken),
        config.ohmToken,
        undefined,
        undefined,
        vault,
        vault,
        TYPE_BLV,
        balance,
        blockNumber,
        -1,
      ),
    );
  }
}
