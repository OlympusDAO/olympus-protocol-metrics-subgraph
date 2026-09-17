# Robinhood USDG and Mellow treasury coverage

## Scope

Track the Olympus Robinhood Safe's idle USDG, rUSDG shares and unsettled Mellow
redemption claims. Do not count the vault or subvault's assets a second time.
No transactions, approvals, vault deposits or deployment changes are performed
by this contribution. Upstream maintainers own review, merge and deployment.

## Chain and addresses

All addresses are on Robinhood mainnet (4663).

| Role | Address |
| --- | --- |
| Treasury Safe | `0x317e0F5EF883DB95f8fFB5B995b8457903873608` |
| USDG (6 decimals) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Vault | `0xCe939C136cFfd80747e61f45F17EFdcd4D4abD3B` |
| rUSDG share manager (18 decimals) | `0xf04c58853D54f2445989108C29087F1A61C034cB` |
| Oracle | `0x4336739985da716436460f8E644c03120d334521` |
| Deposit queue | `0x4Cb16151eB97Ec29D3fDfc79CCe2233500A80389` |
| Redeem queue | `0x873ff30c29450bf4bEB3AfBBB0372a4b47b4969C` |
| Fee manager | `0x9f0037d790A45d927563eE99BA961eABC7C27618` |
| Robinhood subvault (not a second treasury wallet) | `0x9bc492d675f2d65F7454456455C3c4F597Dce046` |

Safe version 1.4.1, threshold two/four owners, reciprocal vault/manager/oracle and
queue-asset links were checked at block 65,021,733. The on-chain implementation
slots and verified implementation bytecode identify the accounting code below.

## Verified source provenance

Blockscout browser-context API `/api/v2/smart-contracts/<implementation>` returned
verified source and ABI. Use the **implementation**, not merely verified proxy
code. Verified source discovery was intermittent (HTTP 500); no new API key was
needed. SHA-256 below hashes the lowercase `0x`-prefixed deployed-bytecode string.
Each hash was independently reproduced via `eth_getCode` at block 65,044,796.

| Implementation | Source | Bytecode SHA-256 |
| --- | --- | --- |
| `0x00000000C534B8680e3aa7165DeDc3Ab8781f602` | `src/managers/BurnableTokenizedShareManager.sol` | `4133a63d48e447364b8384694f1f05c025c748c6e55694e4140ab879ca962322` |
| `0x000000001cc8c3e40856e956db870095ef6c98bd` | `src/queues/SyncDepositQueue.sol` | `e45e71b1dcc7247b59fe268df1b098128a7166b381dca23addbcfdf51ffdece6` |
| `0x0000000045d70ee8145135f08309ff5b1a63d43f` | `src/queues/RedeemQueue.sol` | `9aa40259b94e71477ff8dc15cc6f8a7e065c1601dd3c43d663dd2bb81a68b2da` |
| `0x000000009adE4dAE1f868775A3f087945983f062` | `src/oracles/Oracle.sol` | `5036ea89f46cf0414aac1d99316d986caef5e735378f5c92127f1d5c78e9f87a` |

Explorer: <https://robinhoodchain.blockscout.com>.
Mellow's source commit `035700bacf4fcc0f9d2b9f36d66825133f07ddc6` also records the
exact vault/subvault in `scripts/jsons/robinhood:rUSDG:subvault0.json`:
<https://github.com/mellow-finance/flexible-vaults/tree/035700bacf4fcc0f9d2b9f36d66825133f07ddc6>.
Deployment verification uses Blockscout and bytecode, not that registry alone.

## Accounting

This is **not** an ERC4626 adapter. The verified share-manager inheritance gives:

- `activeSharesOf(account) = balanceOf(account)`.
- `sharesOf(account) = activeSharesOf(account) + claimableSharesOf(account)`.
- Share mint/burn/transfer uses OpenZeppelin ERC20 Transfer events. Do not also
  count Mellow's custom Mint/Burn/Lock events as balance changes.
- Locking redemption shares transfers them from the wallet to the share manager.
  The wallet's `sharesOf` therefore excludes them.

The verified SyncDepositQueue transfers USDG and mints shares in one transaction;
there is no pending asynchronous deposit balance for this configured queue.
Deposits use the oracle rate adjusted for the configured penalty and deposit fee.
The received share count already incorporates those charges.

The oracle interface specifies `sharesRaw = assetsRaw * priceD18 / 10^18`.
For 18-decimal rUSDG and 6-decimal USDG:

`USDG per whole rUSDG = 10^30 / priceD18`

At block **65,041,639**, timestamp **1789615368**, the report was
`(988781355978366146250746960814, 1789551327, false)`, equivalent to approximately
**1.011345929971074 USDG/share**. USDG was supported by the oracle. This is a
historical report-value fixture, not a live quote or immediate redemption value.
The report was 64,041 seconds old. The oracle interface requires protocol and
performance fees to be reflected in submitted prices; do not subtract them again.

