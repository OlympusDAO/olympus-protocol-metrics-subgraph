# Subgraph Changelog

## 2.0.63 (2022-08-02)

- Remove gOhmCirculatingSupply, gOhmCirculatingSupplyBreakdown, treasuryLiquidBackingPerGOhmCirculating. Never used and could be misleading
- Add treasuryLiquidBackingPerGOhm that uses a synthetic calculation for the liquid backing per gOHM (#33)
- Apply write-off for Rari Fuse (#35)
- Add support for FraxSwap pairs, starting with OHM-FRAX (#34)
- Reduce chances of data clobbering by making clear the source of token records
- Add support for AURA and vlAURA
- Add suffix to tokens that are staked but don't have a different token, so it's clear when looking at asset lists
- Address duplication of reported veFXS balance

## 2.0.41 (2022-07-22)

- Add metrics for gOHM circulating and total supply
- Add metrics liquid backing per gOHM, stable/volatile/POL for liquid backing
- Add support for gauge deposits of Balancer pools
