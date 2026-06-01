import { describe, expect, test, vi } from "vitest";

import { createClient } from "../../apps/client/src";

describe("@olympusdao/treasury-subgraph-client compatibility", () => {
  test("legacy query maps to /operations with wg_variables", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.query({
      operationName: "paginated/metrics",
      input: { startDate: "2026-05-20", dateOffset: 30 },
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    const url = new URL(calls[0][0]);
    expect(url.pathname).toBe("/operations/paginated/metrics");
    expect(JSON.parse(url.searchParams.get("wg_variables") ?? "{}")).toEqual({
      startDate: "2026-05-20",
      dateOffset: 30,
    });
  });

  test("new methods map to semantic v2 routes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], meta: {} })));
    const client = createClient({ baseUrl: "https://metrics.example", fetch: fetchMock });

    await client.getDailyTreasuryAssets({ start: "2026-05-20" });
    await client.getDailyOhmSupply({ start: "2026-05-20" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
    expect(new URL(calls[0][0]).pathname).toBe("/v2/treasury-assets/daily");
    expect(new URL(calls[1][0]).pathname).toBe("/v2/ohm-supply/daily");
  });
});
