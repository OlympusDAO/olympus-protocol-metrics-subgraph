#!/usr/bin/env tsx

// Per-(chain, source, token) drill-down comparing Envio TokenRecord against
// the legacy treasury-subgraph paginatedTokenRecords. Used to localise the
// ~$900K treasuryLiquidBacking residual seen in the daily parity check.
//
// For each unique (chainId, sourceAddress, tokenAddress) pair on either
// side, take the row from the LATEST block on that date — this mirrors
// how the daily aggregate is computed (last snapshot per chain wins) —
// then diff `value` and `valueExcludingOhm`.
//
// Run via:
//   pnpm exec tsx scripts/parity-records.ts --date 2026-05-20 \
//     --envio https://indexer.hyperindex.xyz/3eaa1ec/v1/graphql \
//     --treasury https://olympus-treasury-subgraph-prod.web.app/graphql
//
// The script:
//   1. Confirms aggregate parity (liquidBacking on both sides + the diff)
//   2. Lists top divergent (chain, source, token) rows by abs(value diff)
//   3. Lists rows present on only one side

import { argv, exit } from "node:process";

type Cli = {
  date: string;
  envioUrl: string;
  treasuryUrl: string;
  top: number;
  filterLiquid: boolean;
};

type Row = {
  date: string;
  block: number;
  chainId?: number;
  blockchain: string;
  tokenAddress: string;
  token: string;
  sourceAddress: string;
  source: string;
  rate: number;
  balance: number;
  multiplier: number;
  value: number;
  valueExcludingOhm: number;
  isLiquid: boolean;
  category: string;
};

const CHAIN_NAME_TO_ID: Record<string, number> = {
  Ethereum: 1,
  "Mainnet": 1,
  Polygon: 137,
  Fantom: 250,
  Base: 8453,
  Arbitrum: 42161,
  Berachain: 80094,
};

function parseArgs(): Cli {
  const map: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) continue;
    map[key] = value;
  }
  if (!map.date) throw new Error("Pass --date YYYY-MM-DD");
  return {
    date: map.date,
    envioUrl: map.envio ?? "",
    treasuryUrl: map.treasury ?? "",
    top: Number(map.top ?? "30"),
    filterLiquid: map["only-liquid"] !== "false",
  };
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value));
}

function normaliseRow(raw: Record<string, unknown>): Row {
  const blockchain = String(raw.blockchain ?? "");
  const chainId =
    typeof raw.chainId === "number"
      ? raw.chainId
      : CHAIN_NAME_TO_ID[blockchain] ?? undefined;
  return {
    date: String(raw.date),
    block: Number(raw.block ?? 0),
    chainId,
    blockchain,
    tokenAddress: String(raw.tokenAddress).toLowerCase(),
    token: String(raw.token),
    sourceAddress: String(raw.sourceAddress).toLowerCase(),
    source: String(raw.source),
    rate: toNumber(raw.rate),
    balance: toNumber(raw.balance),
    multiplier: toNumber(raw.multiplier),
    value: toNumber(raw.value),
    valueExcludingOhm: toNumber(raw.valueExcludingOhm),
    isLiquid: Boolean(raw.isLiquid),
    category: String(raw.category ?? ""),
  };
}

async function fetchEnvio(url: string, date: string): Promise<Row[]> {
  const rows: Row[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const query = `
      query Records($date: String!, $limit: Int!, $offset: Int!) {
        TokenRecord(where: { date: { _eq: $date } }, limit: $limit, offset: $offset) {
          date block chainId blockchain tokenAddress token
          sourceAddress source rate balance multiplier
          value valueExcludingOhm isLiquid category
        }
      }
    `;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { date, limit: PAGE, offset } }),
    });
    if (!response.ok) throw new Error(`Envio fetch failed: ${response.status}`);
    const body = (await response.json()) as { data?: { TokenRecord?: Record<string, unknown>[] } };
    const batch = body.data?.TokenRecord ?? [];
    rows.push(...batch.map(normaliseRow));
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function fetchTreasury(url: string, date: string): Promise<Row[]> {
  // dateOffset=2 means the endpoint may include date+1; clamp client-side.
  const query = `
    query Records($start: String!, $offset: Int!) {
      paginatedTokenRecords(startDate: $start, dateOffset: $offset) {
        date block blockchain tokenAddress token
        sourceAddress source rate balance multiplier
        value valueExcludingOhm isLiquid category
      }
    }
  `;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { start: date, offset: 2 } }),
  });
  if (!response.ok) throw new Error(`Treasury fetch failed: ${response.status}`);
  const body = (await response.json()) as {
    data?: { paginatedTokenRecords?: Record<string, unknown>[] };
  };
  return (body.data?.paginatedTokenRecords ?? [])
    .map(normaliseRow)
    .filter((row) => row.date === date);
}

// Daily-aggregate semantics: for each chain, take the LATEST block on the
// date and use all rows from that block. (Multiple records with the same
// chain+source+tokenAddress in one block represent distinct underlying
// positions — e.g. cash balance + Cooler receivable both denominated in
// DAI — and must NOT be deduped.) Then group rows by
// (chain, source, tokenAddress) and SUM their values within the group so
// the per-pair diff matches how the daily aggregate sees it.
function latestBlockPerChain(rows: Row[]): Map<number | string, number> {
  const latest = new Map<number | string, number>();
  for (const row of rows) {
    const key = row.chainId ?? row.blockchain;
    const current = latest.get(key) ?? 0;
    if (row.block > current) latest.set(key, row.block);
  }
  return latest;
}

