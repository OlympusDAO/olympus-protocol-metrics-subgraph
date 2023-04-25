import { diffString } from "json-diff";

import {
  calculateBackedSupply,
  calculateCirculatingSupply,
  calculateFloatingSupply,
  calculateLiquidBacking,
  calculateMarketValue,
  calculateMarketValueCategory,
} from "../../helpers/metrics";
import { formatCurrency, formatNumber, valuesEqual } from "../../helpers/number";
import { TokenRecord, TokenSupply } from "../../subgraph";
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

/**
 * Checks the market value and liquid backing, using the following formula:
 *
 * Market value = liquid backing + illiquid assets + # OHM in POL * OHM price
 *
 * @param tokenRecords
 * @param supplyRecords
 * @param ohmPrice
 * @param comparisonFile
 */
export const doLiquidBackingCheck = (
  tokenRecords: TokenRecord[],
  supplyRecords: TokenSupply[],
  ohmPrice: number,
  comparisonFile: ComparisonResults,
): void => {
  console.info("Doing sanity check of market value and liquid backing");
  const marketValue = calculateMarketValue(tokenRecords);
  const liquidBacking = calculateLiquidBacking(tokenRecords);
  const ohmInLiquidity = supplyRecords
    .filter((tokenSupply) => tokenSupply.type == "Liquidity")
    .reduce((previousValue, tokenSupply) => previousValue + +tokenSupply.balance, 0);
  const illiquidAssetsValue = tokenRecords
    .filter((tokenRecord) => tokenRecord.isLiquid == false)
    .reduce((previousValue, tokenRecord) => previousValue + +tokenRecord.value, 0);
  const marketValueCalculated = liquidBacking + illiquidAssetsValue + ohmInLiquidity * ohmPrice;

  const liquidBackingCheck = {
    marketValue: formatCurrency(marketValue),
    liquidBacking: formatCurrency(liquidBacking),
    ohmInLiquidity: formatNumber(ohmInLiquidity),
    ohmPrice: formatCurrency(ohmPrice),
    illiquidAssets: formatCurrency(illiquidAssetsValue),
    diff: formatCurrency(marketValueCalculated - marketValue),
    result: valuesEqual(marketValueCalculated, marketValue, 1),
    output: "",
  };
  liquidBackingCheck.output = `**Liquid Backing Check (Current Branch Only):**
    Purpose: *Does a sanity check between market value and liquid backing for the current branch. A difference in the value indicates that a change in assets or categorisation has broken the consistency of the formula.*
    Formula: Market value = liquid backing + illiquid assets + # OHM in POL * OHM price
    Market Value: ${liquidBackingCheck.marketValue}
    Liquid Backing: ${liquidBackingCheck.liquidBacking}
    Illiquid Assets: ${liquidBackingCheck.illiquidAssets}
    OHM in Protocol-Owned Liquidity (Balance): ${liquidBackingCheck.ohmInLiquidity}
    OHM Price: ${liquidBackingCheck.ohmPrice}
    Difference in Value: ${liquidBackingCheck.diff}
    Result: ${liquidBackingCheck.result ? CHECK : CROSS}`;
  comparisonFile.results.liquidBackingCheck = liquidBackingCheck;
};

export const compareCirculatingSupplyRecords = (
  baseRecords: TokenSupply[],
  branchRecords: TokenSupply[],
  comparisonFile: ComparisonResults,
): void => {
  console.info("Comparing circulating supply");
  const circulatingSupplyBase = calculateCirculatingSupply(baseRecords);
  const circulatingSupplyBranch = calculateCirculatingSupply(branchRecords);

  // Output to file
  const circulatingSupplyResults = {
    base: formatNumber(circulatingSupplyBase),
    branch: formatNumber(circulatingSupplyBranch),
    diff: formatNumber(circulatingSupplyBranch - circulatingSupplyBase),
    result: valuesEqual(circulatingSupplyBase, circulatingSupplyBranch),
    output: "",
  };
  circulatingSupplyResults.output = `**Circulating Supply (Branch Comparison):**
  Purpose: *Shows the difference in circulating supply between branches. If the numbers differ, it may be due to assets/wallets being added/removed. Check that the difference is expected, and refer to the TokenSupply diff below for more details.*
  Base: ${circulatingSupplyResults.base}
  Branch: ${circulatingSupplyResults.branch}
  Difference in Quantity: ${circulatingSupplyResults.diff}
  Result: ${circulatingSupplyResults.result ? CHECK : CROSS}`;
  comparisonFile.results.circulatingSupply = circulatingSupplyResults;
}

