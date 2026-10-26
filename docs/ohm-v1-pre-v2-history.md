# OHM v1 and pre-v2 history

Design for issue #336. Written 2026-09-27; each section below was approved,
the final write-up was not formally signed off. Reconciled with #384 (CCIP
supply) and develop on 2026-10-26, see "Interaction with #384". Changes found
during implementation are made here in the same commit as the code and
listed in the PR under "Changes from the design".

## Goal

Publish every dashboard metric from OHM v1 launch (March 2021) instead of
2022-05-01: OHM supply (total, circulating, floating, backed), OHM price,
market cap, sOHM circulating supply, index and staking APY, treasury market
value, liquid backing, and backing per OHM and per gOHM.

Ethereum is the only chain that gains new logic. Olympus had no other
deployment before v2. Polygon's existing snapshots start at block 23,000,000
(2021-12-26), so Polygon rows for 2021-12-26 to 2022-04-30 become public
too. They need no code change beyond correcting the start-block comment,
which says ~2021-09-22.

The work ships as one PR. Nothing before 2022-05-01 becomes public until the
supply, price, index and treasury pieces are all in place, because the public
start date moves in the same PR.

## Non-goals

- Unmigrated OHM v1 after the v2 launch. The migrator held pre-minted gOHM
  for it, which is already inside v2 supply, until the migrator was defunded
  at block 24,550,660. After that the v1 cannot be migrated. Adding a v1
  supply row would double count. The chain reads behind this are in the
  #336 thread.
- Native ETH on the DAO wallet before v2 (45–90 ETH). `NATIVE_ETH_BLOCK` is
  21,810,000. Moving it back would also change published 2022–2025 values,
  and moving it for the pre-v2 window only would leave a gap.
- Legacy RFV and runway fields.
- Frontend changes. That lives in olympus-frontend-v2. The PR tells its
  owners that pre-2022-05 days start arriving as complete.

## Background

- The Ethereum `start_block` is 12,000,000, which is 2021-03-08. The comments
  in `config.yaml` and `BlockHandlers.ts` say 2021-04-29, and this PR
  corrects them. OHM v1, staking v1, treasury v1 and the OHM-DAI v1 pool were
  all created after that block. The Transfer ledger and the 2,400-block
  snapshots therefore already cover the v1 era. What is missing is the logic
  that uses them.
- Today `pushTotalSupply` and `pushTreasuryOhm` return early before
  `ohmStartBlock` (the v2 block), and about eight call sites read
  `config.ohmToken`, which is always v2. The index is read only from sOHM v3,
  and sOHM circulating supply only from v3.
- `crossChainComplete` requires Arbitrum, whose snapshots start around
  2022-05. The API drops incomplete days, and the frontend filters them out.
- Since the design was written, #384 added a CCIP cutover to
  `pushTotalSupply` on the L2s. See "Interaction with #384" below.
- The legacy Graph subgraph had pre-v2 code paths but never ran before block
  14,690,000. There is no legacy data to compare against.

## Design

### 1. Supply and price

**OHM token by era.** Add an ordered `ohmEras` list to `ChainConfig`, and an
`ohmTokenAt(config, block)` helper:

| Era | Token | Blocks |
| --- | --- | --- |
| v1 | OHM v1 | from OHM v1 creation (12,084,967) up to and including 13,805,111 |
| v2 | OHM v2 | from 13,805,112, the first OHM v2 mint |

The draft followed the legacy rule (`gt(13782589)` selects v2). That block is
OHM v2's deployment, but its supply stayed 0 until the migrator's
`migrateContracts` minted the first OHM v2 at 13,805,112 (2021-12-14 19:10
UTC), while OHM v1 kept circulating. Switching at the deployment would publish
three days (2021-12-11 to 12-14) of zero total and circulating supply, so the
switch is at the first mint. Legacy never indexed those blocks, so nothing
changes for published dates.

Pool values exclude every era's token from backing (`ohmTokens`), not just
the current one, so a v1 pool valued after the switch still keeps its v1 OHM
out of liquid backing. The Liquidity supply row uses the era's token only.

Every site that reads `config.ohmToken` and can run before v2 switches to the
helper:

- total supply (`pushTotalSupply`)
- treasury OHM (`pushTreasuryOhm`) and the OHM-equivalent multiplier's
  decimals lookup