type Aggregated = {
  chainId?: number | string;
  blockchain: string;
  source: string;
  sourceAddress: string;
  token: string; // representative; multiple tokens can share an address
  tokenAddress: string;
  value: number;
  valueExcludingOhm: number;
  isLiquid: boolean;
  rowCount: number;
};

function aggregateAtLatestBlock(rows: Row[]): Map<string, Aggregated> {
  const latest = latestBlockPerChain(rows);
  const agg = new Map<string, Aggregated>();
  for (const row of rows) {
    const chainKey = row.chainId ?? row.blockchain;
    if (row.block !== latest.get(chainKey)) continue;
    const pairKey = `${chainKey}|${row.sourceAddress}|${row.tokenAddress}`;
    const existing = agg.get(pairKey);
    if (existing) {
      existing.value += row.value;
      existing.valueExcludingOhm += row.valueExcludingOhm;
      existing.rowCount += 1;
      // isLiquid: any row in the group being liquid makes the pair liquid
      existing.isLiquid = existing.isLiquid || row.isLiquid;
    } else {
      agg.set(pairKey, {
        chainId: row.chainId,
        blockchain: row.blockchain,
        source: row.source,
        sourceAddress: row.sourceAddress,
        token: row.token,
        tokenAddress: row.tokenAddress,
        value: row.value,
        valueExcludingOhm: row.valueExcludingOhm,
        isLiquid: row.isLiquid,
        rowCount: 1,
      });
    }
  }
  return agg;
}

function sumLiquidValue(
  rows: Iterable<Aggregated>,
  field: "value" | "valueExcludingOhm",
): number {
  let total = 0;
  for (const row of rows) {
    if (!row.isLiquid) continue;
    total += row[field];
  }
  return total;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.envioUrl || !args.treasuryUrl) {
    console.error("Both --envio and --treasury URLs are required.");
    exit(1);
  }

  const [envioRows, treasuryRows] = await Promise.all([
    fetchEnvio(args.envioUrl, args.date),
    fetchTreasury(args.treasuryUrl, args.date),
  ]);

  const envioByPair = aggregateAtLatestBlock(envioRows);
  const treasuryByPair = aggregateAtLatestBlock(treasuryRows);

  const envioLB = sumLiquidValue(envioByPair.values(), "valueExcludingOhm");
  const treasuryLB = sumLiquidValue(treasuryByPair.values(), "valueExcludingOhm");
  const envioMV = sumLiquidValue(envioByPair.values(), "value");
  const treasuryMV = sumLiquidValue(treasuryByPair.values(), "value");

  console.log(`# Parity drill-down for ${args.date}`);
  console.log(`# Envio rows: ${envioRows.length}, unique pairs: ${envioByPair.size}`);
  console.log(`# Treasury rows: ${treasuryRows.length}, unique pairs: ${treasuryByPair.size}`);
  console.log("");
  console.log("## Aggregate (liquid only, sum across latest-block-per-pair)");
  console.log(`liquidBacking (valueExcludingOhm): envio=${envioLB.toFixed(2)} treasury=${treasuryLB.toFixed(2)} diff=${(envioLB - treasuryLB).toFixed(2)}`);
  console.log(`liquidValue   (value)            : envio=${envioMV.toFixed(2)} treasury=${treasuryMV.toFixed(2)} diff=${(envioMV - treasuryMV).toFixed(2)}`);
  console.log("");

  type Divergence = {
    blockchain: string;
    source: string;
    token: string;
    envioValue: number;
    treasuryValue: number;
    diff: number;
    presence: "both" | "envio-only" | "treasury-only";
  };

  const allKeys = new Set([...envioByPair.keys(), ...treasuryByPair.keys()]);
  const divergences: Divergence[] = [];
  for (const key of allKeys) {
    const e = envioByPair.get(key);
    const t = treasuryByPair.get(key);
    if (args.filterLiquid && !(e?.isLiquid ?? t?.isLiquid)) continue;
    const eV = e?.valueExcludingOhm ?? 0;
    const tV = t?.valueExcludingOhm ?? 0;
    const diff = eV - tV;
    if (Math.abs(diff) < 0.01) continue;
    divergences.push({
      blockchain: e?.blockchain ?? t?.blockchain ?? "",
      source: e?.source ?? t?.source ?? "",
      token: e?.token ?? t?.token ?? "",
      envioValue: eV,
      treasuryValue: tV,
      diff,
      presence: e && t ? "both" : e ? "envio-only" : "treasury-only",
    });
  }

  divergences.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log(`## Top ${args.top} divergences by |diff| (liquid-only=${args.filterLiquid})`);
  console.log("rank,blockchain,source,token,envio_xohm,treasury_xohm,diff,presence");
  for (const [idx, d] of divergences.slice(0, args.top).entries()) {
    console.log(
      [
        idx + 1,
        d.blockchain,
        `"${d.source.replace(/"/g, "'")}"`,
        `"${d.token.replace(/"/g, "'")}"`,
        d.envioValue.toFixed(2),
        d.treasuryValue.toFixed(2),
        d.diff.toFixed(2),
        d.presence,
      ].join(","),
    );
  }

  const totalDiff = divergences.reduce((s, d) => s + d.diff, 0);
  console.log("");
  console.log(`## Diff total across ${divergences.length} divergent pairs: ${totalDiff.toFixed(2)}`);
  console.log(`## (For sanity: should approximate aggregate liquidBacking diff above.)`);
}

main().catch((error: unknown) => {
  console.error(error);
  exit(1);
});
