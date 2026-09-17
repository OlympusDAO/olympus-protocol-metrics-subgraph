import BigNumber from "bignumber.js";
import { type EvmOnBlockContext, indexer } from "envio";
import type { PublicClient } from "viem";
import { readMellowPosition } from "../effects/mellow";
import { getPrice } from "../pricing";
import { createTokenRecord, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenRecord } from "../snapshot/types";

indexer.onEvent(
  { contract: "MellowRedeemQueue", event: "ReportHandled" },
  async ({ event, context }) => {
    const id = `${context.chain.id}-${event.srcAddress.toLowerCase()}`;
    const value = {
      id,
      handledTimestamp: BigInt(event.params.timestamp),
      block: BigInt(event.block.number),
    };
    context.MellowQueueState.set(value);
    context.MellowQueueUpdate.set({
      ...value,
      id: `${id}-${event.block.number}-${event.logIndex}`,
    });
  },
);

export type MellowPosition = {
  shares: string;
  priceD18: string;
  reportTimestamp: number;
  suspicious: boolean;
  maxAge: number;
  requests: { timestamp: number; shares: string; assets: string; isClaimable: boolean }[];
};

/**
 * Split a wallet position into mutually exclusive claims. pendingShares are
 * post-redemption-fee shares locked in requests not yet priced by ReportHandled;
 * they float with NAV and are no longer part of wallet shares. fixedAssets are
 * USDG amounts already priced by ReportHandled, even if not yet claimable. They
 * do not reprice with NAV. Claimed requests disappear and become idle USDG.
 * Inputs use raw 18dp shares / 6dp assets; outputs use whole units and USDG/share.
 */
export function valueMellowPosition(
  position: MellowPosition,
  handledTimestamp: number,
  timestamp: number,
) {
  let pendingShares = new BigNumber(0);
  let fixedAssets = new BigNumber(0);
  for (const request of position.requests) {
    if (request.timestamp <= handledTimestamp) {
      // Includes a processed zero-asset/dust claim, even before it is claimable.
      fixedAssets = fixedAssets.plus(request.assets);
    } else {
      if (request.isClaimable || new BigNumber(request.assets).gt(0))
        throw new Error("Missing Mellow ReportHandled history");
      pendingShares = pendingShares.plus(request.shares);
    }
  }
  const shares = new BigNumber(position.shares);
  const needsNav = shares.plus(pendingShares).gt(0);
  let rate = new BigNumber(0);
  if (needsNav) {
    const price = new BigNumber(position.priceD18);
    if (
      !price.isFinite() ||
      price.lte(0) ||
      position.suspicious ||
      position.reportTimestamp <= 0 ||
      position.reportTimestamp > timestamp ||
      timestamp - position.reportTimestamp > position.maxAge
    ) {
      throw new Error(
        "Invalid or stale Mellow oracle report; refusing incomplete treasury snapshot",
      );
    }
    // sharesRaw = assetsRaw * priceD18 / 1e18; shares 18dp, USDG 6dp.
    rate = new BigNumber(10).pow(30).div(price);
  }
  return {
    shares: shares.div(1e18),
    pendingShares: pendingShares.div(1e18),
    fixedAssets: fixedAssets.div(1e6),
    rate,
  };
}

export async function pushMellowRecords(
  context: EvmOnBlockContext,
  config: ChainConfig,
  client: PublicClient,
  records: SerializedTokenRecord[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const vault = config.mellowVault;
  if (!vault || blockNumber < BigInt(vault.startBlock)) return;
  const state = await context.MellowQueueState.get(`${config.chainId}-${vault.redeemQueue}`);
  for (const wallet of config.protocolAddresses) {
    const position = await context.effect(readMellowPosition, {
      chainId: config.chainId,
      wallet,
      atBlock: Number(blockNumber),
    });
    const values = valueMellowPosition(
      position,
      Number(state?.handledTimestamp ?? 0n),
      Number(timestamp),
    );
    if (values.shares.isZero() && values.pendingShares.isZero() && values.fixedAssets.isZero())
      continue;
    const assetPrice = (await getPrice(config, context, client, vault.asset, blockNumber, null))
      .price;
    if (assetPrice.lte(0)) throw new Error("Missing USDG valuation");
    for (const [name, address, rate, balance] of [
      [
        getContractName(config, vault.shares),
        vault.shares,
        values.rate.times(assetPrice),
        values.shares,
      ],
      [
        "rUSDG - Pending redemption",
        vault.shares,
        values.rate.times(assetPrice),
        values.pendingShares,
      ],
      ["USDG - Mellow redemption claim", vault.asset, assetPrice, values.fixedAssets],
    ] as const) {
      if (balance.isZero()) continue;
      const record = createTokenRecord(
        config,
        timestamp,
        name,
        address,
        getContractName(config, wallet),
        wallet,
        rate,
        balance,
        blockNumber,
      );
      record.isLiquid = false; // NAV/queued claims are not idle USDG or liquid backing.
      records.push(record);
    }
  }
}
