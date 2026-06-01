import type {
  ChainName,
  ChainOhmSupply,
  ChainTreasuryAssets,
  ChainValues,
  DailyMetric,
  OhmSupply,
  SupplyCategoryValues,
  TreasuryAsset,
} from "./types";
import { CHAIN_NAMES } from "./types";

const CHAIN_ID_TO_NAME = new Map<number, ChainName>([
  [42161, "Arbitrum"],
  [1, "Ethereum"],
  [250, "Fantom"],
  [137, "Polygon"],
  [8453, "Base"],
  [80094, "Berachain"],
]);

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
    crossChainComplete: (input.chainsMissing ?? []).length === 0,
    chainsIndexed: input.chainsIndexed ?? [],
    chainsMissing: input.chainsMissing ?? [],
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
      chainsComplete: chainNamesFromIds(input.chainsIndexed),
      chainsFailed: chainNamesFromIds(input.chainsMissing),
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
