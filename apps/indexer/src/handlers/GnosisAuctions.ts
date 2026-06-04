import type BigNumber from "bignumber.js";
import BigNumberCtor from "bignumber.js";
import type { BigDecimal, EvmOnBlockContext } from "envio";

import { readBondManagerState } from "../effects";
import {
  TYPE_BONDS_DEPOSITS,
  TYPE_BONDS_PREMINTED,
  TYPE_BONDS_VESTING_DEPOSITS,
  TYPE_BONDS_VESTING_TOKENS,
} from "../snapshot/global";
import { addr, toDecimal, ZERO } from "../snapshot/math";
import { createTokenSupply, getContractName } from "../snapshot/records";
import type { ChainConfig, SerializedTokenSupply } from "../snapshot/types";

const BOND_OHM_DECIMALS = 9;

// GnosisAuction bond supplies (Ethereum). For each known Olympus bond
// auction tracked by the BondManager event handler, attribute the OHM
// supply to the right wallet + bond phase:
//
//   open (bidQuantity null)      → pre-minted at the teller (payoutCapacity)
//   closed but still vesting     → deposits at BondManager + tokens at teller
//   fully vested                 → deposits at BondManager, scaled down by
//                                  any partial OHM burns that have already
//                                  happened
//
// The "fully vested" path needs special handling because if some auctions'
// bonds have already been burned, the BondManager's actual OHM balance is
// lower than the sum of bidQuantities. We pro-rate each fully-vested
// auction's contribution by (bondManagerOhmBalance / totalBurnableOhm).
export async function pushGnosisAuctionSupply(
  context: EvmOnBlockContext,
  config: ChainConfig,
  supplies: SerializedTokenSupply[],
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const bondManager = config.bondManager;
  if (!bondManager) return;
  if (blockNumber < BigInt(bondManager.startBlock)) return;

  const state = (await context.effect(readBondManagerState, {
    chainId: config.chainId,
    bondManager: bondManager.address,
    atBlock: Number(blockNumber),
  })) as { isActive: boolean; teller: string };
  if (!state.isActive) return;
  const tellerAddress = addr(state.teller);

  // Fetch all GnosisAuction rows for this chain.
  const auctions = await context.GnosisAuction.getWhere({
    chainId: { _eq: config.chainId },
  });
  if (auctions.length === 0) return;

  // BondManager OHM balance at this block — for adjusting fully-vested
  // entries to account for partial burns.
  const balanceEntity = await context.TokenBalance.get(
    `${config.chainId}-${addr(config.ohmToken)}-${addr(bondManager.address)}`,
  );
  const bondManagerOhmBalanceRaw = balanceEntity?.balance ?? 0n;
  const bondManagerOhmBalance = toDecimal(bondManagerOhmBalanceRaw, BOND_OHM_DECIMALS);

  // First pass: compute totalBurnableOhm = sum of bidQuantity for auctions
  // whose expiry has passed; and bondManagerOhmBalanceUnallocated = balance
  // minus bidQuantity for closed-but-vesting auctions.
  let totalBurnableOhm = ZERO;
  let bondManagerOhmBalanceUnallocated = bondManagerOhmBalance;
  for (const auction of auctions) {
    if (auction.bidQuantity === undefined || auction.bidQuantity === null) continue;
    if (auction.auctionCloseTimestamp === undefined || auction.auctionCloseTimestamp === null) {
      continue;
    }
    const bidQuantity = bigDecimalToBigNumber(auction.bidQuantity);
    const expiry = auction.auctionCloseTimestamp + auction.termSeconds;
    if (timestamp < expiry) {
      bondManagerOhmBalanceUnallocated = bondManagerOhmBalanceUnallocated.minus(bidQuantity);
    } else {
      totalBurnableOhm = totalBurnableOhm.plus(bidQuantity);
    }
  }
  const cappedBondManagerOhm = bondManagerOhmBalanceUnallocated.gt(totalBurnableOhm)
    ? totalBurnableOhm
    : bondManagerOhmBalanceUnallocated;

  // Second pass: emit per-auction TokenSupply rows.
  for (const auction of auctions) {
    const auctionLabel = auction.marketId.toString();
    const ohmName = getContractName(config, config.ohmToken);

    if (auction.bidQuantity === undefined || auction.bidQuantity === null) {
      // Open auction: capacity is pre-minted at the teller.
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, tellerAddress),
          tellerAddress,
          TYPE_BONDS_PREMINTED,
          bigDecimalToBigNumber(auction.payoutCapacity),
          blockNumber,
          -1,
        ),
      );
      continue;
    }

    const closeTimestamp = auction.auctionCloseTimestamp;
    if (closeTimestamp === undefined || closeTimestamp === null) continue;
    const expiry = closeTimestamp + auction.termSeconds;
    const bidQuantity = bigDecimalToBigNumber(auction.bidQuantity);

    if (timestamp < expiry) {
      // Closed but vesting: deposits at BondManager, tokens at teller.
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, bondManager.address),
          bondManager.address,
          TYPE_BONDS_VESTING_DEPOSITS,
          bidQuantity,
          blockNumber,
          -1,
        ),
      );
      supplies.push(
        createTokenSupply(
          config,
          timestamp,
          ohmName,
          config.ohmToken,
          auctionLabel,
          undefined,
          getContractName(config, tellerAddress),
          tellerAddress,
          TYPE_BONDS_VESTING_TOKENS,
          bigDecimalToBigNumber(auction.payoutCapacity),
          blockNumber,
          -1,
        ),
      );
      continue;
    }

    // Fully vested: adjusted deposits at BondManager.
    if (totalBurnableOhm.eq(ZERO)) continue;
    const adjustedBidQuantity = bidQuantity.times(cappedBondManagerOhm).div(totalBurnableOhm);
    if (adjustedBidQuantity.eq(ZERO)) continue;
    supplies.push(
      createTokenSupply(
        config,
        timestamp,
        ohmName,
        config.ohmToken,
        auctionLabel,
        undefined,
        getContractName(config, bondManager.address),
        bondManager.address,
        TYPE_BONDS_DEPOSITS,
        adjustedBidQuantity,
        blockNumber,
        -1,
      ),
    );
  }
}

function bigDecimalToBigNumber(value: BigDecimal | string | null | undefined): BigNumber {
  if (value === null || value === undefined) return ZERO;
  return new BigNumberCtor(typeof value === "string" ? value : value.toString());
}
