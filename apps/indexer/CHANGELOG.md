# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## [v0.3.2] - 2026-10-22

- Add a per-chain `ohmTotalSupplyEndBlock` so L2 OHM total supply stops counting once bridged OHM is locked in the mainnet CCIP lock/release pool. From that block the chain emits a zero Total Supply row, so the Total Supply category a snapshot wrote earlier the same UTC day doesn't outlive the cutover in the published `ohmSupplyCategories`. L2 treasury and liquidity deductions still apply. Set on Arbitrum, Base and Berachain to the blocks matching the pool funding (Ethereum block 26,245,881, 2026-10-22T04:51:47Z).

## [v0.3.1] - 2026-09-27

- Keep held and pending rUSDG at NAV outside liquid backing; split fixed redemption claims so only claimable USDG is liquid. Classify each row explicitly and document the required historical replay and publication checks.

## [v0.3.0] - 2026-09

- Index Ethereum ENA and sENA treasury holdings as non-liquid volatile assets.
- Value ENA through a validated one-hour Uniswap V3 ENA/WETH TWAP and sENA through its ERC4626 ENA conversion.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
