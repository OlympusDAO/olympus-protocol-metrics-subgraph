# Subgraph Changelog

## 4.9.2 (2023-07-07)

- Adds manual deployments for Silo and Euler
- Going forward, OHM minted for BLV is included in circulating and floating supply
- Indexes OHM borrowed using the IncurDebt contract

## 4.8.3 (2023-05-09)

- Remove duplication of staking/locking messages in contract names
- Add Chainlink price feed for LUSD
- Index Liquidity stability pool directly, instead of through the LUSD allocator
- Add contract name for boosted liquidity vaults
- Amend the way Euler and Silo manual deployments are identified
- Record additional Euler and Silo deployments
- Shift to recording OHM supplied to Euler and Silo as running balance snapshots, instead of individual transactions

## 4.7.0 (2023-03-27)

- Include the OHM requivalent of gOHM and sOHM in protocol- and DAO-owned wallets when calculating supply metrics.
- Remove the Olympus Association wallet from being included in supply metrics, as it is not protocol- or DAO-owned.
- The above two changes apply to metric values calculated after `GOHM_INDEXING_BLOCK`, to maintain auditability of historical data and reports.

## 4.5.1 (2023-03-24)

- Removes OHM (and variants) in the DAO working capital address from being listed as in the treasury

## 4.5.0 (2023-03-19)

- Adds the DAO working capital multi-sig to indexed and circulating supply wallets

## 4.4.4 (2023-03-17)

- Add additional deployment of OHM to Silo
- Support for OHM minted for Boosted Liquidity Vaults

## 4.3.1 (2023-03-29)

- The names of staked/locked/earned tokens are differentiated from raw tokens, to avoid clobbering. #194
- Add LDO, SUSHI and agEUR tokens

## 4.2.14 (2023-03-27)

- Adds support for deployments (currently DAI) into Myso Finance and Vendor Finance lending markets (https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/issues/191)

## 4.1.0 (2023-03-16)

- Add the ability to define a multiplier used in calculating liquid backing. This is used for tokens where the protocol
owns a significant percentage of the token's total supply, and exchanging the token would incur considerable slippage. Currently, these are: BOND, KLIMA, JONES, rlBTRFLY, VSTA.

## 4.0.2 (2023-03-13)

- Shift from whitelisting assets in the DAO wallet to a blacklist (since many assets are held there now)

## 3.9.11 (2023-03-11)

- Utilise Chainlink price feeds for USDC and DAI, instead of assuming = $1
- Utilise Chainlink price feed for ETH
- Shifts price resolution for stable-ish assets away from a hard-coded value (still WIP)

## 3.8.18 (2023-03-10)

- Fix locked/unlocked balances with rlBTRFLY

## 3.8.17 (2023-03-07)

- Add Olympus Association wallet to the circulating supply wallets
- Add support for revenue-locked BTRFLY (rlBTRFLY), which is excluded from liquid backing due to high slippage
- Correct categorisation of Curve FraxBP
- Add missing proxy contract for staked OHM-FraxBP
- Add token lookup for wstETH
- Add POL entry for OHM-wstETH pool in Balancer (including the Balancer gauge and Aura vault)

## 3.7.14 (2023-03-03)

- Minor code change to force re-indexing

## 3.7.13 (2023-02-21)

- Implement caching of on-chain values to reduce eth_call use and improve indexing performance

## 3.6.13 (2023-02-21)

- Adds support for the Balancer OHM-DAI LP staked in Aura
- Fixes issue with staking addresses for OHM-WETH LP staked in Aura

## 3.6.8 (2023-02-17)

- Adds support for the Balancer OHM-WETH LP staked in Aura

## 3.6.0 (2023-02-14)

- Adds OHM deployed into the Euler and Silo lending markets

## 3.5.7 (2023-02-06)

- Adds support for deposits into the Maker DSR

## 3.4.4 (2023-02-06)

- Indexing of Aura Allocator v2
- Adds support for staking and rewards related to BAL, bb-a-USD, auraBAL, vlAura

## 3.3.11 (2023-01-30)

