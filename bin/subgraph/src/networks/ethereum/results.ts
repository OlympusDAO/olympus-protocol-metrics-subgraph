import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { TokenRecord } from "../../subgraph";

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
  records: {
    tokenRecords: {
      base?: TokenRecord[];
      branch?: TokenRecord[];
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

export const readComparisonFile = (filePath: string): ComparisonResults => {
  // Silently create the data structure if the file doesn't exist
  if (!existsSync(filePath)) {
    return {
      branches: {},
      records: {
        tokenRecords: {},
      },
      results: {},
    };
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
};

export const writeComparisonFile = (results: ComparisonResults, filePath: string): void => {
  // Create the parent folders, if needed
  mkdirSync(dirname(filePath), { recursive: true });

  // Write the file
  writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.info(`Wrote comparison results to ${filePath}`);
};
