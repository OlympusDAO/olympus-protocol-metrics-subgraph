# Robinhood treasury integration preparation

Status: evidence and implementation specification; not indexing-ready.

## Repository baseline

- Upstream: `OlympusDAO/olympus-protocol-metrics-subgraph`, `master`.
- Base: `63454a0c07387c4797a0c5e52b75ae9cab2d1023`.
- Transport fork: `zeroxzerollc/olympus-protocol-metrics-subgraph` (verified).
- Branch: `feat/robinhood-mellow-treasury`.
- Class: upstream Olympus contribution. Upstream maintains merge/deployment authority.
- No production deployment or financial execution is part of this preparation.
- Node 24.19.0, pnpm 10.34.1; frozen installation, codegen, check, build and
  test commands all exited zero on the unmodified base. Indexer tests included
  149 passes and three skips; passing unit tests do not establish live ingestion.

## Scope and addresses

All addresses below are on Robinhood mainnet, chain ID 4663.

| Role | Address |
| --- | --- |
| Olympus treasury Safe | `0x317e0F5EF883DB95f8fFB5B995b8457903873608` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Mellow vault | `0xCe939C136cFfd80747e61f45F17EFdcd4D4abD3B` |
| rUSDG share manager | `0xf04c58853D54f2445989108C29087F1A61C034cB` |
| Oracle | `0x4336739985da716436460f8E644c03120d334521` |
| Deposit queue | `0x4Cb16151eB97Ec29D3fDfc79CCe2233500A80389` |
| Redeem queue | `0x873ff30c29450bf4bEB3AfBBB0372a4b47b4969C` |
| Robinhood subvault | `0x9bc492d675f2d65F7454456455C3c4F597Dce046` |

The intended outcome is idle USDG plus net rUSDG exposure, including any claims
that leave the wallet during settlement. Do not register vault/subvault backing
as additional Olympus wallet assets alongside the same receipt NAV.

## Evidence and qualifications

- At block 65,021,733, read-only checks returned matching vault/share/oracle and
  queue links, Safe version 1.4.1 with threshold two and four owners, USDG with
  six decimals and rUSDG with 18 decimals. These are historical observations.
- At block 65,025,059, deposit `name()` returned `SyncDepositQueue` and
  `syncDepositParams()` returned `(0, 86400)`. Redeem
  `requestsOf(address,uint256,uint256)` with the Safe, offset zero and limit 100
  returned an empty list. Share manager `sharesOf(Safe)` returned zero.
  Successful probes identify supported reads, not deployed-bytecode equivalence.
- The earlier reverting singular `requestOf(address)` must not be used to infer
  missing funds or select the asynchronous deposit interface.
- Mellow's public source at commit
  `035700bacf4fcc0f9d2b9f36d66825133f07ddc6` includes the exact vault and subvault
  in `scripts/jsons/robinhood:rUSDG:subvault0.json`.
- Source provenance: <https://github.com/mellow-finance/flexible-vaults/tree/035700bacf4fcc0f9d2b9f36d66825133f07ddc6>.
- Envio advertises first-class Robinhood support:
  <https://envio.dev/chains/robinhood>. The public HyperSync height endpoint
  responded at block 65,023,995. Historical query and HyperRPC requests returned
  HTTP 401 without an API token; height availability does not prove replay.
- Explorer verified-source requests returned HTTP 403. Sourcify returned no
  match for the vault. Public RPC historical-state probes previously failed.

## Accounting specification to verify before implementation

The candidate oracle conversion in the cited source is:

`sharesRaw = assetsRaw * priceD18 / 10^18`

Therefore candidate asset value per whole share is `10^30 / priceD18` for
18-decimal shares and six-decimal USDG, multiplied by the USDG dollar price.
Do not assume one dollar per rUSDG or silently value invalid reports at zero.
Confirm deployed semantics, report validity/freshness policy and USDG pricing
before introducing the handler.

The cited TokenizedShareManager source distinguishes wallet `balanceOf` from
`sharesOf` (active plus claimable shares), and locks redemption shares by
transferring them away from the user. The cited RedeemQueue exposes paginated
requests with shares, fixed assets and claimability. Verify deployed behavior
before combining any of these quantities: counting wallet shares plus the same
claim twice would overstate treasury value. A priced redemption claim is not
necessarily liquid or currently claimable. Do not revalue fixed redemption
assets at a later share price.

The deposit probes support a synchronous-deposit hypothesis. Do not create a
synthetic pending-deposit balance using the unrelated DepositQueue interface.
Verify actual mint/burn/lock events and fees before finalizing the formula.

## Required integration surfaces

Robinhood is absent from the current six-chain implementation. Cover:

1. Chain ingestion/configuration, RPC environment documentation and supported
   historical provider; separate ingestion, token and position start blocks.
2. Chain types/constants and configuration, treasury wallet and tokens,
   event-ledger registration and price/claim effects.
3. Block snapshot cadence based on Robinhood block timing; chain/global rollups.
4. Publisher chain-name mapping and artifact legacy-shape chain coverage.
5. Tests for zero and pre-start balances, non-unit share NAV and mixed decimals,
   claim lifecycle/fees, transfer double-count protection, and published totals.

## Outstanding gates

- Obtain verified deployed queue/oracle/share implementation provenance and
  corroborate the interfaces above. Source-tree similarity alone is insufficient.
- Obtain historical ingestion/state access and establish reproducible start
  blocks or a verified pre-position baseline. Never reuse Ethereum block numbers.
- Verify USDG dollar pricing and report-staleness/liquidity treatment.
- Implement the integration only after those accounting inputs are resolved,
  rerun checks, refresh upstream and submit the scoped PR.
- After upstream deployment, verify the accepted SHA, Robinhood progress and
  exactly-once inclusion in published treasury metrics. No funding or indexing
  completion is asserted by this document.
