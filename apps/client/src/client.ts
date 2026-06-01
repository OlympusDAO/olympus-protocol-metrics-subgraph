import type {
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

export class TreasurySubgraphClient {
  constructor(_config: ClientConfig = {}) {}

  async query(_params: { operationName: string; input?: Record<string, unknown> }): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async getBounds(): Promise<BoundsResponse> {
    throw new Error("Not implemented");
  }

  async getDailyMetrics(_input: {
    start: string;
    end?: string;
    includeRecords?: boolean;
  }): Promise<DailyMetric[]> {
    throw new Error("Not implemented");
  }

  async getDailyTreasuryAssets(_input: { start: string; end?: string }): Promise<TreasuryAsset[]> {
    throw new Error("Not implemented");
  }

  async getDailyOhmSupply(_input: { start: string; end?: string }): Promise<OhmSupply[]> {
    throw new Error("Not implemented");
  }
}

export function createClient(config?: ClientConfig): TreasurySubgraphClient {
  return new TreasurySubgraphClient(config);
}
