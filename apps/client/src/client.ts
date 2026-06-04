import type {
  ApiResponse,
  BoundsResponse,
  DailyMetric,
  IgnoreCacheInput,
  OhmSupply,
  Operations,
  PaginatedMetricsInput,
  PaginatedProtocolMetricsInput,
  PaginatedTokenRecordsInput,
  PaginatedTokenSuppliesInput,
  ProtocolMetric,
  TokenRecord,
  TokenSupply,
  TreasuryAsset,
} from "../../../packages/metrics-artifacts/src/types.js";

export const DEFAULT_BASE_URL = "https://treasury-subgraph-api.olympusdao.finance";

type DailyRangeInput = {
  start: string;
  end?: string;
  autoPaginate?: boolean;
};

type DailyMetricsInput = DailyRangeInput & {
  includeRecords?: boolean;
};

export type ClientConfig = {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  timeout?: number;
};

export class TreasurySubgraphClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly timeout: number | undefined;
  private boundsPromise: Promise<BoundsResponse> | undefined;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = trimTrailingSlashes(config.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = config.fetch ?? ((...args) => globalThis.fetch(...args));
    this.headers = config.headers ?? {};
    this.timeout = config.timeout;
  }

  async query<OperationName extends keyof Operations>(params: {
    operationName: OperationName;
    input?: Operations[OperationName]["input"];
  }): Promise<Operations[OperationName]["response"]>;
  async query(params: { operationName: string; input?: Record<string, unknown> }): Promise<unknown>;
  async query(params: { operationName: string; input?: Record<string, unknown> }): Promise<unknown> {
    const url = this.url(getLegacyOperationPath(params.operationName));
    if (params.input !== undefined) {
      url.searchParams.set("wg_variables", JSON.stringify(params.input));
    }
    return this.fetchJson(url);
  }

  /** @deprecated Use `getDailyMetrics` or `query({ operationName: "latest/metrics" })` instead. */
  async getLatestMetrics(input?: IgnoreCacheInput): Promise<Operations["latest/metrics"]["response"]> {
    return this.query({ operationName: "latest/metrics", input });
  }

  /** @deprecated Use `getDailyMetrics` or `query({ operationName: "earliest/metrics" })` instead. */
  async getEarliestMetrics(input?: IgnoreCacheInput): Promise<Operations["earliest/metrics"]["response"]> {
    return this.query({ operationName: "earliest/metrics", input });
  }

  /** @deprecated Use `getDailyMetrics` or `query({ operationName: "paginated/metrics" })` instead. */
  async getPaginatedMetrics(input: PaginatedMetricsInput): Promise<Operations["paginated/metrics"]["response"]> {
    return this.query({ operationName: "paginated/metrics", input });
  }

  /** @deprecated Use `getDailyTreasuryAssets` or `query({ operationName: "latest/tokenRecords" })` instead. */
  async getLatestTokenRecords(input?: IgnoreCacheInput): Promise<Operations["latest/tokenRecords"]["response"]> {
    return this.query({ operationName: "latest/tokenRecords", input });
  }

  /** @deprecated Use `getDailyTreasuryAssets` or `query({ operationName: "earliest/tokenRecords" })` instead. */
  async getEarliestTokenRecords(input?: IgnoreCacheInput): Promise<Operations["earliest/tokenRecords"]["response"]> {
    return this.query({ operationName: "earliest/tokenRecords", input });
  }

  /** @deprecated Use `getDailyTreasuryAssets` or `query({ operationName: "paginated/tokenRecords" })` instead. */
  async getPaginatedTokenRecords(
    input: PaginatedTokenRecordsInput,
  ): Promise<Operations["paginated/tokenRecords"]["response"]> {
    return this.query({ operationName: "paginated/tokenRecords", input });
  }

  /** @deprecated Use `getDailyOhmSupply` or `query({ operationName: "latest/tokenSupplies" })` instead. */
  async getLatestTokenSupplies(input?: IgnoreCacheInput): Promise<Operations["latest/tokenSupplies"]["response"]> {
    return this.query({ operationName: "latest/tokenSupplies", input });
  }

  /** @deprecated Use `getDailyOhmSupply` or `query({ operationName: "earliest/tokenSupplies" })` instead. */
  async getEarliestTokenSupplies(input?: IgnoreCacheInput): Promise<Operations["earliest/tokenSupplies"]["response"]> {
    return this.query({ operationName: "earliest/tokenSupplies", input });
  }

  /** @deprecated Use `getDailyOhmSupply` or `query({ operationName: "paginated/tokenSupplies" })` instead. */
  async getPaginatedTokenSupplies(
    input: PaginatedTokenSuppliesInput,
  ): Promise<Operations["paginated/tokenSupplies"]["response"]> {
    return this.query({ operationName: "paginated/tokenSupplies", input });
  }

  /** @deprecated Use `query({ operationName: "latest/protocolMetrics" })` only for legacy compatibility. */
  async getLatestProtocolMetrics(input?: IgnoreCacheInput): Promise<Operations["latest/protocolMetrics"]["response"]> {
    return this.query({ operationName: "latest/protocolMetrics", input });
  }

  /** @deprecated Use `query({ operationName: "earliest/protocolMetrics" })` only for legacy compatibility. */
  async getEarliestProtocolMetrics(
    input?: IgnoreCacheInput,
  ): Promise<Operations["earliest/protocolMetrics"]["response"]> {
    return this.query({ operationName: "earliest/protocolMetrics", input });
  }

  /** @deprecated Use `query({ operationName: "paginated/protocolMetrics" })` only for legacy compatibility. */
  async getPaginatedProtocolMetrics(
    input: PaginatedProtocolMetricsInput,
  ): Promise<Operations["paginated/protocolMetrics"]["response"]> {
    return this.query({ operationName: "paginated/protocolMetrics", input });
  }

  async getBounds(): Promise<BoundsResponse> {
    return this.fetchData<BoundsResponse>(this.url("/v2/bounds"));
  }

  async getDailyMetrics(input: DailyMetricsInput): Promise<DailyMetric[]> {
    if (input.autoPaginate) {
      return this.fetchAutoPaginated<DailyMetric>("/v2/metrics/daily", input, (url) => {
        if (input.includeRecords !== undefined) {
          url.searchParams.set("includeRecords", String(input.includeRecords));
        }
      });
    }

    const url = this.url("/v2/metrics/daily");
    appendRange(url, input);
    if (input.includeRecords !== undefined) {
      url.searchParams.set("includeRecords", String(input.includeRecords));
    }
    return this.fetchData<DailyMetric[]>(url);
  }

  async getDailyTreasuryAssets(input: DailyRangeInput): Promise<TreasuryAsset[]> {
    if (input.autoPaginate) {
      return this.fetchAutoPaginated<TreasuryAsset>("/v2/treasury-assets/daily", input);
    }

    const url = this.url("/v2/treasury-assets/daily");
    appendRange(url, input);
    return this.fetchData<TreasuryAsset[]>(url);
  }

  async getDailyOhmSupply(input: DailyRangeInput): Promise<OhmSupply[]> {
    if (input.autoPaginate) {
      return this.fetchAutoPaginated<OhmSupply>("/v2/ohm-supply/daily", input);
    }

    const url = this.url("/v2/ohm-supply/daily");
    appendRange(url, input);
    return this.fetchData<OhmSupply[]>(url);
  }

  private url(path: string): URL {
    return new URL(path, `${this.baseUrl}/`);
  }

  private async fetchData<T>(url: URL): Promise<T> {
    const response = (await this.fetchJson(url)) as ApiResponse<T>;
    return response.data;
  }

  private async fetchAutoPaginated<T>(
    path: string,
    input: DailyRangeInput,
    configureUrl?: (url: URL) => void,
  ): Promise<T[]> {
    const bounds = await this.getCachedBounds();
    const chunks = splitRange({
      start: input.start,
      end: input.end ?? bounds.latestDate,
      maxDays: bounds.maxRangeDays,
    });
    const pages = await Promise.all(
      chunks.map((chunk) => {
        const url = this.url(path);
        appendRange(url, chunk);
        configureUrl?.(url);
        return this.fetchData<T[]>(url);
      }),
    );
    return pages.flat();
  }

  private getCachedBounds(): Promise<BoundsResponse> {
    this.boundsPromise ??= this.getBounds().catch((error: unknown) => {
      this.boundsPromise = undefined;
      throw error;
    });
    return this.boundsPromise;
  }

  private async fetchJson(url: URL): Promise<unknown> {
    const controller =
      this.timeout === undefined || typeof AbortController === "undefined"
        ? undefined
        : new AbortController();
    const timeoutId =
      controller === undefined ? undefined : setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: this.headers,
        signal: controller?.signal,
      });
      if (!response.ok) {
        throw new Error(`Metrics API request failed with status ${response.status}`);
      }
      return response.json();
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}