For redemptions, enumerate all pages of `requestsOf(account, offset, limit)`:

1. Unprocessed requests: value the returned **post-redemption-fee** locked shares
   at report NAV. Never add the original pre-fee amount or wallet shares twice.
2. Processed requests: use the fixed `assets` amount, even if liquidity is not
   yet claimable. Do not mark it liquid or reprice it with later share NAV.
3. Claimed requests disappear from the queue; the received USDG appears in idle
   wallet balance. If proceeds go elsewhere, do not fabricate a Safe holding.

Track `ReportHandled.timestamp` to distinguish processed zero-asset rounding
claims from unprocessed shares. `assets == 0` or `isClaimable == false` alone is
not sufficient. Persist both the current cutoff and immutable event updates.
An already-priced request with missing cutoff history aborts the snapshot.

Total = idle USDG + active/claimable-share NAV + unprocessed locked-share NAV +
fixed redemption claims. No separate vault backing or internal vault liability
is added/subtracted. Shares and all queued claims are `isLiquid: false`; idle
USDG is `isLiquid: true` under the existing treasury metric convention, not a
claim that all balances are unencumbered operational cash.

### Price and freshness policy

USDG uses an **explicit nominal $1 stable handler**, as used for stable assets
elsewhere in this indexer. No market-price feed or executable quote is claimed;
a USDG depeg would not be reflected by this nominal valuation.

When share NAV is needed, reject zero, suspicious, future-dated or stale reports.
Freshness uses the live SyncDepositQueue `maxAge` (86,400 seconds at the baseline).
This is a conservative indexing policy aligned with the queue's deposit limit,
not a claim that NAV becomes economically zero after one day. Fail the snapshot
rather than omit the position and publish an understated treasury. Existing
published snapshot timestamps must remain visible to operators. Fixed claims do
not need valid current NAV. Zero holdings emit nothing.

## Start point and historical coverage

Use block **65,044,796**, timestamp **1789615687** (2026-09-17 UTC), as the
**position baseline**, not a contract deployment block. At that exact block:

- `USDG.balanceOf(Safe) = 0`.
- `rUSDG.sharesOf(Safe) = 0`.
- `RedeemQueue.requestsOf(Safe, 0, 100) = []`.
- `SyncDepositQueue.syncDepositParams() = (0, 86400)`.

All subsequent transfers and ReportHandled events are replayed from this block.
There is no pre-existing position or request requiring seeding. This integration
makes no claim about earlier Robinhood treasury history. Any future expansion to
an earlier holding must move the baseline and reconcile initial queue state.
Robinhood is included in missing-chain coverage only from 2026-09-17 onward.
Legacy cross-chain-complete semantics (Ethereum + Arbitrum) are preserved.

The measured 1,000-block interval ending at the baseline was 101 seconds. A
288,000-block snapshot interval targets roughly eight hours at 0.1s/block.
No OHM address, circulating-supply wallet exclusion or OHM supply is invented.
Native ETH/gas tracking is outside this USDG strategy scope.

## Ingestion, verification and deployment

Envio lists Robinhood HyperSync support at <https://envio.dev/chains/robinhood>.
An authenticated query returned the USDG funding events at block 65,047,107,
including the Safe receipt described below. A full native local HyperSync replay
has not yet been completed in this validation environment; deployment still needs
to verify indexed progress and persisted records.

Use an archive-capable RPC for block-pinned contract state. The authenticated
QuickNode Robinhood Mainnet archive replay passed at the baseline block, so the
public RPC is not relied upon for historical-state evidence.

The change spans ingestion, cached block-aware reads, treasury records, global
rollups, publisher chain mapping, artifact/client chain names and environment
validation. Tests cover zero/pre-start cases, non-unit NAV/mixed decimals,
staleness, fee-netted shares, pending/fixed/dust claims and exactly-once totals.
The client changelog and package metadata record additive chain coverage as
v3.1.0 (September 2026), as requested in review; no package is published by this PR.

After upstream deployment, verify the accepted commit, index progress past the
baseline, the Safe's token and queue records, snapshot timestamps and exactly-once
inclusion in published metrics. Merge or passing unit tests alone do not establish
that deployment/indexing gate. No maintainer outreach or production mutation was
performed during preparation.

Reproduce the block-pinned empty baseline, EIP-1967 mappings and all four deployed
bytecode hashes with `pnpm exec tsx scripts/verify-robinhood-mellow.ts`. This is
read-only; historical RPC failures are infrastructure failures, not zero values.

### Funding observed during development

After the empty baseline, the Safe received **499,977.966094 USDG** at block
**65,047,107** in transaction
`0x76e566c7dc4f6d12bc12d3cb07df31a42745bc05b7ca5b31f45f13e98b81c87d`
(receipt status 1). The transfer log was retrieved directly over RPC from the
configured baseline onward. This confirms the start point precedes acquisition.
Until deployment, this funded position is an explicit treasury coverage gap.

