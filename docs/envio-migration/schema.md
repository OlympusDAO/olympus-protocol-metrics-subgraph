# Envio schema reference (post-Phase 2)

Concise map of `schema.graphql` entities for Phase 3+ porters. Phase 2 added the multichain identity fields and global-snapshot scaffolding; handler logic comes in Phase 3 (pricing) and Phase 4 (per chain). Detailed legacy behavior is in [inventory.md](inventory.md).

## Output entities (consumed by GraphQL queries)

These are what the API surfaces. Treasury endpoint parity (Phase 6) is measured against `TokenRecord`, `TokenSupply`, and `GlobalMetricSnapshot`.

### `TokenRecord` — per-chain treasury balance row

ID: `<chainId>-YYYY-MM-DD/<block>/<source>/<token>`. Immutable per snapshot block.

| Field | Type | Notes |
|---|---|---|
| `chainId` | `Int! @index` | Phase 2 addition |
| `blockchain` | `String!` | Phase 2: pre-existing on TokenRecord, mirrored on TokenSupply |
| `block` / `timestamp` / `date` | `BigInt! / BigInt! / String!` | timestamp currently holds blockNumber — see [inherited-todos.md](inherited-todos.md) #1 |
| `token` / `tokenAddress` / `source` / `sourceAddress` | `String!` | identity |
| `rate` / `balance` / `multiplier` | `BigDecimal!` | inputs |
| `value` / `valueExcludingOhm` | `BigDecimal!` | derived: `balance * rate * (1 or multiplier)`, signed by `isLiability` |
| `category` / `isLiquid` / `isBluechip` | classification | per-token config |

### `TokenSupply` — per-chain OHM-supply row

ID: `<chainId>-YYYY-MM-DD/<block>/<token>/<type>/<pool>/<source>`. Immutable per snapshot block.

| Field | Type | Notes |
|---|---|---|
| `chainId` / `blockchain` | `Int! @index` / `String!` | Phase 2 additions |
| `balance` / `supplyBalance` | `BigDecimal!` | `supplyBalance` may be negative (token taken out of circulation) |

Fantom + Polygon legacy subgraphs declare `TokenSupply` but never emit rows — Phase 1 decision: match legacy (no emit on those chains).

### `GlobalMetricSnapshot` — daily UTC global aggregate

ID: `YYYY-MM-DD`. Upserted as chain snapshots arrive within the date.

