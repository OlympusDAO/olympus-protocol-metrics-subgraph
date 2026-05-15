# Treasury-Subgraph Middleware Inventory

Reference for Phase 5 of the Envio multichain migration. All citations are relative to this file's location (`docs/envio-migration/`), so three `..` segments reach the sibling repo root.

---

## 1. Repo Layout

`apps/server/src/core/` contains eight helper modules that are pure TypeScript with no I/O side-effects — all computation happens in memory over plain data objects.

| File | Purpose |
|---|---|
| [`constants.ts`](../../../treasury-subgraph/apps/server/src/core/constants.ts) | Chain name strings, token supply type strings, asset category strings, and two enums (`Chains`, `TokenSupplyCategories`). |
| [`dateHelper.ts`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts) | UTC date arithmetic: ISO-8601 string formatting, sliding-window start/end date computation for paginated subgraph fetches. |
| [`numberHelper.ts`](../../../treasury-subgraph/apps/server/src/core/numberHelper.ts) | Single exported function `parseNumber` that converts `string | number | undefined` to a JS `number`. |
| [`types.ts`](../../../treasury-subgraph/apps/server/src/core/types.ts) | Raw entity interfaces (`TokenRecord`, `TokenSupply`, `ProtocolMetric`) and their per-chain response bag types, plus a `Logger` interface and `ConsoleLogger` implementation. |
| [`tokenRecordHelper.ts`](../../../treasury-subgraph/apps/server/src/core/tokenRecordHelper.ts) | Filters, sorts, and flattens cross-chain `TokenRecord` arrays; includes the canonical cross-chain completeness check. |
| [`tokenSupplyHelper.ts`](../../../treasury-subgraph/apps/server/src/core/tokenSupplyHelper.ts) | Same filter/sort/flatten operations for `TokenSupply` arrays; adds `blockchain` property stamping. |
| [`protocolMetricHelper.ts`](../../../treasury-subgraph/apps/server/src/core/protocolMetricHelper.ts) | Filter/sort/flatten for `ProtocolMetric` arrays; no supply arithmetic of its own. |
| [`metricHelper.ts`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts) | Central aggregation: produces the `Metric` object (the public API output) from all three entity arrays. Contains every supply formula, treasury value formula, and derived ratio. |

**GraphQL endpoint definition** — The public schema is declared in [`apps/server/src/graphql/schema.ts`](../../../treasury-subgraph/apps/server/src/graphql/schema.ts) as an Apollo `gql` template and served by an Express + Apollo Server stack defined in [`apps/server/src/index.ts`](../../../treasury-subgraph/apps/server/src/index.ts) at `/graphql`. A parallel REST shim (WunderGraph-compatible) is mounted at `/operations` via [`apps/server/src/rest/index.ts`](../../../treasury-subgraph/apps/server/src/rest/index.ts). The resolver layer ([`apps/server/src/graphql/resolvers.ts`](../../../treasury-subgraph/apps/server/src/graphql/resolvers.ts)) orchestrates subgraph fan-out, data merging, and calls `getMetricObject` from `metricHelper.ts`.

---

## 2. Constants

[`constants.ts`](../../../treasury-subgraph/apps/server/src/core/constants.ts)

### Chain name strings (L1–L6)

```
CHAIN_ARBITRUM = "Arbitrum"
CHAIN_ETHEREUM = "Ethereum"
CHAIN_FANTOM   = "Fantom"
CHAIN_POLYGON  = "Polygon"
CHAIN_BASE     = "Base"
CHAIN_BERACHAIN = "Berachain"
```

Used as both display strings and as `blockchain` property values on records. The `Chains` enum (L8–L15) mirrors these exactly and is used as `Record<Chains, …>` key type throughout `metricHelper.ts`.

### Token supply type strings (L17–L26)

String constants that match the `type` field emitted by the per-chain subgraphs:

| Constant | String value |
|---|---|
| `TOKEN_SUPPLY_TYPE_BONDS_DEPOSITS` | `"OHM Bonds (Burnable Deposits)"` |
| `TOKEN_SUPPLY_TYPE_BONDS_PREMINTED` | `"OHM Bonds (Pre-minted)"` |
| `TOKEN_SUPPLY_TYPE_BONDS_VESTING_DEPOSITS` | `"OHM Bonds (Vesting Deposits)"` |
| `TOKEN_SUPPLY_TYPE_BONDS_VESTING_TOKENS` | `"OHM Bonds (Vesting Tokens)"` |
| `TOKEN_SUPPLY_TYPE_LIQUIDITY` | `"Liquidity"` |
| `TOKEN_SUPPLY_TYPE_BOOSTED_LIQUIDITY_VAULT` | `"Boosted Liquidity Vault"` |
| `TOKEN_SUPPLY_TYPE_OFFSET` | `"Manual Offset"` |
| `TOKEN_SUPPLY_TYPE_TOTAL_SUPPLY` | `"Total Supply"` |
| `TOKEN_SUPPLY_TYPE_TREASURY` | `"Treasury"` |
| `TOKEN_SUPPLY_TYPE_LENDING` | `"Lending"` |

### `TokenSupplyCategories` enum (L31–L42)

Maps the raw type strings to short enum keys used throughout `metricHelper.ts`:

| Enum member | Value |
|---|---|
| `BONDS_DEPOSITS` | `"BondsDeposits"` |
| `BONDS_PREMINTED` | `"BondsPreminted"` |
| `BONDS_VESTING_DEPOSITS` | `"BondsDepositsVesting"` |
| `BONDS_VESTING_TOKENS` | `"BondsTokensVesting"` |
| `BOOSTED_LIQUIDITY_VAULT` | `"BoostedLiquidityVault"` |
| `LENDING` | `"LendingMarkets"` |
| `LIQUIDITY` | `"ProtocolOwnedLiquidity"` |
| `MIGRATION_OFFSET` | `"MigrationOffset"` |
| `TOTAL_SUPPLY` | `"TotalSupply"` |
| `TREASURY` | `"Treasury"` |

