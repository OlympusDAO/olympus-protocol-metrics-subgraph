import { diffString } from "json-diff";

import {
  calculateLiquidBacking,
  calculateMarketValue,
  calculateMarketValueCategory,
} from "../helpers/metrics";
import { formatCurrency, formatNumber, valuesEqual } from "../helpers/number";
import { TokenRecord } from "../subgraph";
import { ComparisonResults } from "./results";

const CHECK = "✅";
const CROSS = "❌";

/**
 * Compares the market value from two branches, and adds the results to {comparisonFile}.
 *
 * Market value is calculated as: sum of the value (`value` property) of all TokenRecord objects for a given block.
 *
 * @param baseRecords
 * @param branchRecords
 * @param comparisonFile
 */
export const compareMarketValueRecords = (
  baseRecords: TokenRecord[],
  branchRecords: TokenRecord[],
  comparisonFile: ComparisonResults,
): void => {
  // Perform sums
  console.info("Comparing market value");
  const baseMarketValue = calculateMarketValue(baseRecords);
  console.info("Base = " + formatCurrency(baseMarketValue));
  const branchMarketValue = calculateMarketValue(branchRecords);
  console.info("Branch = " + formatCurrency(branchMarketValue));

  // Output to file
  const marketValueResults = {
    base: formatCurrency(baseMarketValue),
    branch: formatCurrency(branchMarketValue),
    diff: formatCurrency(branchMarketValue - baseMarketValue),
    result: valuesEqual(baseMarketValue, branchMarketValue),
    output: "",
  };
  marketValueResults.output = `**Market Value (Branch Comparison):**
  Purpose: *Shows the difference in market value between branches. If the numbers differ, it may be due to assets being added/removed. Check that the difference is expected, and refer to the TokenRecords diff below for more details.*
  Base: ${marketValueResults.base}
  Branch: ${marketValueResults.branch}
  Difference in Value: ${marketValueResults.diff}
  Result: ${marketValueResults.result ? CHECK : CROSS}`;
  comparisonFile.results.marketValue = marketValueResults;
};

/**
 * Compares the liquid backing from two branches, and adds the results to {comparisonFile}.
 *
 * Liquid backing is calculated as: sum of the value excluding OHM (`valueExcludingOhm` property) of all liquid TokenRecord objects (`isLiquid` = true) for a given block.
 *
 * @param baseRecords
 * @param branchRecords
 * @param comparisonFile
 */
export const compareLiquidBackingRecords = (
  baseRecords: TokenRecord[],
  branchRecords: TokenRecord[],
  comparisonFile: ComparisonResults,
): void => {
  // Perform sums
  console.info("Comparing liquid backing");
  const baseLiquidBacking = calculateLiquidBacking(baseRecords);
  console.info("Base = " + formatCurrency(baseLiquidBacking));
  const branchLiquidBacking = calculateLiquidBacking(branchRecords);
  console.info("Branch = " + formatCurrency(branchLiquidBacking));

  // Output to file
  const liquidBackingResults = {
    base: formatCurrency(baseLiquidBacking),
    branch: formatCurrency(branchLiquidBacking),
    diff: formatCurrency(branchLiquidBacking - baseLiquidBacking),
    result: valuesEqual(baseLiquidBacking, branchLiquidBacking),
    output: "",
  };
  liquidBackingResults.output = `**Liquid Backing (Branch Comparison):**
  Purpose: *Shows the difference in liquid backing between branches. If the numbers differ, it may be due to assets being added/removed. Check that the difference is expected, and refer to the TokenRecords diff below for more details.*
  Base: ${liquidBackingResults.base}
  Branch: ${liquidBackingResults.branch}
  Difference in Value: ${liquidBackingResults.diff}
  Result: ${liquidBackingResults.result ? CHECK : CROSS}`;
  comparisonFile.results.liquidBacking = liquidBackingResults;
};

/**
 * Checks the market value, using the following formula:
 *
 * Market value = market value (stable) + market value (volatile) + market value (POL)
 *
 * @param tokenRecords
 * @param comparisonFile
 */
export const doMarketValueCheck = (
  tokenRecords: TokenRecord[],
  comparisonFile: ComparisonResults,
): void => {
  console.info("Doing sanity check of market value");
  const marketValueTotal = calculateMarketValue(tokenRecords);
  const marketValueStable = calculateMarketValueCategory(tokenRecords, "Stable");
  const marketValueVolatile = calculateMarketValueCategory(tokenRecords, "Volatile");
  const marketValuePOL = calculateMarketValueCategory(tokenRecords, "Protocol-Owned Liquidity");
  const marketValueCalculated = marketValueStable + marketValueVolatile + marketValuePOL;

  const marketValueCheck = {
    marketValueTotal: formatCurrency(marketValueTotal),
    marketValueStable: formatCurrency(marketValueStable),
    marketValueVolatile: formatNumber(marketValueVolatile),
    marketValuePOL: formatCurrency(marketValuePOL),
    marketValueCalculated: formatCurrency(marketValueCalculated),
    diff: formatCurrency(marketValueCalculated - marketValueTotal),
    result: valuesEqual(marketValueCalculated, marketValueTotal, 1),
    output: "",
  };
  marketValueCheck.output = `**Market Value Check (Current Branch Only):**
    Purpose: *Does a sanity check of market value for the current branch. A difference in the value indicates that a change in assets or categorisation has broken the consistency of the formula.*
    Formula: Market value = market value (stable) + market value (volatile) + market value (POL)
    Market Value Total: ${marketValueCheck.marketValueTotal}
    Stable Assets: ${marketValueCheck.marketValueStable}
    Volatile Assets: ${marketValueCheck.marketValueVolatile}
    POL Assets: ${marketValueCheck.marketValuePOL}
    Market Value Calculated: ${marketValueCheck.marketValueCalculated}
    Difference in Value: ${marketValueCheck.diff}
    Result: ${marketValueCheck.result ? CHECK : CROSS}`;
  comparisonFile.results.marketValueCheck = marketValueCheck;
};

// Can't do the liquid backing check, as OHM isn't present on non-Ethereum chains

export const combineOutput = (network: string, comparisonFile: ComparisonResults): void => {
  // Generate a diff between the token records
  const recordsDiff = diffString(
    comparisonFile.records.tokenRecords.base,
    comparisonFile.records.tokenRecords.branch,
    { full: true },
  );

  comparisonFile.results.output = `**Network:** ${network}
  **Block Tested:** ${comparisonFile.latestBlock}
  
  **Subgraph Id:**
  Base: ${comparisonFile.branches.base.subgraphId}
  Branch: ${comparisonFile.branches.branch.subgraphId}
  
  ${comparisonFile.results.marketValue.output}

  ${comparisonFile.results.liquidBacking.output}

  ${comparisonFile.results.marketValueCheck.output}

  **Diff of TokenRecords:**
  \`\`\`diff
  ${recordsDiff}
  \`\`\`
  `;
};
