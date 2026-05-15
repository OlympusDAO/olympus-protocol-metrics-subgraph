#!/usr/bin/env tsx

// Parity harness: diff Envio GlobalMetricSnapshot output against the legacy
// treasury-subgraph endpoint for a given UTC date or date range. Phase 1
// decision: start with exact-match expectation, relax thresholds only with
// explicit approval.
//
// Run via:
//   pnpm exec tsx scripts/parity-diff.ts --date 2024-09-01 \
//     --envio https://your-envio-endpoint.example/v1/graphql \
//     --treasury https://treasury.olympusdao.finance/graphql
//
// The script fetches Metric for the date(s) from both sources, normalizes
// numerics, and emits a CSV-style line per (date, field) where the values
// differ beyond the tolerance (default 0 — exact match).

import { argv, exit } from "node:process";

type CliArgs = {
  startDate: string;
  endDate: string;
  envioUrl: string;
  treasuryUrl: string;
  tolerance: number;
  includeRecords: boolean;
};

function parseArgs(): CliArgs {
  const map: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) continue;
    map[key] = value;
  }
  const date = map.date;
  if (date) {
    return {
      startDate: date,
      endDate: date,
      envioUrl: map.envio ?? "",
      treasuryUrl: map.treasury ?? "",
      tolerance: Number(map.tolerance ?? "0"),
      includeRecords: map["include-records"] === "true",
    };
  }
  if (!map.start || !map.end) {
    throw new Error("Pass either --date YYYY-MM-DD or --start YYYY-MM-DD --end YYYY-MM-DD");
  }
  return {
    startDate: map.start,
    endDate: map.end,
    envioUrl: map.envio ?? "",
    treasuryUrl: map.treasury ?? "",
    tolerance: Number(map.tolerance ?? "0"),
    includeRecords: map["include-records"] === "true",
  };
}

// Canonical Metric field list. Order matters for CSV reading; mirrors the
// legacy Metric type in inventory-treasury-subgraph.md §8.
const METRIC_FIELDS = [
  "ohmIndex",
  "ohmApy",
  "ohmTotalSupply",
  "ohmCirculatingSupply",
  "ohmFloatingSupply",
  "ohmBackedSupply",
  "gOhmBackedSupply",
  "ohmPrice",
  "gOhmPrice",
  "marketCap",
  "sOhmCirculatingSupply",
  "sOhmTotalValueLocked",
  "treasuryMarketValue",
  "treasuryLiquidBacking",
  "treasuryLiquidBackingPerOhmFloating",
  "treasuryLiquidBackingPerOhmBacked",
  "treasuryLiquidBackingPerGOhmBacked",
] as const;

type MetricRow = Partial<Record<(typeof METRIC_FIELDS)[number], number>> & {
  date: string;
};

async function fetchEnvio(url: string, startDate: string, endDate: string): Promise<MetricRow[]> {
  // Envio's GraphQL surface mirrors the schema entity names. Field set is the
  // subset of GlobalMetricSnapshot covered by the parity check.
  const query = `
    query Metric($start: String!, $end: String!) {
      GlobalMetricSnapshot(where: { date: { _gte: $start, _lte: $end } }, order_by: { date: desc }) {
        date
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
      }
    }
  `;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { start: startDate, end: endDate } }),
  });
  if (!response.ok) {
    throw new Error(`Envio fetch failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { data?: { GlobalMetricSnapshot?: MetricRow[] } };
  return body.data?.GlobalMetricSnapshot ?? [];
}

async function fetchTreasury(
  url: string,
  startDate: string,
  endDate: string,
): Promise<MetricRow[]> {
  // Legacy treasury-subgraph endpoint surfaces the `metrics(startDate, endDate)`
  // GraphQL query that returns the Metric[] array. See
  // treasury-subgraph/apps/server/src/graphql/schema.ts.
  const query = `
    query Metrics($start: String!, $end: String!) {
      metrics(startDate: $start, endDate: $end) {
        date
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
      }
    }
  `;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { start: startDate, end: endDate } }),
  });
  if (!response.ok) {
    throw new Error(`Treasury fetch failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { data?: { metrics?: MetricRow[] } };
  return body.data?.metrics ?? [];
}

function diffRows(
  envioByDate: Map<string, MetricRow>,
  treasuryByDate: Map<string, MetricRow>,
  tolerance: number,
): string[] {
  const lines: string[] = [];
  lines.push(["date", "field", "envio", "treasury", "diff"].join(","));
  const allDates = new Set([...envioByDate.keys(), ...treasuryByDate.keys()]);
  for (const date of [...allDates].sort()) {
    const envio = envioByDate.get(date);
    const treasury = treasuryByDate.get(date);
    if (!envio || !treasury) {
      const missing = !envio ? "envio" : "treasury";
      lines.push([date, "_meta", missing === "envio" ? "" : "1", missing === "envio" ? "1" : "", "MISSING"].join(","));
      continue;
    }
    for (const field of METRIC_FIELDS) {
      const a = Number(envio[field] ?? 0);
      const b = Number(treasury[field] ?? 0);
      const diff = Math.abs(a - b);
      if (diff > tolerance) {
        lines.push([date, field, String(a), String(b), String(diff)].join(","));
      }
    }
  }
  return lines;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.envioUrl || !args.treasuryUrl) {
    console.error("Both --envio and --treasury URLs are required.");
    exit(1);
  }
  const [envioRows, treasuryRows] = await Promise.all([
    fetchEnvio(args.envioUrl, args.startDate, args.endDate),
    fetchTreasury(args.treasuryUrl, args.startDate, args.endDate),
  ]);
  const envioByDate = new Map(envioRows.map((row) => [row.date, row]));
  const treasuryByDate = new Map(treasuryRows.map((row) => [row.date, row]));
  const lines = diffRows(envioByDate, treasuryByDate, args.tolerance);
  for (const line of lines) console.log(line);
  // Exit non-zero if any non-header rows were emitted — useful for CI gating.
  if (lines.length > 1) exit(2);
}

main().catch((error: unknown) => {
  console.error(error);
  exit(1);
});
