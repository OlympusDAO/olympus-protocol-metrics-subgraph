import {
  ALL_CHAIN_IDS,
  CHAIN_NAMES,
  emptyChainValues,
  emptySupplyCategoryValues,
  isCrossChainComplete,
  type ChainName,
  type DailyMetric,
  type DateRange,
  type OhmSupply,
  type SupplyCategoryValues,
  type TreasuryAsset,
} from "../../../packages/metrics-artifacts/src";

export type MetricsBounds = {
  earliestDate: string;
  latestDate: string;
};

export type PublishBoundsCompleteness = "cross_chain" | "all_chains";

export type ChainIndexingProgress = {
  block: number;
  date: string;
};

export type LatestIndexingProgress = {
  chains: Partial<Record<ChainName, ChainIndexingProgress>>;
};

export type MetricsSource = {
  fetchBounds(completeness?: PublishBoundsCompleteness): Promise<MetricsBounds>;
  fetchLatestIndexingProgress(): Promise<LatestIndexingProgress>;
  fetchDailyMetrics(range: DateRange): Promise<DailyMetric[]>;
  fetchTreasuryAssets(range: DateRange): Promise<TreasuryAsset[]>;
  fetchOhmSupply(range: DateRange): Promise<OhmSupply[]>;
};

export class MetricsNotDataReadyError extends Error {
  constructor(message = "Metrics data is not ready to publish.") {
    super(message);
    this.name = "MetricsNotDataReadyError";
  }
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const DEFAULT_BOUNDS: MetricsBounds = {
  earliestDate: "2021-04-29",
  latestDate: "2026-06-01",
};

const SUPPLY_CATEGORY_TO_LEGACY_KEY: Record<string, keyof SupplyCategoryValues> = {
  TOTAL_SUPPLY: "TotalSupply",
  TREASURY: "Treasury",
  OHM_MIGRATION_OFFSET: "MigrationOffset",
  BONDS_PREMINTED: "BondsPreminted",
  BONDS_VESTING_DEPOSITS: "BondsVestingDeposits",
  BONDS_VESTING_TOKENS: "BondsVestingTokens",
  BONDS_DEPOSITS: "BondsDeposits",
  LIQUIDITY: "ProtocolOwnedLiquidity",
  BOOSTED_LIQUIDITY_VAULT: "BoostedLiquidityVault",
  LENDING: "LendingMarkets",
};

export class EmptyMetricsSource implements MetricsSource {
  async fetchBounds(): Promise<MetricsBounds> {
    return DEFAULT_BOUNDS;
  }

  async fetchLatestIndexingProgress(): Promise<LatestIndexingProgress> {
    return {
      chains: Object.fromEntries(
        CHAIN_NAMES.map((chainName) => [chainName, { block: 0, date: DEFAULT_BOUNDS.latestDate }]),
      ),
    };
  }

  async fetchDailyMetrics(): Promise<DailyMetric[]> {
    return [];
  }

  async fetchTreasuryAssets(): Promise<TreasuryAsset[]> {
    return [];
  }

  async fetchOhmSupply(): Promise<OhmSupply[]> {
    return [];
  }
}

export class HasuraGraphqlMetricsSource implements MetricsSource {
  constructor(
    private readonly input: {
      endpoint: string;
      adminSecret: string;
      fetchFn?: typeof fetch;
      pageSize?: number;
    },
  ) {}

  async fetchBounds(completeness: PublishBoundsCompleteness = "cross_chain"): Promise<MetricsBounds> {
    const completenessWhere =
      completeness === "all_chains"
        ? `{ chainsIndexed: { _contains: [${ALL_CHAIN_IDS.join(", ")}] } }`
        : "{ crossChainComplete: { _eq: true } }";
    const body = await this.graphql<{
      earliest?: Array<{ date: string }>;
      latest?: Array<{ date: string }>;
    }>(`
      query Bounds {
        earliest: GlobalMetricSnapshot(
          where: ${completenessWhere}
          limit: 1
          order_by: { date: asc }
        ) { date }
        latest: GlobalMetricSnapshot(
          where: ${completenessWhere}
          limit: 1
          order_by: { date: desc }
        ) { date }
      }
    `);
    const earliestDate = body.earliest?.[0]?.date;
    const latestDate = body.latest?.[0]?.date;
    if (earliestDate === undefined || latestDate === undefined) {
      throw new MetricsNotDataReadyError("Hasura returned no complete GlobalMetricSnapshot bounds.");
    }
    return { earliestDate, latestDate };
  }