- the snapshot OHM price (`updateGlobalMetricSnapshot`)
- the OHM exclusion in owned-liquidity records
- owned-liquidity supply
- the two `LiquidityPositions` sites
- the own-pool OHM price fallback (`withOwnPoolFallback` in
  `pricing/index.ts`). Without it, valuing the OHM-DAI v1 pool while it is
  the only v1 pool prices its OHM side at zero, which halves its market
  value and sets its multiplier to 1.

`BlvSupply`, `ArbitrumLending`, `LendingDeployments` and `Univ3NftPol` keep
reading `config.ohmToken`. Each is gated to blocks well after the v2 launch
(or to a chain with no eras), so the helper would always return v2 there.

`ohmStartBlock` becomes the first era's start. Chains without `ohmEras`
behave exactly as today.

**v1 price.** Register the four v1 pools in the `UniswapV2Pool` list in
`config.yaml`, and add `univ2` price handlers for SushiSwap OHM-DAI, OHM-ETH
and OHM-LUSD v1. The router already picks the handler with the most
liquidity, so OHM-DAI dominates, as it did in legacy. No new pricing code.

Uni OHM-FRAX v1 is not a price handler, only the pricing handler of its
liquidity position (section 3). A price handler matches both of its tokens,
and FRAX had no Chainlink feed before block 12,974,035, so the pair would
have priced FRAX off OHM from June to August 2021 (the stable handler has no
liquidity weight). OHM-DAI is far deeper, so the OHM price doesn't change.

**Non-circulating v1 OHM.** Match the exclusion list of the v1 on-chain
CirculatingSupply contract exactly. Its `OHMCirculatingSupply()` then becomes
the parity oracle for 2021-04-13 through the v2 launch:

- the DAO wallet (already a circulating-supply wallet)
- Staking Distributor V1, which held about 90% of v1 supply in Mar–May 2021
- SLP bonds 1 and 2
- three small contracts listed by the oracle (never more than 21k OHM)

Use the same list before the oracle existed (2021-03 to 2021-04-13).

Other v1 bond depositories' vesting payouts count as circulating, as the
oracle did (at most about 1% of supply).

Implementation: extend `treasuryOhmExtraWallets` to take a token and an
active block window. Adding these wallets to `PROTOCOL_ADDRESSES` would pull
them into every token's Transfer filter and the balance backfill.

### 2. Index and APY

**Index by era**, read by RPC once per snapshot through a cached effect:

| Condition at the snapshot block | Source |
| --- | --- |
| an sOHM v3 `OhmIndexState` exists (first v3 rebase, about 13,806,000) | that state, unchanged from today |
| otherwise, sOHM v2 exists (12,622,596 and later) and its `index()` is above 0 (from its first rebase, about 12.64M) | sOHM v2 `index()` |
| otherwise | sOHM v1 `totalSupply` ÷ 500,000, because sOHM v1 `index()` reverts |

The approximate block numbers are for orientation only. The code switches
on the conditions, so no exact rebase block is hard-coded.

Reading by RPC costs about 720 cached reads over the period. It avoids
decoding the v1 and v2 rebase events, which have not been verified. The v1
and v2 figures differ by about 0.2% where they meet (4.609 vs 4.601), so the
chart shows a small step there. Switching at v2's first rebase keeps that
step as small as possible.

**sOHM circulating supply** (the APY denominator) follows the same eras: v1
`circulatingSupply` before block 12,622,596, then v2, then v3. The ~1.6k v1
residual after the switch is ignored, as in legacy.

**APY numerator.** Staking v1 `ohmToDistributeNextEpoch`, then v2
`epoch().distribute`. The research indicates this already works; tests
confirm it.

**Backing per gOHM** (backed supply ÷ index) is computed with this index
from launch, including before gOHM existed in December 2021, so the series
is continuous.

### 3. Treasury and backing

**v1 OHM pools (about $272M of non-OHM value at the v2 launch).** The four
pools are registered once, under `UniswapV2Pool` (section 1). That contract's
Transfer handler already keeps the protocol-wallet LP ledger and the LP total
supply, the same way it does for the SushiSwap v2 pairs, and Envio's address
table can't hold one address under two contracts, so they don't go in
`LpERC20`. Add them to `liquidityPositions`, so their value splits as v2 LPs
do today. Non-OHM value
goes to treasury and backing, and OHM goes to the Liquidity supply row. The
liquid-backing treatment is the same as for the existing v2 LPs.

