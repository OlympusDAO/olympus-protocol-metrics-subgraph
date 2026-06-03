import BigNumber from "bignumber.js";

import { ONE, ZERO } from "./math";
import { CHAIN_IDS, type SerializedTokenRecord, type SerializedTokenSupply } from "./types";

// Supply-category type names, matching the string values written by
// BlockHandlers (createTokenSupply with these `type` strings) and the legacy
// TYPE_* constants in subgraphs/shared/src/utils/TokenSupplyHelper.ts.
export const TYPE_TOTAL_SUPPLY = "Total Supply";
export const TYPE_TREASURY = "Treasury";
export const TYPE_OFFSET = "OHM Migration Offset";
export const TYPE_BONDS_PREMINTED = "Bonds (Pre-Minted)";
export const TYPE_BONDS_VESTING_DEPOSITS = "Bonds (Vesting Deposits)";
export const TYPE_BONDS_VESTING_TOKENS = "Bonds (Vesting Tokens)";
export const TYPE_BONDS_DEPOSITS = "Bonds (Deposits)";
export const TYPE_LIQUIDITY = "Liquidity";
export const TYPE_BLV = "Boosted Liquidity Vault";
export const TYPE_LENDING = "Lending";

// `isBLVIncluded(ethereumBlock)` from inventory-treasury-subgraph.md §8:
// before 17_620_000 BLV is treated as non-circulating (included in
// floating + circulating). After that block BLV is in floating but not
// circulating. Backed always includes BLV.
export const ETHEREUM_BLV_INCLUSION_BLOCK = 17_620_000n;

// Buyback MS — OHM held here counts toward MV after block 20_514_801 per
// inventory §3.
const BUYBACK_MS = "0xf7deb867e65306be0cb33918ac1b8f89a72109db";
const BUYBACK_MS_INCLUSION_BLOCK = 20_514_801n;

const OHM_CATEGORY = "OHM";

function isBuybackRecord(record: SerializedTokenRecord): boolean {
  if (!record.block) return false;
  const block = BigInt(record.block);
  if (block < BUYBACK_MS_INCLUSION_BLOCK) return false;
  return record.sourceAddress.toLowerCase() === BUYBACK_MS;
}

function isOhmRecord(record: SerializedTokenRecord): boolean {
  return record.category === OHM_CATEGORY;
}

export type PerChainAggregate = {
  chainId: number;
  blockchain: string;
  date: string;
  block: bigint;
  timestamp: bigint;
  ohmTotalSupply: BigNumber;
  ohmCirculatingSupply: BigNumber;
  ohmFloatingSupply: BigNumber;
  ohmBackedSupply: BigNumber;
  treasuryMarketValue: BigNumber;
  treasuryLiquidBacking: BigNumber;
  supplyCategories: Map<string, { balance: BigNumber; supplyBalance: BigNumber }>;
};

