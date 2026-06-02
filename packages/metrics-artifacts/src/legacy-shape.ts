import type {
  ChainName,
  ChainOhmSupply,
  ChainTreasuryAssets,
  ChainValues,
  DailyMetric,
  OhmSupply,
  SupplyCategoryValues,
  TreasuryAsset,
} from "./types.js";
import { CHAIN_NAMES } from "./types.js";

export const CHAIN_IDS_BY_NAME: Record<ChainName, number> = {
  Arbitrum: 42161,
  Ethereum: 1,
  Fantom: 250,
  Polygon: 137,
  Base: 8453,
  Berachain: 80094,
};

export const ALL_CHAIN_IDS: number[] = CHAIN_NAMES.map((chainName) => CHAIN_IDS_BY_NAME[chainName]);
export const REQUIRED_CHAIN_IDS_FOR_COMPLETE: number[] = [
  CHAIN_IDS_BY_NAME.Arbitrum,
  CHAIN_IDS_BY_NAME.Ethereum,
];

const CHAIN_ID_TO_NAME = new Map<number, ChainName>(
  Object.entries(CHAIN_IDS_BY_NAME).map(([chainName, chainId]) => [chainId, chainName as ChainName]),
);

export function emptyChainValues(): ChainValues {
  return {
    Arbitrum: 0,
    Ethereum: 0,
    Fantom: 0,
    Polygon: 0,
    Base: 0,
    Berachain: 0,
  };
}

export function emptySupplyCategoryValues(): SupplyCategoryValues {
  return {
    BondsDeposits: 0,
    BondsPreminted: 0,
    BondsVestingDeposits: 0,
    BondsVestingTokens: 0,
    BoostedLiquidityVault: 0,
    LendingMarkets: 0,
    ProtocolOwnedLiquidity: 0,
    MigrationOffset: 0,
    TotalSupply: 0,
    Treasury: 0,
  };
}

export function groupTreasuryAssetsByChain(assets: TreasuryAsset[]): ChainTreasuryAssets {
  const grouped: ChainTreasuryAssets = {
    Arbitrum: [],
    Ethereum: [],
    Fantom: [],
    Polygon: [],
    Base: [],
    Berachain: [],
  };
  for (const asset of assets) {
    grouped[asset.blockchain].push(asset);
  }
  return grouped;
}

export function groupOhmSupplyByChain(supplies: OhmSupply[]): ChainOhmSupply {
  const grouped: ChainOhmSupply = {
    Arbitrum: [],
    Ethereum: [],
    Fantom: [],
    Polygon: [],
    Base: [],
    Berachain: [],
  };
  for (const supply of supplies) {
    grouped[supply.blockchain].push(supply);
  }
  return grouped;
}

