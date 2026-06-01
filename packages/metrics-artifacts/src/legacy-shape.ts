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

export function emptyChainValues(): ChainValues {
  throw new Error("Not implemented");
}

export function emptySupplyCategoryValues(): SupplyCategoryValues {
  throw new Error("Not implemented");
}

export function groupTreasuryAssetsByChain(_assets: TreasuryAsset[]): ChainTreasuryAssets {
  throw new Error("Not implemented");
}

export function groupOhmSupplyByChain(_supplies: OhmSupply[]): ChainOhmSupply {
  throw new Error("Not implemented");
}

export function buildDailyMetric(_input: {
  date: string;
  chainValues: Partial<Record<ChainName, Partial<ChainValues>>>;
  treasuryAssets?: TreasuryAsset[];
  ohmSupply?: OhmSupply[];
  includeRecords?: boolean;
  chainsIndexed?: number[];
  chainsMissing?: number[];
  generatedAt: string;
}): DailyMetric {
  throw new Error("Not implemented");
}