**Onsen allocator.** Add it as a protocol wallet, and add a MasterChef V1
read source for its staked SLP: pid 185 is OHM-DAI v1 and pid 323 is
OHM-LUSD v1. At each snapshot, read `poolInfo(pid).lpToken` at that block
and count `userInfo(pid, allocator).amount` only while the LP token matches
the expected pool. The head value of pid 185's `lpToken` now points to an
address with no code, so neither a head read nor a hard-coded mapping on its
own is safe.

Treasury v1 and v2 are already configured. Their balances are zero before
each exists, so they need no start blocks.

**Dec 2021–Apr 2022 gaps.** These dates become public in the same PR:

- vlCVX v1 in the CVX allocator (about $24M), priced as CVX
- SPELL (6.66M), PRIME (500k; on-chain symbol D2D) and agEUR (26k; on-chain
  symbol now EURA). None has a price path today. Add one for each: a
  Chainlink EUR/USD feed for agEUR, and the deepest v2-style pool for SPELL
  and PRIME. Confirm each source's address and liquidity during
  implementation. A token with no source of meaningful liquidity is listed in
  the PR as a known gap rather than priced from a thin pool.
- OHM-FRAX v2 and OHM-LUSD v2 as owned liquidity
- stranded v1 LPs in Onsen and Treasury v2, covered by the items above
- the Tokemak staking read extended to the wallets that held it in that
  window

**Small pre-v2 tokens** (under about $0.5M combined): CRV, ALCX, FOX, KP3R,
SYN, THOR and SUSHI. The approved rule is to add each one that has a working
price path and list the rest as known gaps. None of them has an Envio price
path today; legacy priced them from pools such as CRV-ETH and SUSHI-ETH.
Adding those pools would index their Sync events all the way to head for
under $0.5M of value. All seven are therefore listed in the PR as known
gaps.

**Start-block fixes.** Set the real creation blocks for the UniV3 pools
WETH-wstETH (15,384,250) and WETH-BTRFLY v1 (13,826,232). Both currently use
`ETHEREUM_START_BLOCK` and waste calls.

Correct the Ethereum start-block comments in `config.yaml` and
`BlockHandlers.ts`: block 12,000,000 is 2021-03-08, not 2021-04-29.

### 4. Publisher and rollout

**Completeness.** Today both `REQUIRED_CHAINS_FOR_COMPLETE`
(`apps/indexer/src/snapshot/global.ts`) and `REQUIRED_CHAIN_IDS_FOR_COMPLETE`
(`packages/metrics-artifacts/src/legacy-shape.ts`) require Arbitrum and
Ethereum for every date. Arbitrum's snapshots start at block 10,950,000
(2022-05-01 02:14 UTC). Change both lists to depend on the date:

- before 2022-05-01, only Ethereum is required
- on and after 2022-05-01, Arbitrum and Ethereum, exactly as today

A generic rule, "every chain whose snapshots had started by then", was
rejected. It would add Polygon and the later chains to the required set for
days that are already public, and could flip some of them to incomplete.
Tests cover 2022-04-30 (Ethereum only), and 2022-05-01 plus a recent date
(both chains still required).

The indexer writes `crossChainComplete` from the snapshot's date, which
`aggregateAcrossChains` already receives. The artifacts helper
`isCrossChainComplete(chainsIndexed)` has no date today, and three callers
recompute completeness with it: `buildDailyMetric` in `legacy-shape.ts`, the
publisher's `normalizeDailyMetric` (`metrics-source.ts`) and the API's
`normalizeMetricCompleteness` (`metrics-api/src/server.ts`). All of them
have the row's date, so the helper takes it too. The publisher's bounds query
filters on the stored `crossChainComplete`, so it follows the indexer.

