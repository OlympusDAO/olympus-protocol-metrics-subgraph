import type {
  ApiResponse,
  BoundsResponse,
  DailyMetric,
  OhmSupply,
  TreasuryAsset,
} from "../../../packages/metrics-artifacts/src";

export type ClientConfig = {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeout?: number;
};

type QueryInput = Record<string, unknown>;

export class TreasurySubgraphClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number | undefined;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? fetch;
    this.timeout = config.timeout;
  }

  async query(params: { operationName: string; input?: QueryInput }): Promise<unknown> {
    const url = this.url(`/operations/${params.operationName}`);
    if (params.input !== undefined) {
      url.searchParams.set("wg_variables", JSON.stringify(params.input));
    }
    return this.fetchJson(url);
  }

  async getBounds(): Promise<BoundsResponse> {
    return this.fetchData<BoundsResponse>(this.url("/v2/bounds"));
  }

  async getDailyMetrics(input: {
    start: string;
    end?: string;
    includeRecords?: boolean;
  }): Promise<DailyMetric[]> {
    const url = this.url("/v2/metrics/daily");
    appendRange(url, input);
    if (input.includeRecords !== undefined) {
      url.searchParams.set("includeRecords", String(input.includeRecords));
    }
    return this.fetchData<DailyMetric[]>(url);
  }

  async getDailyTreasuryAssets(input: { start: string; end?: string }): Promise<TreasuryAsset[]> {
    const url = this.url("/v2/treasury-assets/daily");
    appendRange(url, input);
    return this.fetchData<TreasuryAsset[]>(url);
  }

  async getDailyOhmSupply(input: { start: string; end?: string }): Promise<OhmSupply[]> {
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

export function createClient(config?: ClientConfig): TreasurySubgraphClient {
  return new TreasurySubgraphClient(config);
}
