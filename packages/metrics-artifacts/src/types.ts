export const CHAIN_NAMES = ["Arbitrum", "Ethereum", "Fantom", "Polygon", "Base", "Berachain"] as const;

export type ChainName = (typeof CHAIN_NAMES)[number];

export type ChainValues = Record<ChainName, number>;

export type SupplyCategoryValues = {
  BondsDeposits: number;
  BondsPreminted: number;
  BondsVestingDeposits: number;
  BondsVestingTokens: number;
  BoostedLiquidityVault: number;
  LendingMarkets: number;
  ProtocolOwnedLiquidity: number;
  MigrationOffset: number;
  TotalSupply: number;
  Treasury: number;
};

export type TreasuryAsset = {
  id: string;
  balance: number;
  block: number;
  blockchain: ChainName;
  category: string;
  date: string;
  isBluechip: boolean;
  isLiquid: boolean;
  multiplier: number;
  rate: number;
  source: string;
  sourceAddress: string;
  timestamp: number;
  token: string;
  tokenAddress: string;
  value: number;
  valueExcludingOhm: number;
};

export type OhmSupply = {
  id: string;
  balance: number;
  block: number;
  blockchain: ChainName;
  date: string;
  pool: string | null;
  poolAddress: string | null;
  source: string;
  sourceAddress: string;
  supplyBalance: number;
  timestamp: number;
  token: string;
  tokenAddress: string;
  type: string;
};

export type ChainTreasuryAssets = Record<ChainName, TreasuryAsset[]>;

export type ChainOhmSupply = Record<ChainName, OhmSupply[]>;

export type ResponseMetadata = {
  chainsComplete: ChainName[];
  chainsFailed: ChainName[];
  timestamp: string;
};

export type DailyMetric = {
  date: string;
  blocks: ChainValues;
  timestamps: ChainValues;
  crossChainComplete: boolean;
  chainsIndexed: number[];
  chainsMissing: number[];
  ohmIndex: number;
  ohmApy: number;
  ohmTotalSupply: number;
  ohmTotalSupplyComponents: ChainValues;
  ohmCirculatingSupply: number;
  ohmCirculatingSupplyComponents: ChainValues;
  ohmFloatingSupply: number;
  ohmFloatingSupplyComponents: ChainValues;
  ohmBackedSupply: number;
  gOhmBackedSupply: number;
  ohmBackedSupplyComponents: ChainValues;
  ohmSupplyCategories: SupplyCategoryValues;
  ohmPrice: number;
  gOhmPrice: number;
  marketCap: number;
  sOhmCirculatingSupply: number;
  sOhmTotalValueLocked: number;
  treasuryMarketValue: number;
  treasuryMarketValueComponents: ChainValues;
  treasuryLiquidBacking: number;
  treasuryLiquidBackingComponents: ChainValues;
  treasuryLiquidBackingPerOhmFloating: number;
  treasuryLiquidBackingPerOhmBacked: number;
  treasuryLiquidBackingPerGOhmBacked: number;
  ohmTotalSupplyRecords?: ChainOhmSupply;
  ohmCirculatingSupplyRecords?: ChainOhmSupply;
  ohmFloatingSupplyRecords?: ChainOhmSupply;
  ohmBackedSupplyRecords?: ChainOhmSupply;
  treasuryMarketValueRecords?: ChainTreasuryAssets;
  treasuryLiquidBackingRecords?: ChainTreasuryAssets;
  _meta?: ResponseMetadata;
};

export type ApiMeta = {
  generatedAt: string;
  earliestDate: string;
  latestDate: string;
  range?: {
    start: string;
    end: string;
    days: number;
    maxDays: number;
  };
};

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type BoundsResponse = {
  earliestDate: string;
  latestDate: string;
  maxRangeDays: number;
};

export type Manifest = {
  schemaVersion: string;
  generatedAt: string;
  earliestDate: string;
  latestDate: string;
};

export type WundergraphResponse<T> = {
  data: T | null;
  errors?: Array<{ message: string }>;
};