// Compute the per-chain aggregate from one chain's TokenRecord + TokenSupply
// rows. Pure — no IO. Mirrors the legacy `getMetricObject` per-chain math.
export function computePerChainAggregate(
  chainId: number,
  blockchain: string,
  date: string,
  block: bigint,
  timestamp: bigint,
  records: SerializedTokenRecord[],
  supplies: SerializedTokenSupply[],
): PerChainAggregate {
  let treasuryMarketValue = ZERO;
  let treasuryLiquidBacking = ZERO;

  for (const record of records) {
    const value = new BigNumber(record.value);
    const valueExcludingOhm = new BigNumber(record.valueExcludingOhm);

    if (isOhmRecord(record)) {
      // OHM only counts toward MV if it's at the Buyback MS post-inclusion.
      if (isBuybackRecord(record)) {
        treasuryMarketValue = treasuryMarketValue.plus(value);
      }
      // OHM never contributes to liquid backing.
      continue;
    }

    treasuryMarketValue = treasuryMarketValue.plus(value);
    if (record.isLiquid) {
      treasuryLiquidBacking = treasuryLiquidBacking.plus(valueExcludingOhm);
    }
  }

  // Bucket TokenSupply by type into supplyCategories.
  const supplyCategories = new Map<string, { balance: BigNumber; supplyBalance: BigNumber }>();
  for (const supply of supplies) {
    const balance = new BigNumber(supply.balance);
    const supplyBalance = new BigNumber(supply.supplyBalance);
    const bucket = supplyCategories.get(supply.type) ?? { balance: ZERO, supplyBalance: ZERO };
    bucket.balance = bucket.balance.plus(balance);
    bucket.supplyBalance = bucket.supplyBalance.plus(supplyBalance);
    supplyCategories.set(supply.type, bucket);
  }

  const supplyOf = (type: string): BigNumber => supplyCategories.get(type)?.supplyBalance ?? ZERO;

  const isPreBlvInclusion = chainId === CHAIN_IDS.ETHEREUM && block < ETHEREUM_BLV_INCLUSION_BLOCK;

  const ohmTotalSupply = supplyOf(TYPE_TOTAL_SUPPLY);

  const circulatingTypes = [
    TYPE_TOTAL_SUPPLY,
    TYPE_TREASURY,
    TYPE_OFFSET,
    TYPE_BONDS_PREMINTED,
    TYPE_BONDS_VESTING_DEPOSITS,
    TYPE_BONDS_DEPOSITS,
  ];
  let ohmCirculatingSupply = circulatingTypes.reduce((acc, type) => acc.plus(supplyOf(type)), ZERO);
  if (isPreBlvInclusion) ohmCirculatingSupply = ohmCirculatingSupply.plus(supplyOf(TYPE_BLV));

  let ohmFloatingSupply = ohmCirculatingSupply.plus(supplyOf(TYPE_LIQUIDITY));

  const ohmBackedSupply = [
    TYPE_TOTAL_SUPPLY,
    TYPE_TREASURY,
    TYPE_OFFSET,
    TYPE_BONDS_PREMINTED,
    TYPE_BONDS_VESTING_DEPOSITS,
    TYPE_BONDS_DEPOSITS,
    TYPE_LIQUIDITY,
    TYPE_BLV,
    TYPE_LENDING,
  ].reduce((acc, type) => acc.plus(supplyOf(type)), ZERO);

  return {
    chainId,
    blockchain,
    date,
    block,
    timestamp,
    ohmTotalSupply,
    ohmCirculatingSupply,
    ohmFloatingSupply,
    ohmBackedSupply,
    treasuryMarketValue,
    treasuryLiquidBacking,
    supplyCategories,
  };
}

// Cross-chain aggregate over multiple PerChainAggregates for the same date.
// Crucially, summing is preserved across chains for the additive fields;
// canonical (Ethereum-only) fields are surfaced separately via
// `getCanonicalAggregate`.
export type CrossChainAggregate = {
  date: string;
  ohmTotalSupply: BigNumber;
  ohmCirculatingSupply: BigNumber;
  ohmFloatingSupply: BigNumber;
  ohmBackedSupply: BigNumber;
  treasuryMarketValue: BigNumber;
  treasuryLiquidBacking: BigNumber;
  supplyCategories: Map<string, { balance: BigNumber; supplyBalance: BigNumber }>;
  // numeric chainIds — switched from chain-name strings per @0xJem on
  // PR #311 Step 4 to avoid case-sensitivity risk.
  chainsIndexed: number[];
  chainsMissing: number[];
  crossChainComplete: boolean;
};

// Chains required for `crossChainComplete` to be true. Per Phase 1 decision
// #10 the legacy `crossChainDataComplete` only requires Arbitrum + Ethereum.
const REQUIRED_CHAINS_FOR_COMPLETE: number[] = [CHAIN_IDS.ARBITRUM, CHAIN_IDS.ETHEREUM];
const ALL_CHAIN_IDS: number[] = [
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.FANTOM,
  CHAIN_IDS.POLYGON,
  CHAIN_IDS.BASE,
  CHAIN_IDS.BERACHAIN,
];

