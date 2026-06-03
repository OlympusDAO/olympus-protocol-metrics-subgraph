export const CHAIN_NAMES = ["Arbitrum", "Ethereum", "Fantom", "Polygon", "Base", "Berachain"] as const;

export type ChainName = (typeof CHAIN_NAMES)[number];

export type ChainIndexingProgress = {
  block: number;
  date: string;
  timestamp: number;
};

export type IndexingProgress = {
  chains: Partial<Record<ChainName, ChainIndexingProgress>>;
};

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

export type TokenRecord = TreasuryAsset;

export type TokenSupply = OhmSupply;

export type ProtocolMetric = {
  id: string;
  block: number;
  currentAPY: number;
  currentIndex: number;
  date: string;
  gOhmPrice: number;
  gOhmTotalSupply: number;
  nextDistributedOhm: number;
  nextEpochRebase: number;
  ohmPrice: number;
  ohmTotalSupply: number;
  sOhmCirculatingSupply: number;
  timestamp: number;
  totalValueLocked: number;
};

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
  indexerDeploymentId?: string;
  indexingProgress?: IndexingProgress;
};

export type Manifest = {
  schemaVersion: string;
  generatedAt: string;
  indexerDeploymentId?: string;
  indexingProgress?: IndexingProgress;
  earliestDate: string;
  latestDate: string;
  artifacts?: Record<
    string,
    {
      sha256: string;
      byteLength: number;
      rowCount: number;
    }
  >;
};

export type WundergraphResponse<T> = {
  data: T;
  errors?: Array<{ message: string }>;
};

export type IgnoreCacheInput = {
  ignoreCache?: boolean;
};

export type PaginatedMetricsInput = {
  startDate: string;
  endDate?: string;
  dateOffset?: number;
  crossChainDataComplete?: boolean;
  includeRecords?: boolean;
  ignoreCache?: boolean;
};

export type PaginatedTokenRecordsInput = {
  startDate: string;
  endDate?: string;
  dateOffset?: number;
  crossChainDataComplete?: boolean;
  ignoreCache?: boolean;
};

export type PaginatedTokenSuppliesInput = {
  startDate: string;
  endDate?: string;
  dateOffset?: number;
  crossChainDataComplete?: boolean;
  ignoreCache?: boolean;
};

export type PaginatedProtocolMetricsInput = {
  startDate: string;
  endDate?: string;
  dateOffset?: number;
  ignoreCache?: boolean;
};

export type AtBlockInput = {
  arbitrumBlock: number;
  ethereumBlock: number;
  fantomBlock: number;
  polygonBlock: number;
  baseBlock: number;
  berachainBlock: number;
};

type LegacyOperation<Data, Input = IgnoreCacheInput | undefined> = {
  input: Input;
  data: Data;
  response: WundergraphResponse<Data>;
};

export type Operations = {
  "latest/metrics": LegacyOperation<DailyMetric[]>;
  "earliest/metrics": LegacyOperation<DailyMetric[]>;
  "paginated/metrics": LegacyOperation<DailyMetric[], PaginatedMetricsInput>;
  "latest/tokenRecords": LegacyOperation<TokenRecord[]>;
  "earliest/tokenRecords": LegacyOperation<TokenRecord[]>;
  "paginated/tokenRecords": LegacyOperation<TokenRecord[], PaginatedTokenRecordsInput>;
  "latest/tokenSupplies": LegacyOperation<TokenSupply[]>;
  "earliest/tokenSupplies": LegacyOperation<TokenSupply[]>;
  "paginated/tokenSupplies": LegacyOperation<TokenSupply[], PaginatedTokenSuppliesInput>;
  "latest/protocolMetrics": LegacyOperation<ProtocolMetric[]>;
  "earliest/protocolMetrics": LegacyOperation<ProtocolMetric[]>;
  "paginated/protocolMetrics": LegacyOperation<ProtocolMetric[], PaginatedProtocolMetricsInput>;
  "atBlock/metrics": LegacyOperation<DailyMetric[], AtBlockInput>;
  "atBlock/tokenRecords": LegacyOperation<TokenRecord[], AtBlockInput>;
  "atBlock/tokenSupplies": LegacyOperation<TokenSupply[], AtBlockInput>;
  "atBlock/internal/protocolMetrics": LegacyOperation<ProtocolMetric[], AtBlockInput>;
};

export type Queries = {
  [K in keyof Operations]: Operations[K]["response"];
};
