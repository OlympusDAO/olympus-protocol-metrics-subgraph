# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## Unreleased

- Include held Robinhood rUSDG shares in liquid backing at existing NAV; keep pending and fixed redemption claims non-liquid. This reporting classification does not imply instant redemption.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