  async fetchLatestIndexingProgress(): Promise<LatestIndexingProgress> {
    const body = await this.graphql<Record<string, Array<RawChainIndexingProgress> | undefined>>(`
      query LatestIndexingProgress {
        ${CHAIN_NAMES.map((chainName) => {
          const chainId = chainIdForName(chainName);
          return `
            ${chainProgressAlias(chainName)}: ChainMetricValues(
              where: { chainId: { _eq: ${chainId} } }
              limit: 1
              order_by: { timestamp: desc }
            ) {
              date
              block
            }
          `;
        }).join("\n")}
      }
    `);
    const chainRows = CHAIN_NAMES.flatMap((chainName) => {
      const rows = body[chainProgressAlias(chainName)] as Array<RawChainIndexingProgress> | undefined;
      return chainProgressFromRows(chainName, rows);
    });
    return indexingProgressFromChainRows(chainRows);
  }

  async fetchDailyMetrics(range: DateRange): Promise<DailyMetric[]> {
    const rows = await this.paginate<RawDailyMetric>("GlobalMetricSnapshot", range, DAILY_METRIC_SELECTION);
    return rows.map(normalizeDailyMetric);
  }

  async fetchTreasuryAssets(range: DateRange): Promise<TreasuryAsset[]> {
    const rows = await this.paginate<RawTreasuryAsset>("TokenRecord", range, TREASURY_ASSET_SELECTION);
    return rows.map(normalizeTreasuryAsset);
  }

  async fetchOhmSupply(range: DateRange): Promise<OhmSupply[]> {
    const rows = await this.paginate<RawOhmSupply>("TokenSupply", range, OHM_SUPPLY_SELECTION);
    return rows.map(normalizeOhmSupply);
  }

