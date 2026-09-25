# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## [v0.3.0] - 2026-09

- Index Ethereum ENA and sENA treasury holdings as non-liquid volatile assets.
- Value ENA through its Uniswap V3 ENA/WETH market and sENA through its ERC4626 ENA conversion.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
