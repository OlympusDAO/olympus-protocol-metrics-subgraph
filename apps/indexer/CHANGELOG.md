# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## [v0.2.1] - 2026-09-27

- Keep held and pending rUSDG at NAV outside liquid backing; split fixed redemption claims so only claimable USDG is liquid. Classify each row explicitly and document the required historical replay and publication checks.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