export const compareFloatingSupplyRecords = (
  baseRecords: TokenSupply[],
  branchRecords: TokenSupply[],
  comparisonFile: ComparisonResults,
): void => {
  console.info("Comparing floating supply");
  const floatingSupplyBase = calculateFloatingSupply(baseRecords);
  const floatingSupplyBranch = calculateFloatingSupply(branchRecords);

  // Output to file
  const floatingSupplyResults = {
    base: formatNumber(floatingSupplyBase),
    branch: formatNumber(floatingSupplyBranch),
    diff: formatNumber(floatingSupplyBranch - floatingSupplyBase),
    result: valuesEqual(floatingSupplyBase, floatingSupplyBranch),
    output: "",
  };
  floatingSupplyResults.output = `**Floating Supply (Branch Comparison):**
  Purpose: *Shows the difference in floating supply between branches. If the numbers differ, it may be due to assets/wallets being added/removed. Check that the difference is expected, and refer to the TokenSupply diff below for more details.*
  Base: ${floatingSupplyResults.base}
  Branch: ${floatingSupplyResults.branch}
  Difference in Quantity: ${floatingSupplyResults.diff}
  Result: ${floatingSupplyResults.result ? CHECK : CROSS}`;
  comparisonFile.results.floatingSupply = floatingSupplyResults;
}

export const compareBackedSupplyRecords = (
  baseRecords: TokenSupply[],
  branchRecords: TokenSupply[],
  comparisonFile: ComparisonResults,
): void => {
  console.info("Comparing backed supply");
  const backedSupplyBase = calculateBackedSupply(baseRecords);
  const backedSupplyBranch = calculateBackedSupply(branchRecords);

  // Output to file
  const backedSupplyResults = {
    base: formatNumber(backedSupplyBase),
    branch: formatNumber(backedSupplyBranch),
    diff: formatNumber(backedSupplyBranch - backedSupplyBase),
    result: valuesEqual(backedSupplyBase, backedSupplyBranch),
    output: "",
  };
  backedSupplyResults.output = `**Backed Supply (Branch Comparison):**
  Purpose: *Shows the difference in backed supply between branches. If the numbers differ, it may be due to assets/wallets being added/removed. Check that the difference is expected, and refer to the TokenSupply diff below for more details.*
  Base: ${backedSupplyResults.base}
  Branch: ${backedSupplyResults.branch}
  Difference in Quantity: ${backedSupplyResults.diff}
  Result: ${backedSupplyResults.result ? CHECK : CROSS}`;
  comparisonFile.results.backedSupply = backedSupplyResults;
}

export const combineOutput = (network: string, comparisonFile: ComparisonResults): void => {
  // Generate a diff between the token records
  const recordsDiff = diffString(
    comparisonFile.records.tokenRecords.base,
    comparisonFile.records.tokenRecords.branch,
    { full: true, color: false },
  );
  const supplyDiff = diffString(
    comparisonFile.records.tokenSupplies.base,
    comparisonFile.records.tokenSupplies.branch,
    { full: true, color: false },
  );

  comparisonFile.results.output = `**Network:** ${network}
  **Block Tested:** ${comparisonFile.latestBlock}
  
  **Subgraph Id:**
  Base: ${comparisonFile.branches.base.subgraphId}
  Branch: ${comparisonFile.branches.branch.subgraphId}
  
  ## Asset Records
  ${comparisonFile.results.marketValue.output}

  ${comparisonFile.results.liquidBacking.output}

  ${comparisonFile.results.marketValueCheck.output}

  ${comparisonFile.results.liquidBackingCheck.output}

  <details>
    <summary>Diff of TokenRecord</summary>

    \`\`\`diff
    ${recordsDiff}
    \`\`\`
    
  </details>

  ## Supply Records
  ${comparisonFile.results.circulatingSupply.output}

  ${comparisonFile.results.floatingSupply.output}

  ${comparisonFile.results.backedSupply.output}

  <details>
    <summary>Diff of TokenSupply</summary>

    \`\`\`diff
    ${supplyDiff}
    \`\`\`

  </details>
  `;
};