The standalone evidence replay later hit `historical state ... is not available`
on the public RPC, confirming that endpoint prunes state rapidly. An authenticated
QuickNode archive replay subsequently passed the same zero-state calls and four
implementation-bytecode assertions at block 65,044,796 (hash
`0x6824fa9cb985151e753cdefb9318ae9d6abc5b3927dc86e8e6c85fad70910965`).
Etherscan proxy responses must not be assumed to honor historical block tags.

### Funded-wallet verification (2026-09-17 UTC)

Read-only live verification passed at Robinhood block **65,091,877**, timestamp
**1789620422**, hash
`0x31f8514e9fde805e267874bc8c3c6dbb3b2fe3841b6cc2bad0b6964c88626172`:

- Chain ID 4663; USDG decimals 6.
- Funding receipt succeeded at block 65,047,107 with one USDG Transfer to the Safe
  for raw amount `499977966094` (499,977.966094 USDG).
- A fresh block-pinned balance read matched that raw amount.
- The production balance-effect body and idle-token snapshot builder produced
  one USDG record. Per-chain/global aggregation of that scoped record set was
  499,977.966094 nominal USD, with no duplicate record.
- This is an **idle-USDG-only** verification. The test supplies the effect dispatch
  boundary; it does not exercise Envio scheduling/cache, HyperSync ingestion,
  Mellow balances or the publisher. Other chains are not part of this total.

Reproduce (read-only, explicit opt-in; requires funds to remain unchanged):

```sh
ROBINHOOD_LIVE_VERIFY=1 pnpm --dir apps/indexer exec vitest run tests/handlers/RobinhoodFunding.test.ts
```

The default offline suite includes a receipt-sized historical balance fixture
(zero baseline then funded snapshot) and an unavailable-state regression. The
fixture is not an actual historical replay. A fresh public-RPC baseline probe
still returned `historical state ... is not available`.

Verification exposed a shared effect that previously converted failed balance
reads to zero. Robinhood reads now throw a sanitized error instead, preventing
RPC/pruning failure from silently omitting the funded position. Other chains'
existing behavior is unchanged. Existing effect-cache entries from any earlier
experimental deployment must not be reused if they contain error-derived zeroes.

Archive-backed baseline replay and authenticated HyperSync event retrieval are
verified. Native local HyperSync replay and deployed publisher readback remain
operational gates; this evidence does not claim production indexing or publication.

## Reviewer navigation and revisions (September 2026)

- **Wallet and tokens:** `src/snapshot/chains/robinhood.ts` registers the Safe in
  `protocolAddresses`, USDG as a six-decimal liquid stable asset and rUSDG as an
  eighteen-decimal illiquid receipt. `Erc20Transfers.ts` consumes the same wallet
  list for both its event filter and balance updates. `config.yaml` subscribes
  the two contracts; it is not the wallet or valuation registry.
- **USDG valuation:** the `usdg-nominal-usd` stable handler prices idle USDG at
  nominal $1. This works before any vault deposit and is not a market-price feed.
- **rUSDG valuation:** `pushTokenBalanceRecords` now dispatches the registered
  share token to `pushMellowRecords`, replacing the separate orchestration call.
  This adapter reads wallet/claimable shares plus queued claims and uses the
  verified inverse oracle conversion; an ordinary ERC20/$1 path would be wrong.
- **Queue terms:** `pendingShares` are post-fee locked shares awaiting pricing;
  `fixedAssets` are priced USDG claims awaiting payment. Only the former floats
  with NAV. Neither is counted in idle USDG or liquid backing.
- **OHM guards:** Robinhood has no configured verified OHM deployment. Supply
  conversion, total-supply emission and treasury OHM exclusions therefore exit
  without producing fictitious OHM records. Treasury asset records still run.
- **Coverage:** indexer and publisher/API now share `expectedChainIds` and a
  data-driven start-date map. Requiring Robinhood before the captured baseline
  would incorrectly mark previously complete historical days as missing a chain.
- **Viem:** both direct dependencies use 2.56.3 and import `robinhood` from
  `viem/chains`. This includes mainnet chain 4663 and satisfies the repository's
  minimum-release-age policy; no guardrail override was used.
- **Client:** additive chain coverage is versioned as v3.1.0, September 2026,
  with matching package metadata. This PR does not publish the package.

Offline registration tests exercise the production transfer filter and handler
for both assets. A mixed-position snapshot test covers idle USDG, wallet rUSDG,
pending shares and fixed assets through one token pass, asserting four distinct
records and excluding all vault/queue exposure from liquid backing. These tests
are deterministic fixtures, not new authenticated replay or deployment evidence.