function chainNamesFromIds(chainIds: number[] | undefined): ChainName[] {
  return (chainIds ?? [])
    .map((chainId) => CHAIN_ID_TO_NAME.get(chainId))
    .filter((chainName): chainName is ChainName => chainName !== undefined);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueChainIds(chainNames: ChainName[]): number[] {
  return [...new Set(chainNames.map((chainName) => CHAIN_IDS_BY_NAME[chainName]))];
}

function inferIndexedChainIds(treasuryAssets: TreasuryAsset[], ohmSupply: OhmSupply[]): number[] {
  return uniqueChainIds([
    ...treasuryAssets.map((asset) => asset.blockchain),
    ...ohmSupply.map((supply) => supply.blockchain),
  ]);
}

function missingChainIds(chainsIndexed: number[]): number[] {
  return ALL_CHAIN_IDS.filter((chainId) => !chainsIndexed.includes(chainId));
}

export function isCrossChainComplete(chainsIndexed: number[]): boolean {
  return REQUIRED_CHAIN_IDS_FOR_COMPLETE.every((chainId) => chainsIndexed.includes(chainId));
}

export function buildDailyMetric(input: {
  date: string;
  chainValues: Partial<Record<ChainName, Partial<ChainValues>>>;
  treasuryAssets?: TreasuryAsset[];
  ohmSupply?: OhmSupply[];
  includeRecords?: boolean;
  chainsIndexed?: number[];
  chainsMissing?: number[];
  generatedAt: string;
}): DailyMetric {
  const treasuryAssets = input.treasuryAssets ?? [];
  const ohmSupply = input.ohmSupply ?? [];
  const chainsIndexed = input.chainsIndexed ?? inferIndexedChainIds(treasuryAssets, ohmSupply);
  const chainsMissing = input.chainsMissing ?? missingChainIds(chainsIndexed);
  const treasuryAssetsByChain = groupTreasuryAssetsByChain(treasuryAssets);
  const ohmSupplyByChain = groupOhmSupplyByChain(ohmSupply);
  const treasuryMarketValueComponents = emptyChainValues();
  const treasuryLiquidBackingComponents = emptyChainValues();
  const ohmTotalSupplyComponents = emptyChainValues();
  const ohmCirculatingSupplyComponents = emptyChainValues();
  const ohmFloatingSupplyComponents = emptyChainValues();
  const ohmBackedSupplyComponents = emptyChainValues();
  const blocks = emptyChainValues();
  const timestamps = emptyChainValues();

  for (const chain of CHAIN_NAMES) {
    const assets = treasuryAssetsByChain[chain];
    const supplies = ohmSupplyByChain[chain];
    treasuryMarketValueComponents[chain] = sum(assets.map((asset) => asset.value));
    treasuryLiquidBackingComponents[chain] = sum(
      assets
        .filter((asset) => asset.isLiquid)
        .map((asset) => asset.valueExcludingOhm),
    );
    ohmTotalSupplyComponents[chain] = sum(
      supplies.filter((supply) => supply.type === "Total Supply").map((supply) => supply.balance),
    );
    ohmCirculatingSupplyComponents[chain] = sum(supplies.map((supply) => supply.supplyBalance));
    ohmFloatingSupplyComponents[chain] = ohmCirculatingSupplyComponents[chain];
    ohmBackedSupplyComponents[chain] = ohmCirculatingSupplyComponents[chain];
    blocks[chain] = assets[0]?.block ?? supplies[0]?.block ?? 0;
    timestamps[chain] = assets[0]?.timestamp ?? supplies[0]?.timestamp ?? 0;
  }

  const metric: DailyMetric = {
    date: input.date,
    blocks,
    timestamps,
    crossChainComplete: isCrossChainComplete(chainsIndexed),
    chainsIndexed,
    chainsMissing,
    ohmIndex: 0,
    ohmApy: 0,
    ohmTotalSupply: sum(Object.values(ohmTotalSupplyComponents)),
    ohmTotalSupplyComponents,
    ohmCirculatingSupply: sum(Object.values(ohmCirculatingSupplyComponents)),
    ohmCirculatingSupplyComponents,
    ohmFloatingSupply: sum(Object.values(ohmFloatingSupplyComponents)),
    ohmFloatingSupplyComponents,
    ohmBackedSupply: sum(Object.values(ohmBackedSupplyComponents)),
    gOhmBackedSupply: 0,
    ohmBackedSupplyComponents,
    ohmSupplyCategories: emptySupplyCategoryValues(),
    ohmPrice: 0,
    gOhmPrice: 0,
    marketCap: 0,
    sOhmCirculatingSupply: 0,
    sOhmTotalValueLocked: 0,
    treasuryMarketValue: sum(Object.values(treasuryMarketValueComponents)),
    treasuryMarketValueComponents,
    treasuryLiquidBacking: sum(Object.values(treasuryLiquidBackingComponents)),
    treasuryLiquidBackingComponents,
    treasuryLiquidBackingPerOhmFloating: 0,
    treasuryLiquidBackingPerOhmBacked: 0,
    treasuryLiquidBackingPerGOhmBacked: 0,
    _meta: {
      chainsComplete: chainNamesFromIds(chainsIndexed),
      chainsFailed: chainNamesFromIds(chainsMissing),
      timestamp: input.generatedAt,
    },
  };

  if (input.includeRecords) {
    metric.ohmTotalSupplyRecords = ohmSupplyByChain;
    metric.ohmCirculatingSupplyRecords = ohmSupplyByChain;
    metric.ohmFloatingSupplyRecords = ohmSupplyByChain;
    metric.ohmBackedSupplyRecords = ohmSupplyByChain;
    metric.treasuryMarketValueRecords = treasuryAssetsByChain;
    metric.treasuryLiquidBackingRecords = groupTreasuryAssetsByChain(
      treasuryAssets.filter((asset) => asset.isLiquid),
    );
  }

  return metric;
}