export function aggregateAcrossChains(
  date: string,
  perChain: PerChainAggregate[],
): CrossChainAggregate {
  let ohmTotalSupply = ZERO;
  let ohmCirculatingSupply = ZERO;
  let ohmFloatingSupply = ZERO;
  let ohmBackedSupply = ZERO;
  let treasuryMarketValue = ZERO;
  let treasuryLiquidBacking = ZERO;
  const supplyCategories = new Map<string, { balance: BigNumber; supplyBalance: BigNumber }>();

  for (const chain of perChain) {
    ohmTotalSupply = ohmTotalSupply.plus(chain.ohmTotalSupply);
    ohmCirculatingSupply = ohmCirculatingSupply.plus(chain.ohmCirculatingSupply);
    ohmFloatingSupply = ohmFloatingSupply.plus(chain.ohmFloatingSupply);
    ohmBackedSupply = ohmBackedSupply.plus(chain.ohmBackedSupply);
    treasuryMarketValue = treasuryMarketValue.plus(chain.treasuryMarketValue);
    treasuryLiquidBacking = treasuryLiquidBacking.plus(chain.treasuryLiquidBacking);
    for (const [type, bucket] of chain.supplyCategories) {
      const existing = supplyCategories.get(type) ?? { balance: ZERO, supplyBalance: ZERO };
      existing.balance = existing.balance.plus(bucket.balance);
      existing.supplyBalance = existing.supplyBalance.plus(bucket.supplyBalance);
      supplyCategories.set(type, existing);
    }
  }

  const chainsIndexed = perChain.map((chain) => chain.chainId);
  const chainsMissing = ALL_CHAIN_IDS.filter((chainId) => !chainsIndexed.includes(chainId));
  const crossChainComplete = REQUIRED_CHAINS_FOR_COMPLETE.every((chainId) =>
    chainsIndexed.includes(chainId),
  );

  return {
    date,
    ohmTotalSupply,
    ohmCirculatingSupply,
    ohmFloatingSupply,
    ohmBackedSupply,
    treasuryMarketValue,
    treasuryLiquidBacking,
    supplyCategories,
    chainsIndexed,
    chainsMissing,
    crossChainComplete,
  };
}

// Derived ratios — pure math over the aggregate. Returns ZERO when the
// denominator is zero (legacy returns 0 in those cases — see
// inventory-treasury-subgraph.md §8 "Derived ratios").
export type DerivedRatios = {
  marketCap: BigNumber;
  gOhmBackedSupply: BigNumber;
  treasuryLiquidBackingPerOhmFloating: BigNumber;
  treasuryLiquidBackingPerOhmBacked: BigNumber;
  treasuryLiquidBackingPerGOhmBacked: BigNumber;
};

export function computeDerivedRatios(
  aggregate: CrossChainAggregate,
  ohmPrice: BigNumber,
  ohmIndex: BigNumber,
): DerivedRatios {
  const marketCap = ohmPrice.times(aggregate.ohmCirculatingSupply);
  const gOhmBackedSupply =
    aggregate.ohmBackedSupply.eq(ZERO) || ohmIndex.eq(ZERO)
      ? ZERO
      : aggregate.ohmBackedSupply.div(ohmIndex);
  const treasuryLiquidBackingPerOhmFloating = aggregate.ohmFloatingSupply.eq(ZERO)
    ? ZERO
    : aggregate.treasuryLiquidBacking.div(aggregate.ohmFloatingSupply);
  const treasuryLiquidBackingPerOhmBacked = aggregate.ohmBackedSupply.eq(ZERO)
    ? ZERO
    : aggregate.treasuryLiquidBacking.div(aggregate.ohmBackedSupply);
  const treasuryLiquidBackingPerGOhmBacked = gOhmBackedSupply.eq(ZERO)
    ? ZERO
    : aggregate.treasuryLiquidBacking.div(gOhmBackedSupply);
  return {
    marketCap,
    gOhmBackedSupply,
    treasuryLiquidBackingPerOhmFloating,
    treasuryLiquidBackingPerOhmBacked,
    treasuryLiquidBackingPerGOhmBacked,
  };
}

// APY = ((1 + nextEpochRebase/100)^(365×3) − 1) × 100
// where nextEpochRebase = distributedOhm / sOhmCirculatingSupply × 100.
// Returns 0 when either input is zero (matches legacy default).
export function computeApy(
  distributedOhm: BigNumber,
  sOhmCirculatingSupply: BigNumber,
): { nextEpochRebase: BigNumber; currentApy: BigNumber } {
  if (sOhmCirculatingSupply.eq(ZERO) || distributedOhm.eq(ZERO)) {
    return { nextEpochRebase: ZERO, currentApy: ZERO };
  }
  const nextEpochRebase = distributedOhm.div(sOhmCirculatingSupply).times(new BigNumber("100"));
  // Legacy uses JS Math.pow which loses precision past ~15 digits; we mirror
  // that exactly so the parity diff produces zero. Compounded 3× daily over
  // 365 days = 1095 rebases.
  const rebaseRatio = nextEpochRebase.div(new BigNumber("100")).plus(new BigNumber("1"));
  const compounded = Math.pow(Number(rebaseRatio.toString()), 365 * 3);
  const currentApy = new BigNumber((compounded - 1).toString()).times(new BigNumber("100"));
  return { nextEpochRebase, currentApy };
}

export { ZERO, ONE };
