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
      output: string; // Markdown
    };
    liquidBacking?: {
      base: string;
      branch: string;
      diff: string;
      result: boolean;
      output: string; // Markdown
    };
    marketValueCheck?: {
      marketValueTotal: string;
      marketValueStable: string;
      marketValueVolatile: string;
      marketValuePOL: string;
      marketValueCalculated: string;
      diff: string;
      result: boolean;
      output: string; // Markdown
    };
    /**
     * Output for the entire comparison step, in Markdown format.
     *
     * This will be included in a GitHub comment.
     */
    output?: string;
  };
};

export const readComparisonFile = (filePath: string): ComparisonResults => {
  console.info(`Reading comparison file from ${filePath}`);

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
