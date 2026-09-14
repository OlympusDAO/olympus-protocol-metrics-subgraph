import type { EvmOnBlockContext } from "envio";

import { readPositionAmount, snapshotBlvRegistry } from "../effects";
import { TYPE_BLV } from "../snapshot/global";
import { getTokenDecimals, toDecimal, ZERO } from "../snapshot/math";
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

// Olympus IncurDebt (Ethereum). OHM lent against gOHM collateral is counted
// like OHM minted into a BLV. Legacy started counting at 17,620,000 so earlier
// history stayed unchanged; debt was fully repaid at block 17,985,101.
export async function pushIncurDebtSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const incurDebt = config.incurDebt;
  if (!incurDebt || blockNumber < BigInt(incurDebt.startBlock)) return;

  const raw = (await context.effect(readPositionAmount, {
    chainId: config.chainId,
    contract: incurDebt.address,
    method: "incurDebt.totalOutstanding",
    arg: "",
    atBlock: Number(blockNumber),
  })) as string;
  if (raw === "" || raw === "0") return;

  supplies.push(
    createTokenSupply(
      config,
      timestamp,
      getContractName(config, config.ohmToken),
      config.ohmToken,
      undefined,
      undefined,
      getContractName(config, incurDebt.address),
      incurDebt.address,
      TYPE_BLV,
      toDecimal(BigInt(raw), getTokenDecimals(config.tokens, config.ohmToken)),
      blockNumber,
      -1,
    ),
  );
}
