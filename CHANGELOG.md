# Subgraph Changelog

## 3.0.12 (2022-08-26)

- Add support for BTRFLY V1 and V2 tokens and protocol-owned liquidity (#41 and #67)
- Improve the accuracy of price lookup for LQTY
- Split the calculation of bond discounts into a new data source

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