function appendRange(url: URL, input: { start: string; end?: string }): void {
  url.searchParams.set("start", input.start);
  if (input.end !== undefined) {
    url.searchParams.set("end", input.end);
  }
}

function splitRange(input: { start: string; end: string; maxDays: number }): Array<{ start: string; end: string }> {
  if (input.maxDays < 1) {
    throw new Error(`maxRangeDays must be greater than zero, got ${input.maxDays}`);
  }

  const start = parseDate(input.start);
  const end = parseDate(input.end);
  if (end.getTime() < start.getTime()) {
    throw new Error("end must be greater than or equal to start");
  }

  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const chunkEnd = new Date(Math.min(end.getTime(), cursor.getTime() + (input.maxDays - 1) * DAY_MS));
    chunks.push({ start: formatDate(cursor), end: formatDate(chunkEnd) });
    cursor = new Date(chunkEnd.getTime() + DAY_MS);
  }
  return chunks;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createClient(config?: ClientConfig): TreasurySubgraphClient {
  return new TreasurySubgraphClient(config);
}

function getLegacyOperationPath(operationName: string): string {
  return `/operations/${operationName}`;
}

export type {
  IgnoreCacheInput,
  Operations,
  PaginatedMetricsInput,
  PaginatedProtocolMetricsInput,
  PaginatedTokenRecordsInput,
  PaginatedTokenSuppliesInput,
  ProtocolMetric,
  TokenRecord,
  TokenSupply,
};