- Index OHM bonds using Gnosis Easy Auctions
- Include bonds to the circulating/floating supply calculations
- Remove price-snapshot from protocol-metrics, as it now has its own subgraph
- Remove redundant subgraph data sources: bonds, sOHM
- Shift trigger for ProtocolMetrics from stake() function call to LogRebase event, which should increase the speed of indexing

## 3.2.16 (2023-01-26)

- Amend title of FraxBP staked in Convex and Frax

## 3.2.15 (2023-01-23)

- Re-define illiquid assets as those locked for more than one year
- Set vlCVX and vlAURA to be considered _liquid_, consequently. veFXS remains _illiquid_, as it is > 1 year

## 3.2.13 (2023-01-20)

- Add CRV/CVX and related tokens to the DAO whitelist, so they are properly indexed

## 3.2.12 (2023-01-18)

- Add OTC escrow to treasury wallets

## 3.2.11 (2023-01-09)

- Adds support for FraxBP staked in Convex/locked in Frax

## 3.1.9 (2022-12-21)

- Added new bond teller contract to recognised wallets

## 3.1.7 (2022-11-29)

- Added market value, liquid backing and other related metrics to the daily summary record (`ProtocolMetric`) in a way that does not slow down indexing.

## 3.1.5 (2022-11-28)

- Added OHM-FraxBP liquidity pool in the DAO wallet to the whitelist
- Added Balancer OHM-DAI liquidity pool to the OHM price lookup
- Fixed failing tests

## 3.1.0 (2022-11-18)

- Added support for Barnbridge governance token (BOND)
- Added support for Curve FraxBP (FRAX-USDC) and OHM-FRAXBP liquidity pools
- Added support for new OHM-DAI and OHM-WETH pools in Balancer (#31)
- Added per-block price snapshot
- Added support for the new treasury (TRSRY) deployed alongside RBS

## 3.0.29 (2022-09-21)

- Add support for BTRFLY V1 and V2 tokens and protocol-owned liquidity (#41 and #67)
- Improve the accuracy of price lookup for LQTY
- Add support for FraxSwap V2 pool
- Remove hard-coded vesting assets (#3)
- Split the calculation of bond discounts into a new data source
- Create infrastructure to support the development of blockchain-specific subgraphs
- Adds support for Arbitrum, Fantom and Polygon blockchains (#17)
- Adds support for Balancer liquidity pools staked in AURA

## 3.0.2 (2022-08-25)

- The purpose of this release is primarily to achieve significant (~15x) increases in the speed of indexing (#56). See README.md for documentation on this.
- Renames `Convex - Vote-Locked - Unlocked (vlCVX)` -> `Convex - Unlocked (vlCVX)`

## 2.0.80 (2022-08-08)

- Adjust starting block from 15050000 (1st July 2022) to 14690000 (1st May 2022)

## 2.0.79 (2022-08-04)

- Remove gOhmCirculatingSupply, gOhmCirculatingSupplyBreakdown, treasuryLiquidBackingPerGOhmCirculating. Never used and could be misleading
- Add treasuryLiquidBackingPerGOhm that uses a synthetic calculation for the liquid backing per gOHM (#33)
- Apply write-off for Rari Fuse (#35)
- Add support for FraxSwap pairs, starting with OHM-FRAX (#34)
- Reduce chances of data clobbering by making clear the source of token records
- Add support for AURA and vlAURA
- Add suffix to tokens that are staked but don't have a different token, so it's clear when looking at asset lists
- Address duplication of reported veFXS balance
- Upgrade to graph-cli 0.33.0
- Rename token labels so that non- and staked/locked versions are grouped together
- Dynamically choose the liquidity pool to determine the price of OHM in USD based on which has higher reserves (#23)
- Updates direct and indirect dependencies
- Make it easier to have suffixes (e.g. "Locked") and abbreviations with contract names
- Re-defined vote-locked Convex (vlCVX) tokens as illiquid, based on policy's input
- Add support for unlocked vlCVX (#48)

## 2.0.41 (2022-07-22)

- Add metrics for gOHM circulating and total supply
- Add metrics liquid backing per gOHM, stable/volatile/POL for liquid backing
- Add support for gauge deposits of Balancer pools
