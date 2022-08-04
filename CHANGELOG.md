# Subgraph Changelog

## 2.0.75 (2022-08-04)

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