| Group | Fields |
|---|---|
| Identity | `id`, `date`, `updatedAtTimestamp` |
| Completeness | `crossChainComplete @index` (Arbitrum + Ethereum required), `chainsIndexed: [Int!]!`, `chainsMissing: [Int!]!` (chainIds, not chain names — see PR #311 Step 4) |
| Per-chain breakdowns | `chainValues: [ChainMetricValues!]! @derivedFrom` |
| Supply categories | `supplyCategories: [ChainSupplyCategory!]! @derivedFrom` (10 rows per chain per snapshot) |
| Cross-chain aggregates | `ohmTotalSupply`, `ohmCirculatingSupply`, `ohmFloatingSupply`, `ohmBackedSupply`, `gOhmBackedSupply`, `treasuryMarketValue`, `treasuryLiquidBacking` |
| **Canonical-chain (Ethereum) scalars** | `ohmIndex`, `ohmApy`, `ohmPrice`, `gOhmPrice`, `sOhmCirculatingSupply`, `sOhmTotalValueLocked` |
| Derived | `marketCap`, `treasuryLiquidBackingPerOhmFloating`, `...PerOhmBacked`, `...PerGOhmBacked` |

**Canonical-chain rule:** the six scalars above are sourced from the Ethereum chain snapshot only, mirroring the legacy `protocolMetrics[0]` selection. If Ethereum has not produced a snapshot for the date, hold previous canonical values (Phase 5 implementation choice).

### `ChainMetricValues` — per-chain breakdown

ID: `YYYY-MM-DD/<chainId>`. Up to 6 per `GlobalMetricSnapshot`.

Holds per-chain OHM supply components (`ohmTotalSupply`, `ohmCirculatingSupply`, `ohmFloatingSupply`, `ohmBackedSupply`) and per-chain treasury values (`treasuryMarketValue`, `treasuryLiquidBacking`). Resolver layer translates `[chainValues]` into the legacy `ChainValues!` object shape (`{Arbitrum, Ethereum, Fantom, Polygon, Base, Berachain}`).

### `ChainSupplyCategory` — per-chain OHM supply category breakdown

ID: `YYYY-MM-DD/<chainId>/<category>`. 10 rows per chain per snapshot.

`category` is the `SupplyCategoryType` enum: `TOTAL_SUPPLY`, `TREASURY`, `OHM_MIGRATION_OFFSET`, `BONDS_PREMINTED`, `BONDS_VESTING_DEPOSITS`, `BONDS_VESTING_TOKENS`, `BONDS_DEPOSITS`, `LIQUIDITY`, `BOOSTED_LIQUIDITY_VAULT`, `LENDING`. Both `balance` (raw on-chain) and `supplyBalance` (signed contribution) preserved per Phase 1 decision — these are different numbers.

## Event-derived state entities (internal — read by snapshot handlers)

Maintained from on-chain events. Snapshot handlers read from these in place of per-snapshot RPC calls.

| Entity | ID format | Source events | Purpose |
|---|---|---|---|
| `TokenBalance` | `chainId-tokenAddress-walletAddress` | ERC20 `Transfer` | replaces `balanceOf` |
| `Erc20Supply` | `chainId-tokenAddress` | `Transfer` from/to zero | replaces `totalSupply` |
| `LenderAmo` | `chainId-amoAddress` | OlympusLender `AMOAdded`/`AMORemoved` + OHM `Transfer` | active flag + running `deployedOhm` |
| `JonesStakingPosition` | `chainId-poolId-walletAddress` | Jones `Deposit`/`Withdraw`/`EmergencyWithdraw` | replaces position lookup |
| `TreasureDeposit` | `chainId-walletAddress-depositId` | Treasure Atlas Mine `Deposit`/`Withdraw` | per-deposit running stake |
| `Univ2PoolState` | `chainId-poolAddress` | Univ2 `Sync` | reserves |
| `Univ3PoolState` | `chainId-poolAddress` | Univ3 `Initialize`/`Swap` | sqrtPriceX96, tick, liquidity (NB: not balances — see [inherited-todos.md](inherited-todos.md) #3) |
| `BalancerPoolState` | `chainId-poolId` | Balancer Vault `TokensRegistered`/`PoolBalanceChanged`/`Swap` (filtered by poolId) | tokens + balances |
| `KodiakPool` | `chainId-kodiakLpAddress` | first Kodiak `Transfer` + dynamic Univ3 registration | maps wrapper → underlying |
| **`NativeBalanceState`** (Phase 2) | `chainId-walletAddress` | snapshot-time `getBalance` (no events) | closes [inherited-todos.md](inherited-todos.md) #2 |
| **`ChainlinkPriceState`** (Phase 2) | `chainId-feedAddress` | Chainlink aggregator `AnswerUpdated` | base case for the recursive price router |

## Held-for-Phase-4 entities (zero references in `src/`)

Carried over from the legacy Graph subgraph schema and likely re-used during Phase 4 Ethereum porting:

- `BophadesModule` — Bophades Kernel module installs (ports cleanly into the dynamic-address-resolution pattern)
- `ClearinghouseAddress` — Cooler clearinghouse addresses resolved at Kernel events
- `GnosisAuctionRoot`, `GnosisAuction` — cross-data-source GnosisAuction state singletons
- `ProtocolMetric` — legacy per-chain protocol metric; likely superseded by `GlobalMetricSnapshot` but kept until Phase 5 confirms

The 6 pure cache snapshots from the legacy schema (`ERC20TokenSnapshot`, `BalancerPoolSnapshot`, `PoolSnapshot`, `TokenPriceSnapshot`, `StakingPoolSnapshot`, `PriceSnapshot`) were removed in Phase 2 — they were unused and replaced entirely by the event-driven state entities listed above.

## Deferred state entities (designed in Phase 4 when porting Ethereum)

Plan-flagged entities that need Ethereum-specific handler work to pin shape. Intentionally NOT scaffolded in Phase 2 to avoid empty-entity churn:

- `BophadesAddressState` — Kernel-resolved TRSRY + clearinghouse addresses
- `BlvVaultRegistry` — registered BLV vaults (Boosted Liquidity)
- `MigrationOffsetState` — block-windowed OHM v1→v2 migration offsets
- `CoolerLoanState` — Cooler Loan / Clearinghouse receivables
- Cross-data-source ordering markers for GnosisAuction (handlers in different dataSources writing to the same entity)

## ID format conventions

- Output entities (`TokenRecord`, `TokenSupply`): `<chainId>-YYYY-MM-DD/<block>/<...>` — chainId prefix prevents cross-chain collision; date in the path supports per-day filtering; block keeps multiple snapshots per day distinct.
- Global snapshot: `YYYY-MM-DD` (single per UTC date).
- ChainValues: `<chainId>-YYYY-MM-DD`.
- SupplyCategory: `YYYY-MM-DD-<category>`.
- State entities: `<chainId>-<naturalKey>` (e.g. `<chainId>-<walletAddress>` for `NativeBalanceState`).