**Public start date.** Set `DEFAULT_PUBLIC_START_DATE` to `2021-03-22`. That
is the first full UTC day after OHM v1's creation block 12,084,967
(2021-03-21 22:48:40 UTC). Update the publisher tests at
`publisher.test.ts:588` and `:773`, and assert that `/v2/bounds` reports the
new earliest date. `docker-compose.yml` also defaults
`PUBLISHER_PUBLIC_START_DATE` to `2022-05-01`, and
`docs/railway-metrics-api.md` documents that default; both change with it.
If Railway sets `PUBLISHER_PUBLIC_START_DATE` explicitly, that variable has to
change too (the repo can't show it).

**API range cap.** No change. The client's `autoPaginate` already splits
requests into windows. This adds about 14 monthly shards.

**Rollout.**

- The indexer change produces a new deployment ID, which forces a full
  backfill. The publisher's first publish waits for all chains to be within
  one day of head.
- #368 and #369 are merged, so this reindex carries all three.
- Known operational risks: the quiet-chain head freeze, and indexer restarts
  regressing the manifest. The local run below measures the added cost of
  the index and MasterChef reads and the v1-pool Sync events, and the PR
  reports it.

### Interaction with #384 (CCIP cutover)

#384 (merged 2026-10-23) added `ChainConfig.ohmTotalSupplyEndBlock`. From
that block, `pushTotalSupply` emits a zero Total Supply row instead of the
chain's `Erc20Supply`. It is set only on Arbitrum, Base and Berachain, at
their 2026-10-22 blocks. Treasury and liquidity rows are untouched.

The two changes meet in one function, `pushTotalSupply`, and don't conflict:

- `ohmEras` is set only on Ethereum. On every other chain `ohmTokenAt`
  returns `config.ohmToken`, so the cutover branch and its zero row are
  exactly as #384 left them.
- `ohmTotalSupplyEndBlock` is unset on Ethereum, so the cutover branch never
  runs where eras switch.
- Order inside `pushTotalSupply`: the `ohmStartBlock` gate, then the token
  for the block, then the cutover check (which names its zero row after that
  token), then the `Erc20Supply` read for that token. On the L2s the token is
  the one #384 used, so its rows and IDs don't change.
- #384's other change, treasury and liquidity deductions continuing after the
  cutover, is in `pushTreasuryOhm` and `pushOwnedLiquiditySupply`. Those only
  swap `config.ohmToken` for `ohmTokenAt`, which is the same token on the
  L2s.
- The #384 tests (`SupplyParity.test.ts` cutover cases, `global.test.ts`
  aggregation across the cutover) run unchanged and must keep passing.

## Verification

Before the PR:

- `pnpm run check`, `pnpm run build`, `pnpm test` and `pnpm run validate`.
- Unit tests for:
  - the era boundaries at 13,805,111 and 13,805,112
  - supply before OHM v1 exists
  - each exclusion wallet
  - the index sources and their switch points
  - APY staying 0, not NaN, before the first distribution
  - the v1 LP split and the Onsen read
  - completeness by date, including the pinned current days
  - the publisher start date
- Live suites that skip explicitly without an RPC, never pass vacuously.
  At sample blocks they compare against the chain:
  - circulating supply, exactly against the v1 CirculatingSupply contract
  - the index at 12.64M, 13.0M and 13.78M
  - v1 LP reserves and treasury ownership
  - key treasury balances
- A local run via the repo's local-compose setup over Ethereum from 12M
  through about 13.9M. Compare its snapshots at sample blocks with the same
  chain reads, and report wall time and RPC volume.
- Treasury totals have no on-chain oracle. The PR compares them roughly with
  DefiLlama (about $730M on 2021-12-11) and labels that comparison as
  unknown methodology.

After merge (AGENTS.md): check that indexing is past the start block, token
records exist, prices convert, and pre-v2 days appear in published global
metrics.

## Open risks

- Three oracle-listed exclusion contracts have unconfirmed roles
  (`0xcE65…f4C4`, `0x39Ba…4867` and `0xC7f5…dB3d`). They are included
  because the oracle includes them. Together they never held more than about
  21k OHM.
- SPELL's address is confirmed only by an on-chain `symbol()` read. It
  appears in no repo source.
- The v1 and v2 rebase events are not decoded. The design avoids needing
  them.
- External treasury references use different methodology. Only supply has
  exact parity.
- The added Sync volume on the v1 pools is unmeasured until the local run.

## Addresses

All on Ethereum mainnet. Creation blocks come from `getCode` binary searches
on an archive node. "Legacy" means `62e12ae^:subgraphs/ethereum/src/utils/Constants.ts`.

