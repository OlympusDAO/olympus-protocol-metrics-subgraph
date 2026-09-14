import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext } from "envio";
import type { PublicClient } from "viem";

import { readPositionAmount } from "../effects";
import { getTokenQuantityPerLp, getTotalValue, getUnitPrice } from "../pricing";
import { TYPE_LIQUIDITY } from "../snapshot/global";
import { isActive, toDecimal, ZERO } from "../snapshot/math";
import { createTokenRecord, createTokenSupply, getContractName } from "../snapshot/records";
import type {
  ChainConfig,
  LiquidityPosition,
  LiquidityPositionSource,
  SerializedTokenRecord,
  SerializedTokenSupply,
} from "../snapshot/types";
import { readTokenBalance } from "./SnapshotHelpers";

// LP tokens across Balancer, Uniswap V2, Curve and FraxSwap are 18 decimals.
const LP_DECIMALS = 18;

type Holding = { source: LiquidityPositionSource; wallet: string; amount: BigNumber };

async function readHoldings(
  context: EvmOnBlockContext,
  config: ChainConfig,
  position: LiquidityPosition,
  blockNumber: bigint,
): Promise<Holding[]> {
  const holdings: Holding[] = [];
  for (const source of position.sources) {
    for (const wallet of source.wallets) {
      const amount =
        source.kind === "wallet"
          ? await readTokenBalance(context, config.chainId, position.lpToken, wallet, LP_DECIMALS)
          : await readStaked(context, config, source, wallet, blockNumber);
      if (!amount.eq(ZERO)) holdings.push({ source, wallet, amount });
    }
  }
  return holdings;
}

async function readStaked(
  context: EvmOnBlockContext,
  config: ChainConfig,
  source: Extract<LiquidityPositionSource, { kind: "read" }>,
  wallet: string,
  blockNumber: bigint,
): Promise<BigNumber> {
  const raw = (await context.effect(readPositionAmount, {
    chainId: config.chainId,
    contract: source.contract,
    method: source.method,
    arg: wallet,
    atBlock: Number(blockNumber),
  })) as string;
  return raw === "" || raw === "0" ? ZERO : toDecimal(BigInt(raw), LP_DECIMALS);
}

// Protocol-owned liquidity held directly or staked (gauge, Aura, Convex, Frax
// farm). Each holding is valued at the pool's LP unit price, with legacy's
// multiplier (pool value excluding OHM / total pool value) so the OHM side
// never backs OHM. Pools are only priced when the treasury holds something.
// The OHM share of each wallet's LP also leaves backed and floating supply as
// a Liquidity row (one per pool and wallet, staked and unstaked summed).
export async function pushLiquidityPositionRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  for (const position of config.liquidityPositions ?? []) {
    if (!isActive(position, blockNumber) || !isActive(position.pricing, blockNumber)) continue;

    const holdings = await readHoldings(context, config, position, blockNumber);
    if (holdings.length === 0) continue;

    const { pricing } = position;
    const totalValue = await getTotalValue(config, context, client, pricing, [], blockNumber);
    if (!totalValue || totalValue.eq(ZERO)) continue;
    const valueExcludingOhm = await getTotalValue(
      config,
      context,
      client,
      pricing,
      [config.ohmToken],
      blockNumber,
    );
    const unitRate = await getUnitPrice(config, context, client, pricing, blockNumber);
    if (!valueExcludingOhm || !unitRate || unitRate.eq(ZERO)) continue;
    const multiplier = valueExcludingOhm.div(totalValue);

    for (const holding of holdings) {
      records.push(
        createTokenRecord(
          config,
          timestamp,
          holding.source.label,
          holding.source.kind === "wallet" ? position.lpToken : holding.source.receiptToken,
          getContractName(config, holding.wallet),
          holding.wallet,
          unitRate,
          holding.amount,
          blockNumber,
          multiplier,
          position.category ?? "Protocol-Owned Liquidity",
        ),
      );
    }

    const ohmPerLp = await getTokenQuantityPerLp(
      config,
      context,
      client,
      pricing,
      config.ohmToken,
      blockNumber,
    );
    if (!ohmPerLp || ohmPerLp.eq(ZERO)) continue;
    const lpByWallet = new Map<string, BigNumber>();
    for (const holding of holdings) {
      lpByWallet.set(holding.wallet, (lpByWallet.get(holding.wallet) ?? ZERO).plus(holding.amount));
    }
    for (const [wallet, lp] of lpByWallet) {
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          getContractName(config, config.ohmToken),
          config.ohmToken,
          position.poolLabel,
          position.lpToken,
          getContractName(config, wallet),
          wallet,
          TYPE_LIQUIDITY,
          lp.times(ohmPerLp),
          blockNumber,
          -1,
        ),
      );
    }
  }
}
