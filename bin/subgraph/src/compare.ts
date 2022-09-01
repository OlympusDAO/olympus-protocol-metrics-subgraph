import { readFileSync } from "fs";

import {
  calculateLiquidBacking,
  calculateMarketValue,
  calculateMarketValueCategory,
} from "./helpers/metrics";
import { formatCurrency, formatNumber, valuesEqual } from "./helpers/number";
import { ComparisonResults, writeComparisonFile } from "./helpers/results";
import { getOhmPrice, getTokenSupplies, TokenRecord, TokenSupply } from "./subgraph";

const getTokenRecordsFromFile = (filename: string): TokenRecord[] => {
  return JSON.parse(readFileSync(filename, "utf8"));
};

/**
 * Compares the market value from two branches, and adds the results to {comparisonFile}.
 *
 * Market value is calculated as: sum of the value (`value` property) of all TokenRecord objects for a given block.
 *
 * @param baseRecords
 * @param branchRecords
 * @param comparisonFile
 */
const compareMarketValueRecords = (
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
  };

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
const compareLiquidBackingRecords = (
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
  };

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
const doMarketValueCheck = (
  tokenRecords: TokenRecord[],
  comparisonFile: ComparisonResults,
): void => {
  console.info("Doing sanity check of market value");
  const marketValueTotal = calculateMarketValue(tokenRecords);
  const marketValueStable = calculateMarketValueCategory(tokenRecords, "Stable");
  const marketValueVolatile = calculateMarketValueCategory(tokenRecords, "Volatile");
  const marketValuePOL = calculateMarketValueCategory(tokenRecords, "Protocol-Owned Liquidity");
  const marketValueCalculated = marketValueStable + marketValueVolatile + marketValuePOL;

  comparisonFile.results.marketValueCheck = {
    marketValueTotal: formatCurrency(marketValueTotal),
    marketValueStable: formatCurrency(marketValueStable),
    marketValueVolatile: formatNumber(marketValueVolatile),
    marketValuePOL: formatCurrency(marketValuePOL),
    marketValueCalculated: formatCurrency(marketValueCalculated),
    diff: formatCurrency(marketValueCalculated - marketValueTotal),
    result: valuesEqual(marketValueCalculated, marketValueTotal, 1),
  };
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
const doLiquidBackingCheck = (
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

  comparisonFile.results.liquidBackingCheck = {
    marketValue: formatCurrency(marketValue),
    liquidBacking: formatCurrency(liquidBacking),
    ohmInLiquidity: formatNumber(ohmInLiquidity),
    ohmPrice: formatCurrency(ohmPrice),
    illiquidAssets: formatCurrency(illiquidAssetsValue),
    diff: formatCurrency(marketValueCalculated - marketValue),
    result: valuesEqual(marketValueCalculated, marketValue, 1),
  };
};

export const compareTokenRecords = (
  filenameBase: string,
  filenameBranch: string,
  comparisonFile: ComparisonResults,
): void => {
  console.info(
    `Comparing token records for base file ${filenameBase} and branch file ${filenameBranch}`,
  );

  // Read TokenRecord files, parse into JSON
  const baseRecords = getTokenRecordsFromFile(filenameBase);
  const branchRecords = getTokenRecordsFromFile(filenameBranch);

  compareMarketValueRecords(baseRecords, branchRecords, comparisonFile);
  compareLiquidBackingRecords(baseRecords, branchRecords, comparisonFile);

  // Get TokenSupply and OHM price
  const subgraphId = comparisonFile.branches.branch.subgraphId;
  const block = comparisonFile.latestBlock;
  getTokenSupplies(subgraphId, block).then((branchTokenSupplies) => {
    getOhmPrice(subgraphId, block).then((ohmPrice) => {
      doLiquidBackingCheck(branchRecords, branchTokenSupplies, ohmPrice, comparisonFile);
      doMarketValueCheck(branchRecords, comparisonFile);

      writeComparisonFile(comparisonFile);
    });
  });
};
