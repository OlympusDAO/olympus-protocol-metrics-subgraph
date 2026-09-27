# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## Unreleased

- Review candidate: retain held/pending rUSDG at NAV outside liquid backing; split fixed claims so only claimable USDG is liquid. Make every row classification explicit and require historical replay before publication. Policy approval and release version assignment remain pending.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