### Asset category strings (L44–L46)

```
CATEGORY_STABLE   = "Stable"
CATEGORY_VOLATILE = "Volatile"
CATEGORY_POL      = "Protocol-Owned Liquidity"
```

Used in `getTreasuryAssetValue` to filter which `TokenRecord` rows count. Default filter includes all three.

---

## 3. Date / Time Semantics

[`dateHelper.ts`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts)

### ISO-8601 date string format

[`getISO8601DateString(date)`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts#L11) — calls `date.toISOString().split("T")[0]`. Returns `YYYY-MM-DD` in UTC. This is the canonical date ID used by both the subgraph entities and the `Metric.date` output field. The Envio `GlobalMetricSnapshot.id` must use the same format.

### Pagination window (`OFFSET_DAYS = 4`)

[`getOffsetDays`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts#L23) — defaults to 4 days per fetch window. The comment at L8–L10 documents the reasoning: the Ethereum subgraph emits ~150 records/day (50 records × 3), and the Graph Protocol limit is 1000 records per query, so a 4-day window keeps response sizes safe. This constant is irrelevant to the Envio port (Envio has no per-query record cap in the same sense), but the 4-day window is still the default `dateOffset` parameter used by callers.

### End-date and start-date helpers

- [`getNextEndDate(currentDate)`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts#L15) — first call (`currentDate = null`) returns tomorrow at `00:00:00.000 UTC`. Subsequent calls return the same `currentDate`.
- [`getNextStartDate(offsetDays, finalStartDate, currentDate)`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts#L41) — subtracts `offsetDays` from the end date; clamps to `finalStartDate` as the floor.

The resolver loops backward from tomorrow in `offsetDays` steps until it reaches `finalStartDate`. This windowing is a Graph API pagination concern and does not port to the Envio world.

---

## 4. Number / Decimal Helpers

[`numberHelper.ts`](../../../treasury-subgraph/apps/server/src/core/numberHelper.ts)

### `parseNumber(value)` (L1–L11)

Converts `string | number | undefined → number`:
- `undefined` → `0`
- `number` → identity
- `string` → `parseFloat(value)`

**All numeric fields from the subgraph entities are strings in the raw `TokenRecord`, `TokenSupply`, and `ProtocolMetric` interfaces** ([`types.ts`](../../../treasury-subgraph/apps/server/src/core/types.ts) L5–L57). Arithmetic in `metricHelper.ts` uses unary `+` (e.g. `+record.balance`) or calls `parseNumber` — both call JS `Number()` / `parseFloat` internally and produce IEEE 754 double-precision floats with no additional rounding or scaling.

**No BigDecimal or fixed-point arithmetic is used anywhere in the middleware.** All values are already in natural units (e.g. OHM, not wei) when they come out of the subgraph.

---

## 5. TokenRecord Aggregation

[`tokenRecordHelper.ts`](../../../treasury-subgraph/apps/server/src/core/tokenRecordHelper.ts)

### `filterLatestBlockByDay(records)` (L26–L42)

For a flat array of `TokenRecord` rows from a single chain, keeps only the rows belonging to the highest block number seen for each calendar date. Multiple records at the same max block are all kept (e.g. one row per wallet/token pair at the snapshot block).

### `sortRecordsDescending(records)` (L47–L70)

Sorts by `date DESC`, then `id ASC` (ties broken by record ID string comparison).

### `filterCompleteRecords(records, log)` (L81–L185)

**This is the canonical cross-chain completeness gate for TokenRecord data.** It operates on a `TokenRecordsResponse` (per-chain arrays).

Algorithm:
1. Collect the distinct dates present in the Arbitrum and Ethereum arrays only. (Fantom, Polygon, Base, Berachain are not checked.)
2. If either Arbitrum or Ethereum is empty, return all-empty response (L101–L111).
3. Compute `completeDates` = dates present in both Arbitrum and Ethereum (L113–L119).
4. If `completeDates` is empty, return all-empty response (L140–L150).
5. Find `latestCompleteDate` = max of `completeDates` (L153–L154).
6. Filter every chain's records to `date <= latestCompleteDate` (L159–L178). This includes Fantom, Polygon, Base, and Berachain — they are not used for the completeness check but are trimmed to the same ceiling date.

**Key semantic**: only Arbitrum and Ethereum gate completeness. A missing Berachain snapshot does not block the output.

### `flattenRecords(records, latestBlock, log)` (L187–L222)

Merges the six per-chain arrays into a single flat array. If `latestBlock = true`, calls `filterLatestBlockByDay` per chain before merging.

### `getBlockByChain(records, chain)` (L224–L228)

Returns the `block` number of the first matching record for a chain, or `null`. Only used by callers that need per-chain block numbers; not used internally in the metric formula.

### `isCrossChainRecordDataComplete(arbitrumRecords, ethereumRecords)` (L243–L255)

Simpler single-day check: returns `true` iff both arrays are non-empty and `arbitrumRecords[0].date === ethereumRecords[0].date`. Used by callers that pre-sort by descending date and just want to know if the very latest snapshot is complete.

---

## 6. TokenSupply Aggregation

[`tokenSupplyHelper.ts`](../../../treasury-subgraph/apps/server/src/core/tokenSupplyHelper.ts)

### `filterLatestBlockByDay(records)` (L20–L35)

Identical logic to the TokenRecord version: keeps max-block rows per date, within a single chain's array.

### `sortRecordsDescending(records)` (L40–L63)

Same date DESC / id ASC sort as TokenRecord.

### `setBlockchainProperty(records, blockchain)` (L65–L72)

Stamps a `blockchain` string onto each `TokenSupply` row. Called during `flattenRecords` when `blockchain = true`. Required because raw subgraph `TokenSupply` rows do not include `blockchain` (unlike `TokenRecord` which does).

### `filterCompleteRecords(records, log)` (L83–L156)

Identical algorithm to the TokenRecord version: Arbitrum + Ethereum gate; `latestCompleteDate` ceiling applied to all six chains.

### `flattenRecords(records, blockchain, latestBlock, log)` (L158–L198)

Merges six chains. If `blockchain = true`, calls `setBlockchainProperty` per chain. If `latestBlock = true`, calls `filterLatestBlockByDay` per chain.

---

## 7. Protocol Metric Helper

[`protocolMetricHelper.ts`](../../../treasury-subgraph/apps/server/src/core/protocolMetricHelper.ts)

### `filterLatestBlockByDay(records)` (L20–L35)

Same max-block-per-date filter. Used in resolvers to deduplicate before grouping by date.

### `sortRecordsDescending(records)` (L40–L63)

Same date DESC / id ASC sort.

### `flattenRecords(records, latestBlock, log)` (L65–L100)

Merges six per-chain `ProtocolMetric` arrays. If `latestBlock = true`, deduplicates per chain first.

**Note on `ProtocolMetric` sourcing**: The raw `ProtocolMetric` entity comes from the per-chain Graph subgraphs and includes `currentIndex`, `currentAPY`, `ohmPrice`, `gOhmPrice`, `sOhmCirculatingSupply`, `totalValueLocked`, `gOhmTotalSupply`, `nextDistributedOhm`, `nextEpochRebase`, and `ohmTotalSupply`. In `getMetricObject`, **only the first element** of the combined array (`protocolMetrics[0]`) is used for all protocol-level scalars (L892–L899 of `metricHelper.ts`). This means the Ethereum record dominates (it appears first in the merged array because "ethereum" is the first key in the chain mapping).

No per-chain aggregation is performed on `ProtocolMetric` fields — they are taken directly from a single record.

---

## 8. Top-Level `metricHelper.ts`

[`metricHelper.ts`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts)

### OHM and gOHM address lists (L34–L44)

```
OHM_ADDRESSES (lowercase):
  0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5  // Ethereum mainnet
  0xf0cb2dc0db5e6c66b9a70ac27b06b878da017028  // Arbitrum
  0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0  // Base
  0x18878df23e2a36f81e820e4b47b4a40576d3159c  // Berachain

GOHM_ADDRESSES (lowercase):
  0x0ab87046fbb341d058f17cbc4c1133f25a20a52f  // Ethereum mainnet
  0x8d9ba570d6cb60c7e3e0f31343efe75ab8e65fb1  // Arbitrum
```

Used by `getBalanceMultiplier` (gOHM balance × `ohmIndex` to normalize to OHM terms) and by `isOHM` / `isBuybackAddress` in treasury value logic.

### `Metric` type (L89–L135)

The output shape of `getMetricObject`. All fields:

| Field | Type |
|---|---|
| `date` | `string` (YYYY-MM-DD) |
| `blocks` | `ChainValues` (number per chain) |
| `timestamps` | `ChainValues` (Unix seconds per chain) |
| `ohmIndex` | `number` |
| `ohmApy` | `number` |
| `ohmTotalSupply` | `number` |
| `ohmTotalSupplyComponents` | `ChainValues` |
| `ohmTotalSupplyRecords` | `ChainSupplies` (optional) |
| `ohmCirculatingSupply` | `number` |
| `ohmCirculatingSupplyComponents` | `ChainValues` |
| `ohmCirculatingSupplyRecords` | `ChainSupplies` (optional) |
| `ohmFloatingSupply` | `number` |
| `ohmFloatingSupplyComponents` | `ChainValues` |
| `ohmFloatingSupplyRecords` | `ChainSupplies` (optional) |
| `ohmBackedSupply` | `number` |
| `gOhmBackedSupply` | `number` |
| `ohmBackedSupplyComponents` | `ChainValues` |
| `ohmBackedSupplyRecords` | `ChainSupplies` (optional) |
| `ohmSupplyCategories` | `SupplyCategoryValues` |
| `ohmPrice` | `number` |
| `gOhmPrice` | `number` |
| `marketCap` | `number` |
| `sOhmCirculatingSupply` | `number` |
| `sOhmTotalValueLocked` | `number` |
| `treasuryMarketValue` | `number` |
| `treasuryMarketValueComponents` | `ChainValues` |
| `treasuryMarketValueRecords` | `ChainRecords` (optional) |
| `treasuryLiquidBacking` | `number` |
| `treasuryLiquidBackingComponents` | `ChainValues` |
| `treasuryLiquidBackingRecords` | `ChainRecords` (optional) |
| `treasuryLiquidBackingPerOhmFloating` | `number` |
| `treasuryLiquidBackingPerOhmBacked` | `number` |
| `treasuryLiquidBackingPerGOhmBacked` | `number` |

### `getMetricObject` — field-by-field formula reference (L743–L1060)

**Inputs**: `tokenRecords: TokenRecord[]`, `tokenSupplies: TokenSupply[]`, `protocolMetrics: ProtocolMetric[]`, optional `{ includeRecords, dateFallback }`.

**Guard** (L756–L890): If any of the three input arrays is empty, returns a zeroed-out `Metric` with `date` set to `dateFallback` (or `""`) and all numeric fields `= 0`.

**Scalar extraction from protocolMetrics[0]** (L892–L910):

```
date         = tokenRecords[0].date
block        = parseNumber(protocolMetrics[0].block)         // used for BLV inclusion check
ohmIndex     = parseNumber(protocolMetrics[0].currentIndex)
ohmApy       = parseNumber(protocolMetrics[0].currentAPY)
ohmPrice     = parseNumber(protocolMetrics[0].ohmPrice)
gOhmPrice    = parseNumber(protocolMetrics[0].gOhmPrice)
sOhmCirculatingSupply = parseNumber(protocolMetrics[0].sOhmCirculatingSupply)
sOhmTotalValueLocked  = parseNumber(protocolMetrics[0].totalValueLocked)
```

Source record is the first element of the combined cross-chain array — dominated by Ethereum (first in insertion order).

**`getSupplyCategories(tokenSupplies, ohmIndex)`** (L463–L529):

Partitions all `TokenSupply` rows into 10 buckets by `record.type`, filtering out any records whose `tokenAddress` is not in `OHM_ADDRESSES ∪ GOHM_ADDRESSES` (`isSupportedToken`, L154–L160). Returns `[SupplyCategoryValues, SupplyCategoryRecords]`.

gOHM records are weighted by `ohmIndex` (`getBalanceMultiplier`, L162–L172):
- OHM address → multiplier `1`
- gOHM address → multiplier `ohmIndex`

Both `balance` and `supplyBalance` are summed with the multiplier applied. `supplyBalance` is the field used in the output `ohmTotalSupply`, `ohmCirculatingSupply`, etc.

**`getAssetValues(tokenRecords)`** (L695–L711):

Calls `getTreasuryAssetValue(records, false)` for market value and `getTreasuryAssetValue(records, true)` for liquid backing.

**`getTreasuryAssetValue(records, liquidBacking, categories)` logic** (L578–L687):

For each `TokenRecord`:
1. Skip if `record.category` not in `categories` (default: all three).
2. If `liquidBacking = true`, skip if `!record.isLiquid`.
3. If `liquidBacking = true`, skip if `isOHM(record)` — OHM is excluded from liquid backing.
4. If `!liquidBacking` (market value), skip OHM records unless they come from a buyback address (`isBuybackAddress`).

Value accumulated:
- Market value: `+record.value`
- Liquid backing: `+record.valueExcludingOhm`

Per-chain totals accumulated in `ChainValues` by matching `record.blockchain`.

**`isBuybackAddress(record)` gate** (L554–L568):

Returns `true` iff:
- `record.block` is set
- `Number(record.block) >= 20514801` (Ethereum mainnet block; no cross-chain equivalent defined)
- `record.sourceAddress.toLowerCase() === "0xf7deb867e65306be0cb33918ac1b8f89a72109db"`

OHM held at this address counts toward market value. This is a hard-coded historical inclusion that only applies to one Ethereum address.

**Supply formulas** (using `getOhmCirculatingSupply`, `getOhmFloatingSupply`, `getOhmBackedSupply`, `getOhmTotalSupply`):

All supply functions operate on `SupplyCategoryRecords` and call `getRecordsForTypes(records, includedTypes, ohmIndex)` which sums `supplyBalance × multiplier` across the listed categories.

**BLV inclusion block** (L311–L319):

```
ETHEREUM_BLV_INCLUSION_BLOCK = "17620000"
```

`isBLVIncluded(ethereumBlock)` returns `true` if the Ethereum block is **below** 17620000. When `true`, `BOOSTED_LIQUIDITY_VAULT` is included in circulating and floating supply calculations (subtracted from total, meaning BLV OHM is treated as non-circulating before this block).

| Supply metric | Included categories |
|---|---|
| `ohmTotalSupply` | `TOTAL_SUPPLY` |
| `ohmCirculatingSupply` | `TOTAL_SUPPLY, TREASURY, MIGRATION_OFFSET, BONDS_PREMINTED, BONDS_VESTING_DEPOSITS, BONDS_DEPOSITS` [+ `BOOSTED_LIQUIDITY_VAULT` if pre-17620000] |
| `ohmFloatingSupply` | above + `LIQUIDITY` [+ `BOOSTED_LIQUIDITY_VAULT` if pre-17620000] |
| `ohmBackedSupply` | `TOTAL_SUPPLY, TREASURY, MIGRATION_OFFSET, BONDS_PREMINTED, BONDS_VESTING_DEPOSITS, BONDS_DEPOSITS, LIQUIDITY, BOOSTED_LIQUIDITY_VAULT, LENDING` (always all, no BLV block check) |

Note: these are subtracted categories (negative `supplyBalance`), not additive. `ohmCirculatingSupply = supplyBalance(TOTAL_SUPPLY) + supplyBalance(TREASURY) + …` where treasury/bond/offset rows carry negative `supplyBalance` values as emitted by the subgraph.

**Derived ratios** (L713–L725):

```
getLiquidBackingPerOhmFloating  = liquidBacking / ohmFloatingSupply.supplyBalance
getLiquidBackingPerOhmBacked    = liquidBacking / ohmBackedSupply.supplyBalance
getLiquidBackingPerGOhmBacked   = liquidBacking / (ohmBackedSupply.supplyBalance / ohmIndex)
gOhmBackedSupply                = ohmBackedSupply / ohmIndex
marketCap                       = ohmPrice * ohmCirculatingSupply.supplyBalance
```

**`blocks` and `timestamps` fields** (L915–L929):

Taken from the first `TokenRecord` in each chain's `marketValueChainRecords` bucket (the records that contributed to market value). Uses `getBlock(chainRecords[0].block)` and `getTimestamp(chainRecords[0].timestamp)`. Returns `0` for chains with no contributing records.

**`ohmSupplyCategories` field** (L969):

Exposes `supplyCategories[0]` directly — the raw balance sum (not `supplyBalance`) per category, before the signed aggregation into circulating/floating/backed. This is the `balance` field of each `TokenSupply` record, not `supplyBalance`.

### `sortRecordsDescending(records: Metric[])` (L1062–L1075)

Sorts the `Metric[]` output array by `date` descending.

---

## 9. Cross-Chain Fan-Out Pattern

**Subgraph endpoints** ([`subgraph/client.ts`](../../../treasury-subgraph/apps/server/src/subgraph/client.ts) L15–L34):

Six Graph Protocol subgraph URLs, one per chain, resolved using `ARBITRUM_SUBGRAPH_API_KEY` from environment. All URLs point to `gateway-arbitrum.network.thegraph.com`.

| Chain | Subgraph ID / deployment ID |
|---|---|
| Ethereum | `7jeChfyUTWRyp2JxPGuuzxvGt3fDKMkC9rLjm7sfLcNp` (by name) |
| Arbitrum | `QmNQfMN2GjnGYx2mGo92gAc7z47fMbTMRR9M1gGEUjLZHX` (deployment) |
| Fantom | `QmNUJtrE5Hiwj5eBeF5gSubY2vhuMdjaZnZsaq6vVY2aba` (deployment) |
| Polygon | `QmdDUpqEzfKug1ER6HWM8c7U6wf3wtEtRBvXV7LkVoBi9f` (deployment) |
| Base | `QmWj7CDe7VivLqX49g6nXjni8w3XFokY5Pwiau78xyox9p` (deployment) |
| Berachain | `5KjntDTvo4DumbAkXdkrzNBdta2NujCc73TRYwgTdVun` (by name) |

**`queryAllSubgraphs<T>`** ([`client.ts`](../../../treasury-subgraph/apps/server/src/subgraph/client.ts) L233–L261):

Fires all six chains simultaneously with `Promise.allSettled`. Returns `{ results: Map<Chain, T>, successfulChains, failedChains }`. A failed chain's data is absent from `results` but listed in `failedChains`. No chain failure blocks the others.

**`queryAllSubgraphsWithPerChainVariables<T>`** ([`client.ts`](../../../treasury-subgraph/apps/server/src/subgraph/client.ts) L268–L300):

Same parallel pattern but allows per-chain variable values (e.g. different block numbers per chain for `atBlock*` queries).

**Retry logic** ([`client.ts`](../../../treasury-subgraph/apps/server/src/subgraph/client.ts) L118–L188):

Each chain gets 1 retry (`maxRetries = 1`) with 500ms initial delay, capped at 5s. Permanent errors (e.g. "subgraph not found") are cached in a 5-minute failure cache to prevent thrashing.

**`crossChainDataComplete` query variable** ([`resolvers.ts`](../../../treasury-subgraph/apps/server/src/graphql/resolvers.ts)):

Accepted by `paginatedMetrics`, `paginatedTokenRecords`, and `paginatedTokenSupplies` (default `false`).

When `crossChainDataComplete = true`:
1. After all pages are fetched, `filterCompleteRecords` is called once on the merged per-chain response. This finds the `latestCompleteDate` (latest date with both Arbitrum and Ethereum data) and trims all chains to that ceiling.
2. For `paginatedMetrics` additionally: after per-chain filtering, a second pass finds `latestTokenSupplyDate` and skips metric computation for any date later than it ([`resolvers.ts`](../../../treasury-subgraph/apps/server/src/graphql/resolvers.ts) L1382–L1408).

**Date-range pagination loop** (example from `paginatedMetrics`, [`resolvers.ts`](../../../treasury-subgraph/apps/server/src/graphql/resolvers.ts) L1209–L1306):

The loop walks backward from tomorrow in `offsetDays`-day windows, issuing one parallel fan-out per window until `finalStartDate` is reached. All pages are merged into per-chain arrays before any filtering is applied.

**Per-chain `filterLatestBlockByDay`** is applied after the cross-chain completeness filter, per chain, before grouping by date for metric computation.

**Caching** ([`cache/cacheManager.ts`](../../../treasury-subgraph/apps/server/src/cache/cacheManager.ts)):

In-process LRU cache (max 500 entries, 1-hour default TTL). `latestMetrics` uses 5-minute TTL; `paginatedMetrics` uses 5-minute TTL; `earliestMetrics` and `atBlockMetrics` use 1-hour TTL. Cache keys include `startDate`, `endDate`, `crossChainDataComplete`, and `includeRecords` flags.

---

## 10. GraphQL Endpoint Surface

[`graphql/schema.ts`](../../../treasury-subgraph/apps/server/src/graphql/schema.ts)

### `Metric` type (L117–L153)

The primary output type. All fields are non-nullable `Float!` or `String!` except the optional record arrays and `_meta`.

```graphql
type Metric {
  date: String!
  blocks: ChainValues!
  timestamps: ChainValues!
  ohmIndex: Float!
  ohmApy: Float!
  ohmTotalSupply: Float!
  ohmTotalSupplyComponents: ChainValues!
  ohmCirculatingSupply: Float!
  ohmCirculatingSupplyComponents: ChainValues!
  ohmFloatingSupply: Float!
  ohmFloatingSupplyComponents: ChainValues!
  ohmBackedSupply: Float!
  gOhmBackedSupply: Float!
  ohmBackedSupplyComponents: ChainValues!
  ohmSupplyCategories: SupplyCategoryValues!
  ohmPrice: Float!
  gOhmPrice: Float!
  marketCap: Float!
  sOhmCirculatingSupply: Float!
  sOhmTotalValueLocked: Float!
  treasuryMarketValue: Float!
  treasuryMarketValueComponents: ChainValues!
  treasuryLiquidBacking: Float!
  treasuryLiquidBackingComponents: ChainValues!
  treasuryLiquidBackingPerOhmFloating: Float!
  treasuryLiquidBackingPerOhmBacked: Float!
  treasuryLiquidBackingPerGOhmBacked: Float!
  # Optional (includeRecords: true only)
  ohmTotalSupplyRecords: ChainTokenSupplies
  ohmCirculatingSupplyRecords: ChainTokenSupplies
  ohmFloatingSupplyRecords: ChainTokenSupplies
  ohmBackedSupplyRecords: ChainTokenSupplies
  treasuryMarketValueRecords: ChainTokenRecords
  treasuryLiquidBackingRecords: ChainTokenRecords
  _meta: ResponseMetadata
}
```

### `ChainValues` type (L66–L73)

```graphql
type ChainValues {
  Arbitrum: Float!
  Ethereum: Float!
  Fantom: Float!
  Polygon: Float!
  Base: Float!
  Berachain: Float!
}
```

### `SupplyCategoryValues` type (L75–L87)

```graphql
type SupplyCategoryValues {
  BondsDeposits: Float!
  BondsPreminted: Float!
  BondsVestingDeposits: Float!
  BondsVestingTokens: Float!
  BoostedLiquidityVault: Float!
  LendingMarkets: Float!
  ProtocolOwnedLiquidity: Float!
  MigrationOffset: Float!
  TotalSupply: Float!
  Treasury: Float!
}
```

### `ResponseMetadata` type (L110–L114)

```graphql
type ResponseMetadata {
  chainsComplete: [String!]!
  chainsFailed: [String!]!
  timestamp: String!
}
```

Added by [`graphql/types.ts`](../../../treasury-subgraph/apps/server/src/graphql/types.ts) via `addMetricMeta`. Lists which chains successfully returned data for the request.

### Available queries

| Query | Parameters | Returns |
|---|---|---|
| `latestMetrics` | `ignoreCache?` | `Metric!` |
| `earliestMetrics` | `ignoreCache?` | `Metric!` |
| `paginatedMetrics` | `startDate, dateOffset?, crossChainDataComplete?, includeRecords?, ignoreCache?` | `[Metric!]!` |
| `atBlockMetrics` | per-chain block numbers (6 args) | `Metric!` |
| `latestTokenRecords` | `ignoreCache?` | `[TokenRecord!]!` |
| `paginatedTokenRecords` | `startDate, dateOffset?, crossChainDataComplete?, ignoreCache?` | `[TokenRecord!]!` |
| `latestTokenSupplies` | `ignoreCache?` | `[TokenSupply!]!` |
| `paginatedTokenSupplies` | `startDate, dateOffset?, crossChainDataComplete?, ignoreCache?` | `[TokenSupply!]!` |
| `latestProtocolMetrics` | `ignoreCache?` | `[ProtocolMetric!]` |
| `paginatedProtocolMetrics` | `startDate, dateOffset?, ignoreCache?` | `[ProtocolMetric!]!` |
| `latestTokenRecordsRaw` | `ignoreCache?` | `TokenRecordsRawResponse!` |
| `latestTokenSuppliesRaw` | `ignoreCache?` | `TokenSuppliesRawResponse!` |
| `latestProtocolMetricsRaw` | `ignoreCache?` | `ProtocolMetricsRawResponse!` |
| plus earliest raw variants | | |

---

## 11. Open Questions for Phase 5 Port

### 11.1 — `protocolMetrics[0]` single-record dominance

[`metricHelper.ts`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L892) uses only `protocolMetrics[0]` for all scalar fields (`ohmIndex`, `ohmApy`, `ohmPrice`, `gOhmPrice`, `sOhmCirculatingSupply`, `totalValueLocked`). In the middleware this is whichever chain's record happens to be first in the merged array (Ethereum, because `ethereum` is the first key). In Envio, `ohmIndex` is only emitted by the Ethereum subgraph. The Envio port must decide: is there a canonical chain for these scalars, and should it fail loudly if that chain's data is absent?

### 11.2 — BLV inclusion block is Ethereum-specific

[`ETHEREUM_BLV_INCLUSION_BLOCK = "17620000"`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L311) is compared against the Ethereum block number extracted from `protocolMetrics[0].block`. Historical snapshots before this block have different `ohmCirculatingSupply` and `ohmFloatingSupply` semantics. The Envio port must either hard-code this logic or encode it in the entity at index time. New snapshots (post-17620000) never trigger the BLV branch, so this is only relevant for backfilled history.

### 11.3 — Buyback address is Ethereum-specific and block-gated

[`isBuybackAddress`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L554) gates on `record.block >= 20514801` and a single hard-coded `sourceAddress`. OHM held at that address counts toward treasury market value (but not liquid backing). If the Envio indexer emits `TokenRecord` rows for that address, the Envio port of `getTreasuryAssetValue` must replicate this gate or the market value will differ from the legacy endpoint for all dates after block 20514801.

### 11.4 — `completeDates` logic only checks Arbitrum and Ethereum

[`filterCompleteRecords`](../../../treasury-subgraph/apps/server/src/core/tokenRecordHelper.ts#L81) explicitly checks only those two chains. In Envio, where all chains are indexed in one process, "completeness" needs a new definition. Options: (a) replicate the same two-chain check at snapshot write time and set a `crossChainComplete: Boolean` flag on the entity; (b) use a different completeness model based on block timestamps. The plan's `crossChainDataComplete` query var maps to option (a).

### 11.5 — `ohmSupplyCategories` exposes `balance`, not `supplyBalance`

[`ohmSupplyCategories: supplyCategories[0]`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L969) uses `supplyCategories[0]` which is `SupplyCategoryValues` — the raw `balance` sum (not `supplyBalance`). This is a different number than the supply totals shown in `ohmTotalSupply`, etc. The distinction matters for the schema: these are not the same as the circulating/floating/backed numbers. The Envio schema must decide whether to expose raw category balances or only the derived supply totals.

### 11.6 — `timestamps` and `blocks` fields are derived from treasury asset records, not protocol metrics

[`blocks`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L914) and [`timestamps`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L922) in the `Metric` output come from `assetValues.marketValueChainRecords` (the treasury records that contributed to market value), not from `protocolMetrics`. A chain with no liquid treasury assets contributes `0` for its block and timestamp. In Envio, blocks and timestamps are available at index time per event, so this can be recorded directly on the snapshot entity.

### 11.7 — In-process LRU cache does not port

The [`CacheManager`](../../../treasury-subgraph/apps/server/src/cache/cacheManager.ts) is middleware-layer infrastructure. The Envio indexer has no equivalent — entity reads are always fresh from the store. Caching in the new world is the responsibility of any API layer sitting in front of Envio's GraphQL endpoint (e.g. CDN, Redis). This is out of scope for the indexer itself but must be considered for the API layer that replaces the treasury-subgraph server.

### 11.8 — Pagination window (`OFFSET_DAYS`) and Graph API record cap are irrelevant to Envio

The 4-day window and 1000-record-per-query limit are Graph Protocol constraints. Envio's entity store supports arbitrary range queries without these caps. The `paginatedMetrics` resolver's loop is a Graph API workaround that does not need to exist in Envio.

### 11.9 — `gOhmTotalSupply`, `nextDistributedOhm`, `nextEpochRebase` are fetched but unused in `Metric`

The [`ProtocolMetric` raw entity](../../../treasury-subgraph/apps/server/src/core/types.ts#L41) includes `gOhmTotalSupply`, `nextDistributedOhm`, and `nextEpochRebase`. These fields are fetched in every subgraph query ([`queries.ts`](../../../treasury-subgraph/apps/server/src/subgraph/queries.ts)) but are never read by `getMetricObject` and do not appear in the `Metric` output type. They should be confirmed unused before the Phase 5 schema is finalized.

### 11.10 — `_meta.chainsComplete` / `_meta.chainsFailed` runtime metadata

[`addMetricMeta`](../../../treasury-subgraph/apps/server/src/graphql/types.ts#L13) adds live response metadata (which chains returned data for this request). In the Envio world, "which chains contributed" is known at index time for each snapshot. A `chainsComplete: [String!]!` field on `GlobalMetricSnapshot` could be set during the handler and would carry the same semantics as the middleware's metadata, but it would reflect completeness at snapshot time, not at query time.

---

## 12. Proposed `GlobalMetricSnapshot` Entity Fields

Based on Sections 8 and 10. Fields marked **Phase 2 confirmation needed** depend on decisions about sourcing that require the Envio schema scaffolding to resolve.

### Identity and timing

| Field | Type | Source |
|---|---|---|
| `id` | `String!` | YYYY-MM-DD (UTC) — [`dateHelper.ts:11`](../../../treasury-subgraph/apps/server/src/core/dateHelper.ts#L11) |
| `date` | `String!` | Same as `id` |
| `blockEthereum` | `BigInt!` | Block of latest Ethereum `TokenRecord` snapshot |
| `blockArbitrum` | `BigInt!` | Block of latest Arbitrum `TokenRecord` snapshot |
| `blockFantom` | `BigInt!` | Block of latest Fantom `TokenRecord` snapshot |
| `blockPolygon` | `BigInt!` | Block of latest Polygon `TokenRecord` snapshot |
| `blockBase` | `BigInt!` | Block of latest Base `TokenRecord` snapshot |
| `blockBerachain` | `BigInt!` | Block of latest Berachain `TokenRecord` snapshot |
| `timestampEthereum` | `BigInt!` | Unix seconds — [`metricHelper.ts:735`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L735) |
| `timestampArbitrum` | `BigInt!` | Same pattern, per chain |
| `timestampFantom` | `BigInt!` | Same pattern |
| `timestampPolygon` | `BigInt!` | Same pattern |
| `timestampBase` | `BigInt!` | Same pattern |
| `timestampBerachain` | `BigInt!` | Same pattern |
| `crossChainComplete` | `Boolean!` | True iff Arbitrum and Ethereum both have data for this date — [`tokenRecordHelper.ts:81`](../../../treasury-subgraph/apps/server/src/core/tokenRecordHelper.ts#L81) |

### OHM protocol scalars (from Ethereum `ProtocolMetric`)

| Field | Type | Source |
|---|---|---|
| `ohmIndex` | `Float!` | `protocolMetrics[0].currentIndex` — [`metricHelper.ts:896`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L896) |
| `ohmApy` | `Float!` | `protocolMetrics[0].currentAPY` — [`metricHelper.ts:897`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L897) |
| `ohmPrice` | `Float!` | `protocolMetrics[0].ohmPrice` — [`metricHelper.ts:898`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L898) |
| `gOhmPrice` | `Float!` | `protocolMetrics[0].gOhmPrice` — [`metricHelper.ts:899`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L899) |
| `sOhmCirculatingSupply` | `Float!` | `protocolMetrics[0].sOhmCirculatingSupply` — [`metricHelper.ts:909`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L909) |
| `sOhmTotalValueLocked` | `Float!` | `protocolMetrics[0].totalValueLocked` — [`metricHelper.ts:910`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L910) |

### OHM supply totals

| Field | Type | Source |
|---|---|---|
| `ohmTotalSupply` | `Float!` | `getOhmTotalSupply(...).supplyBalance` — [`metricHelper.ts:932`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L932) |
| `ohmCirculatingSupply` | `Float!` | `getOhmCirculatingSupply(...).supplyBalance` — [`metricHelper.ts:941`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L941) |
| `ohmFloatingSupply` | `Float!` | `getOhmFloatingSupply(...).supplyBalance` — [`metricHelper.ts:950`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L950) |
| `ohmBackedSupply` | `Float!` | `getOhmBackedSupply(...).supplyBalance` — [`metricHelper.ts:959`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L959) |
| `gOhmBackedSupply` | `Float!` | `ohmBackedSupply / ohmIndex` — [`metricHelper.ts:960`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L960) |

### OHM supply per-chain components

| Field | Type | Source |
|---|---|---|
| `ohmTotalSupplyArbitrum` | `Float!` | [`metricHelper.ts:933`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L933) |
| `ohmTotalSupplyEthereum` | `Float!` | Same |
| `ohmTotalSupplyFantom` | `Float!` | Same |
| `ohmTotalSupplyPolygon` | `Float!` | Same |
| `ohmTotalSupplyBase` | `Float!` | Same |
| `ohmTotalSupplyBerachain` | `Float!` | Same |
| `ohmCirculatingSupplyArbitrum` | `Float!` | [`metricHelper.ts:942`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L942) |
| (+ other chains) | | |
| `ohmFloatingSupplyArbitrum` | `Float!` | [`metricHelper.ts:951`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L951) |
| (+ other chains) | | |
| `ohmBackedSupplyArbitrum` | `Float!` | [`metricHelper.ts:961`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L961) |
| (+ other chains) | | |

### OHM supply categories (raw balance sums)

**Phase 2 confirmation needed** — whether to expose these or only the derived totals.

| Field | Type | Source |
|---|---|---|
| `ohmSupplyCategoryBondsDeposits` | `Float!` | `supplyCategories[0].BondsDeposits` — [`metricHelper.ts:969`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L969) |
| `ohmSupplyCategoryBondsPreminted` | `Float!` | Same |
| `ohmSupplyCategoryBondsVestingDeposits` | `Float!` | Same |
| `ohmSupplyCategoryBondsVestingTokens` | `Float!` | Same |
| `ohmSupplyCategoryLiquidity` | `Float!` | Same |
| `ohmSupplyCategoryBoostedLiquidityVault` | `Float!` | Same |
| `ohmSupplyCategoryMigrationOffset` | `Float!` | Same |
| `ohmSupplyCategoryTotalSupply` | `Float!` | Same |
| `ohmSupplyCategoryTreasury` | `Float!` | Same |
| `ohmSupplyCategoryLendingMarkets` | `Float!` | Same |

### Market cap

| Field | Type | Source |
|---|---|---|
| `marketCap` | `Float!` | `ohmPrice * ohmCirculatingSupply` — [`metricHelper.ts:972`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L972) |

### Treasury values

| Field | Type | Source |
|---|---|---|
| `treasuryMarketValue` | `Float!` | `getTreasuryAssetValue(records, false)` — [`metricHelper.ts:975`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L975) |
| `treasuryMarketValueArbitrum` | `Float!` | Per-chain component — [`metricHelper.ts:976`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L976) |
| `treasuryMarketValueEthereum` | `Float!` | Same |
| `treasuryMarketValueFantom` | `Float!` | Same |
| `treasuryMarketValuePolygon` | `Float!` | Same |
| `treasuryMarketValueBase` | `Float!` | Same |
| `treasuryMarketValueBerachain` | `Float!` | Same |
| `treasuryLiquidBacking` | `Float!` | `getTreasuryAssetValue(records, true)` — [`metricHelper.ts:984`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L984) |
| `treasuryLiquidBackingArbitrum` | `Float!` | Per-chain component — [`metricHelper.ts:985`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L985) |
| `treasuryLiquidBackingEthereum` | `Float!` | Same |
| `treasuryLiquidBackingFantom` | `Float!` | Same |
| `treasuryLiquidBackingPolygon` | `Float!` | Same |
| `treasuryLiquidBackingBase` | `Float!` | Same |
| `treasuryLiquidBackingBerachain` | `Float!` | Same |

### Liquid backing per OHM ratios

| Field | Type | Source |
|---|---|---|
| `treasuryLiquidBackingPerOhmFloating` | `Float!` | `liquidBacking / ohmFloatingSupply` — [`metricHelper.ts:993`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L993) |
| `treasuryLiquidBackingPerOhmBacked` | `Float!` | `liquidBacking / ohmBackedSupply` — [`metricHelper.ts:997`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L997) |
| `treasuryLiquidBackingPerGOhmBacked` | `Float!` | `liquidBacking / (ohmBackedSupply / ohmIndex)` — [`metricHelper.ts:1001`](../../../treasury-subgraph/apps/server/src/core/metricHelper.ts#L1001) |

### Response metadata

| Field | Type | Source |
|---|---|---|
| `chainsComplete` | `[String!]!` | Chains with data at snapshot time — Phase 2 confirmation needed |
| `chainsFailed` | `[String!]!` | Chains absent at snapshot time — Phase 2 confirmation needed |

**Total proposed top-level scalar fields: 68** (excluding optional record arrays, excluding `_meta` sub-fields). The per-chain component fields account for 36 of these (6 supply metrics × 6 chains). If the schema uses nested `ChainValues` objects (as in the legacy schema), the field count collapses to 26 top-level fields + 6 nested `ChainValues` types.