| Address | Role | Created | Status in Envio |
| --- | --- | --- | --- |
| `0x383518188c0c6d7730d91b2c03a03c837814a899` | OHM v1 (9 decimals) | 12,084,967 | `ERC20_OHM_V1`, in `OhmERC20` |
| `0x31932e6e45012476ba3a3a4953cba62aee77fbbe` | sOHM v1 | 12,084,973 | missing |
| `0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f` | sOHM v2 | 12,622,596 | `ERC20_SOHM_V2` (treasury only, from 18,260,000) |
| `0x0822f3c03dcc24d200aff33493dc08d0e1f274a2` | Staking v1 | 12,085,272 | `stakingContracts.v1` |
| `0xfd31c7d00ca47653c6ce64af53c1571f9c36566a` | Staking v2 | 12,622,679 | `stakingContracts.v2` |
| `0xbe731507810C8747C3E01E62c676b1cA6F93242f` | Staking Distributor v1 | 12,139,469 | missing |
| `0x886CE997aa9ee4F8c2282E182aB72A705762399D` | Treasury v1 | 12,085,425 | `TREASURY_ADDRESS_V1` |
| `0x31f8cc382c9898b273eff4e0b7626a6987c846e8` | Treasury v2 | 12,525,281 | `TREASURY_ADDRESS_V2` |
| `0x245cc372C84B3645Bf0Ffe6538620B04a217988B` | DAO wallet | 12,037,372 | `DAO_WALLET` |
| `0x0EFFf9199Aa1Ac3C3E34E957567C1BE8bF295034` | v1 CirculatingSupply oracle | 12,235,926 | missing (tests only) |
| `0xd27001d1aAEd5f002C722Ad729de88a91239fF29` | OHM-DAI SLP bond 1 (oracle exclusion) | 12,154,429 | missing |
| `0x13E8484a86327f5882d1340ed0D7643a29548536` | OHM-DAI SLP bond 2 (oracle exclusion) | 12,368,362 | missing |
| `0xcE6568338708400D03F430d29F2Eb40a33a3f4C4` | oracle exclusion, role unconfirmed | 12,368,301 | missing |
| `0x39Baa524eab3f5C9D0738BdF781c3eC9C8D34867` | oracle exclusion, role unconfirmed | 12,096,817 | missing |
| `0xC7f56EC779cB9e60afA116d73F3708761197dB3d` | oracle exclusion, role unconfirmed | 12,092,047 | missing |
| `0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c` | Sushi OHM-DAI v1 (main v1 price source) | 12,092,097 | missing |
| `0xfffae4a0f4ac251f4705717cd24cadccc9f33e06` | Sushi OHM-ETH v1 | 12,310,798 | missing |
| `0x2dce0dda1c2f98e0f171de8333c3c6fe1bbf4877` | Uni OHM-FRAX v1 | 12,563,434 | missing |
| `0xfdf12d1f85b5082877a6e070524f50f6c84faa6b` | Sushi OHM-LUSD v1 | 13,327,921 | missing |
| `0xB612c37688861f1f90761DC7F382C2aF3a50Cc39` | Uni OHM-FRAX v2 | 13,823,710 | missing |
| `0x46E4D8A1322B9448905225E52F914094dBd6dDdF` | Sushi OHM-LUSD v2 | 14,381,693 | missing |
| `0x0316508a1b5abf1CAe42912Dc2C8B9774b682fFC` | Onsen allocator | 12,744,441 | missing |
| `0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd` | Sushi MasterChef v1 (pids 185, 323) | before 11,000,000 | missing |
| `0xD18140b4B819b895A3dba5442F959fA44994AF50` | vlCVX v1 | 13,153,663 | missing (only v2) |
| `0x090185f2135308BaD17527004364eBcC2D37e5F6` | SPELL | 12,454,535 | missing |
| `0x43D4A3cd90ddD2F8f4f693170C9c8098163502ad` | PRIME (symbol D2D) | 13,726,726 | missing |
| `0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8` | agEUR (symbol EURA) | 13,473,069 | missing |
| `0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa` | UniV3 WETH-wstETH | 15,384,250 | `LP_UNISWAP_V3_WETH_WSTETH`, start block wrong |
| `0xdf9ab3c649005ebfdf682d2302ca1f673e0d37a2` | UniV3 WETH-BTRFLY v1 | 13,826,232 | `LP_UNISWAP_V3_WETH_BTRFLY_V1`, start block wrong |

Known-gap tokens (no Envio price path): CRV `0xD533a949740bb3306d119CC777fa900bA034cd52`,
ALCX `0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF`, FOX
`0xc770EEfAd204B5180dF6a14Ee197D99d808ee52d`, KP3R
`0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44`, SYN
`0x0f2D719407FdBeFF09D87557AbB7232601FD9F29`, THOR
`0xa5f2211B9b8170F694421f2046281775E8468044`, SUSHI
`0x6B3595068778DD592e39A122f4f5a5cF09C90fE2`.
