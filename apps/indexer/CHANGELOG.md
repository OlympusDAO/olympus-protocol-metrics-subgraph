# Changelog

All notable changes to this package will be documented in this file. Dates are displayed in UTC.

## [v0.4.0] - 2026-10-26

- Index Olympus from OHM v1 launch (#336). Ethereum counts OHM v1 supply until the first OHM v2 mint (13,805,112), prices OHM v1 from the v1 SushiSwap pairs, and deducts the contracts the v1 CirculatingSupply oracle excluded, so v1 circulating supply matches that oracle exactly.
- Publish the index, staked OHM and APY before sOHM v3 from sOHM v1/v2 (`readPreV3SOhmState`).
- Value the pre-v2 treasury: the four OHM v1 pairs and the OHM-FRAX v2 / OHM-LUSD v2 pairs as protocol-owned liquidity, the Onsen allocator's MasterChef v1 stakes, and vlCVX v1 (illiquid).
- Value SPELL, PRIME (illiquid) and agEUR, which were also held after 2022-05-01, so this revises published market value and liquid backing for those dates.
- Require only Ethereum for `crossChainComplete` before 2022-05-01, Arbitrum's first snapshot date.
- Start the UniV3 WETH-wstETH and WETH-BTRFLY v1 pricing handlers at pool creation.

## [v0.3.3] - 2026-10-23

- Add a per-chain `ohmTotalSupplyEndBlock` so L2 OHM total supply stops counting once bridged OHM is locked in the mainnet CCIP lock/release pool. From that block the chain emits a zero Total Supply row, so the Total Supply category a snapshot wrote earlier the same UTC day doesn't outlive the cutover in the published `ohmSupplyCategories`. L2 treasury and liquidity deductions still apply. Set on Arbitrum, Base and Berachain to the blocks matching the pool funding (Ethereum block 26,245,881, 2026-10-22T04:51:47Z).

## [v0.3.2] - 2026-10-23

- Bump the package version to trigger redeployment with the security and tooling refresh; no indexing behavior changes.

## [v0.3.1] - 2026-09-27

- Keep held and pending rUSDG at NAV outside liquid backing; split fixed redemption claims so only claimable USDG is liquid. Classify each row explicitly and document the required historical replay and publication checks.

## [v0.3.0] - 2026-09

- Index Ethereum ENA and sENA treasury holdings as non-liquid volatile assets.
- Value ENA through a validated one-hour Uniswap V3 ENA/WETH TWAP and sENA through its ERC4626 ENA conversion.

## [v0.2.0] - 2026-09

- Add Robinhood (chain ID 4663) treasury indexing from the configured position baseline.
- Track idle USDG, Mellow rUSDG shares and pending/fixed redemption claims without double counting.
- Include Robinhood in per-chain/global treasury metrics and published chain coverage.