  private async paginate<T extends { date: string }>(
    entity: string,
    range: DateRange,
    selection: string,
  ): Promise<T[]> {
    const pageSize = this.input.pageSize ?? 1000;
    const rows: T[] = [];
    let offset = 0;

    while (true) {
      const body = await this.graphql<Record<string, T[]>>(
        `
          query Page($start: String!, $end: String!, $limit: Int!, $offset: Int!) {
            ${entity}(
              where: { date: { _gte: $start, _lte: $end } }
              limit: $limit
              offset: $offset
              order_by: { date: asc }
            ) {
              ${selection}
            }
          }
        `,
        { start: range.start, end: range.end, limit: pageSize, offset },
      );
      const batch = body[entity] ?? [];
      rows.push(...batch);
      if (batch.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    return rows;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const fetchFn = this.input.fetchFn ?? fetch;
    const response = await fetchFn(this.input.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hasura-admin-secret": this.input.adminSecret,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Hasura GraphQL request failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as GraphqlResponse<T>;
    if (body.errors && body.errors.length > 0) {
      throw new Error(`Hasura GraphQL error: ${body.errors.map((error) => error.message).join("; ")}`);
    }
    if (body.data === undefined) {
      throw new Error("Hasura GraphQL response did not include data.");
    }
    return body.data;
  }
}

type RawChainMetricValues = {
  blockchain: string;
  block: unknown;
  timestamp: unknown;
  ohmTotalSupply: unknown;
  ohmCirculatingSupply: unknown;
  ohmFloatingSupply: unknown;
  ohmBackedSupply: unknown;
  treasuryMarketValue: unknown;
  treasuryLiquidBacking: unknown;
};

type RawSupplyCategory = {
  category: string;
  balance: unknown;
};

type RawChainIndexingProgress = {
  block: unknown;
  date: string;
};

type RawDailyMetric = {
  date: string;
  crossChainComplete: boolean;
  chainsIndexed: number[];
  chainsMissing: number[];
  chainValues?: RawChainMetricValues[];
  supplyCategories?: RawSupplyCategory[];
  ohmIndex: unknown;
  ohmApy: unknown;
  ohmTotalSupply: unknown;
  ohmCirculatingSupply: unknown;
  ohmFloatingSupply: unknown;
  ohmBackedSupply: unknown;
  gOhmBackedSupply: unknown;
  ohmPrice: unknown;
  gOhmPrice: unknown;
  marketCap: unknown;
  sOhmCirculatingSupply: unknown;
  sOhmTotalValueLocked: unknown;
  treasuryMarketValue: unknown;
  treasuryLiquidBacking: unknown;
  treasuryLiquidBackingPerOhmFloating: unknown;
  treasuryLiquidBackingPerOhmBacked: unknown;
  treasuryLiquidBackingPerGOhmBacked: unknown;
};

type RawTreasuryAsset = Omit<
  TreasuryAsset,
  "balance" | "block" | "blockchain" | "multiplier" | "rate" | "timestamp" | "value" | "valueExcludingOhm"
> & {
  balance: unknown;
  block: unknown;
  blockchain: string;
  multiplier: unknown;
  rate: unknown;
  timestamp: unknown;
  value: unknown;
  valueExcludingOhm: unknown;
};

type RawOhmSupply = Omit<OhmSupply, "balance" | "block" | "blockchain" | "supplyBalance" | "timestamp"> & {
  balance: unknown;
  block: unknown;
  blockchain: string;
  source?: string | null;
  sourceAddress?: string | null;
  supplyBalance: unknown;
  timestamp: unknown;
};

const DAILY_METRIC_SELECTION = `
  date
  crossChainComplete
  chainsIndexed
  chainsMissing
  chainValues {
    blockchain
    block
    timestamp
    ohmTotalSupply
    ohmCirculatingSupply
    ohmFloatingSupply
    ohmBackedSupply
    treasuryMarketValue
    treasuryLiquidBacking
  }
  supplyCategories {
    category
    balance
  }
  ohmIndex
  ohmApy
  ohmTotalSupply
  ohmCirculatingSupply
  ohmFloatingSupply
  ohmBackedSupply
  gOhmBackedSupply
  ohmPrice
  gOhmPrice
  marketCap
  sOhmCirculatingSupply
  sOhmTotalValueLocked
  treasuryMarketValue
  treasuryLiquidBacking
  treasuryLiquidBackingPerOhmFloating
  treasuryLiquidBackingPerOhmBacked
  treasuryLiquidBackingPerGOhmBacked
`;

const TREASURY_ASSET_SELECTION = `
  id
  balance
  block
  blockchain
  category
  date
  isBluechip
  isLiquid
  multiplier
  rate
  source
  sourceAddress
  timestamp
  token
  tokenAddress
  value
  valueExcludingOhm
`;

const OHM_SUPPLY_SELECTION = `
  id
  balance
  block
  blockchain
  date
  pool
  poolAddress
  source
  sourceAddress
  supplyBalance
  timestamp
  token
  tokenAddress
  type
`;

function normalizeDailyMetric(row: RawDailyMetric): DailyMetric {
  const chainsMissing = ALL_CHAIN_IDS.filter((chainId) => !row.chainsIndexed.includes(chainId));
  const blocks = emptyChainValues();
  const timestamps = emptyChainValues();
  const ohmTotalSupplyComponents = emptyChainValues();
  const ohmCirculatingSupplyComponents = emptyChainValues();
  const ohmFloatingSupplyComponents = emptyChainValues();
  const ohmBackedSupplyComponents = emptyChainValues();
  const treasuryMarketValueComponents = emptyChainValues();
  const treasuryLiquidBackingComponents = emptyChainValues();
  const ohmSupplyCategories = emptySupplyCategoryValues();

  for (const chainValues of row.chainValues ?? []) {
    const chain = chainName(chainValues.blockchain);
    blocks[chain] = toNumber(chainValues.block);
    timestamps[chain] = toNumber(chainValues.timestamp);
    ohmTotalSupplyComponents[chain] = toNumber(chainValues.ohmTotalSupply);
    ohmCirculatingSupplyComponents[chain] = toNumber(chainValues.ohmCirculatingSupply);
    ohmFloatingSupplyComponents[chain] = toNumber(chainValues.ohmFloatingSupply);
    ohmBackedSupplyComponents[chain] = toNumber(chainValues.ohmBackedSupply);
    treasuryMarketValueComponents[chain] = toNumber(chainValues.treasuryMarketValue);
    treasuryLiquidBackingComponents[chain] = toNumber(chainValues.treasuryLiquidBacking);
  }

  for (const supplyCategory of row.supplyCategories ?? []) {
    const key = SUPPLY_CATEGORY_TO_LEGACY_KEY[supplyCategory.category];
    if (key !== undefined) {
      ohmSupplyCategories[key] += toNumber(supplyCategory.balance);
    }
  }

  return {
    date: row.date,
    blocks,
    timestamps,
    crossChainComplete: isCrossChainComplete(row.chainsIndexed),
    chainsIndexed: row.chainsIndexed,
    chainsMissing,
    ohmIndex: toNumber(row.ohmIndex),
    ohmApy: toNumber(row.ohmApy),
    ohmTotalSupply: toNumber(row.ohmTotalSupply),
    ohmTotalSupplyComponents,
    ohmCirculatingSupply: toNumber(row.ohmCirculatingSupply),
    ohmCirculatingSupplyComponents,
    ohmFloatingSupply: toNumber(row.ohmFloatingSupply),
    ohmFloatingSupplyComponents,
    ohmBackedSupply: toNumber(row.ohmBackedSupply),
    gOhmBackedSupply: toNumber(row.gOhmBackedSupply),
    ohmBackedSupplyComponents,
    ohmSupplyCategories,
    ohmPrice: toNumber(row.ohmPrice),
    gOhmPrice: toNumber(row.gOhmPrice),
    marketCap: toNumber(row.marketCap),
    sOhmCirculatingSupply: toNumber(row.sOhmCirculatingSupply),
    sOhmTotalValueLocked: toNumber(row.sOhmTotalValueLocked),
    treasuryMarketValue: toNumber(row.treasuryMarketValue),
    treasuryMarketValueComponents,
    treasuryLiquidBacking: toNumber(row.treasuryLiquidBacking),
    treasuryLiquidBackingComponents,
    treasuryLiquidBackingPerOhmFloating: toNumber(row.treasuryLiquidBackingPerOhmFloating),
    treasuryLiquidBackingPerOhmBacked: toNumber(row.treasuryLiquidBackingPerOhmBacked),
    treasuryLiquidBackingPerGOhmBacked: toNumber(row.treasuryLiquidBackingPerGOhmBacked),
  };
}

function indexingProgressFromChainRows(
  chainRows: Array<RawChainIndexingProgress & { chainName?: ChainName }>,
): LatestIndexingProgress {
  const chains: Partial<Record<ChainName, ChainIndexingProgress>> = {};
  for (const chainRow of chainRows) {
    if (chainRow.chainName === undefined) {
      continue;
    }
    chains[chainRow.chainName] = {
      block: toNumber(chainRow.block),
      date: chainRow.date,
    };
  }
  return { chains };
}

function chainIdForName(chainName: ChainName): number {
  switch (chainName) {
    case "Arbitrum":
      return 42161;
    case "Ethereum":
      return 1;
    case "Fantom":
      return 250;
    case "Polygon":
      return 137;
    case "Base":
      return 8453;
    case "Berachain":
      return 80094;
  }
}

function chainProgressFromRows(
  chainName: ChainName,
  rows: RawChainIndexingProgress[] | undefined,
): Array<RawChainIndexingProgress & { chainName: ChainName }> {
  return (rows ?? []).map((row) => ({ ...row, chainName }));
}

function chainProgressAlias(chainName: ChainName): string {
  return `${chainName.toLowerCase()}Progress`;
}

function normalizeTreasuryAsset(row: RawTreasuryAsset): TreasuryAsset {
  return {
    ...row,
    balance: toNumber(row.balance),
    block: toNumber(row.block),
    blockchain: chainName(row.blockchain),
    multiplier: toNumber(row.multiplier),
    rate: toNumber(row.rate),
    timestamp: toNumber(row.timestamp),
    value: toNumber(row.value),
    valueExcludingOhm: toNumber(row.valueExcludingOhm),
  };
}

function normalizeOhmSupply(row: RawOhmSupply): OhmSupply {
  return {
    ...row,
    balance: toNumber(row.balance),
    block: toNumber(row.block),
    blockchain: chainName(row.blockchain),
    source: row.source ?? "",
    sourceAddress: row.sourceAddress ?? "",
    supplyBalance: toNumber(row.supplyBalance),
    timestamp: toNumber(row.timestamp),
  };
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(String(value));
}

function chainName(value: string): ChainName {
  if ((CHAIN_NAMES as readonly string[]).includes(value)) {
    return value as ChainName;
  }
  throw new Error(`Unknown chain name: ${value}`);
}
