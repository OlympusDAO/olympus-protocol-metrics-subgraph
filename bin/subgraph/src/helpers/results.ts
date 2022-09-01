import { existsSync, readFileSync, writeFileSync } from "fs";

export type ComparisonResults = {
  latestBlock?: string;
  branches: {
    base?: {
      subgraphId: string;
    };
    branch?: {
      subgraphId: string;
    };
  };
  results: {
    marketValue?: {
      base: string;
      branch: string;
      diff: string;
      result: boolean;
    };
    liquidBacking?: {
      base: string;
      branch: string;
      diff: string;
      result: boolean;
    };
    liquidBackingCheck?: {
      marketValue: string;
      liquidBacking: string;
      ohmInLiquidity: string;
      ohmPrice: string;
      illiquidAssets: string;
      diff: string;
      result: boolean;
    };
    marketValueCheck?: {
      marketValueTotal: string;
      marketValueStable: string;
      marketValueVolatile: string;
      marketValuePOL: string;
      marketValueCalculated: string;
      diff: string;
      result: boolean;
    };
  };
};

const COMPARISON_FILE = "comparison.json";

export const readComparisonFile = (): ComparisonResults => {
  // Silently create the data structure if the file doesn't exist
  if (!existsSync(COMPARISON_FILE)) {
    return {
      branches: {},
      results: {},
    };
  }

  return JSON.parse(readFileSync(COMPARISON_FILE, "utf8"));
};

export const writeComparisonFile = (comparisonFile: ComparisonResults): void => {
  writeFileSync(COMPARISON_FILE, JSON.stringify(comparisonFile, null, 2));
  console.info(`Wrote comparison results to ${COMPARISON_FILE}`);
};
