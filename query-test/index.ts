#!/usr/bin/env node

import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core";
import { fetch } from "cross-fetch";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { program, Option, InvalidArgumentError } from "commander";

const COMMANDS = ["latest-block", "test", "compare"];
const COMPARISON_FILE = "comparison.json";

type ComparisonResults = {
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
      base: number;
      branch: number;
      result: boolean;
    };
    liquidBacking?: {
      base: number;
      branch: number;
      result: boolean;
    };
  }
};

const readComparisonFile = (): ComparisonResults => {
  // Silently create the data structure if the file doesn't exist
  if (!existsSync(COMPARISON_FILE)) {
    return {
      branches: {},
      results: {},
    };
  }

  return JSON.parse(readFileSync(COMPARISON_FILE, "utf8"));
}

const writeComparisonFile = (comparisonFile: ComparisonResults): void => {
  writeFileSync(COMPARISON_FILE, JSON.stringify(comparisonFile, null, 2));
  console.info(`Wrote comparison results to ${COMPARISON_FILE}`);
}

const performQuery = async (subgraphId: string, query: string): Promise<any> => {
  const SUBGRAPH_BASE = "https://api.thegraph.com/subgraphs/id/";
  const SUBGRAPH_URL = `${SUBGRAPH_BASE}${subgraphId}`;
  console.info(`Working with subgraph id ${subgraphId} and URL ${SUBGRAPH_URL}`);
  const gqlClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: `${SUBGRAPH_URL}`, fetch }),
  });

  return await gqlClient.query({ query: gql(query) });
};

const getLatestBlock = async (subgraphId: string): Promise<string> => {
  const query = `
  {
    tokenRecords(first: 1 orderBy: block orderDirection: desc) {
      block
    }
  }
`;

  console.info(`Fetching latest block for subgraph id ${subgraphId}`);
  const results = await performQuery(subgraphId, query);
  return results.data.tokenRecords[0].block;
};

/**
 * Fetches the latest block for the given subgraphId, and writes it to ${COMPARISON_FILE}.
 * 
 * @param subgraphId 
 * @param comparisonFile 
 */
const writeLatestBlock = (subgraphId: string, comparisonFile: ComparisonResults): void => {
  getLatestBlock(subgraphId).then((latestBlock) => {
    comparisonFile.latestBlock = latestBlock;
    writeComparisonFile(comparisonFile);
    console.info(`Latest block written to ${COMPARISON_FILE}`);
  });
};

type TokenRecord = {
  id: string;
  block: string;
  date: string;
  token: string;
  source: string;
  rate: string;
  balance: string;
  multiplier: string;
  value: string;
  valueExcludingOhm: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
};

/**
 * Fetches an array of TokenRecord objects from the GraphQL server.
 * 
 * @param subgraphId 
 * @param block 
 * @returns 
 */
const getTokenRecords = async (subgraphId: string, block: string): Promise<TokenRecord[]> => {
  const query = `
  {
    tokenRecords(where: {block: ${block}}) {
      id
      block
      date
      token
      source
      rate
      balance
      multiplier
      value
      valueExcludingOhm
      category
      isLiquid
      isBluechip
    }
  }`;

  console.info(`Fetching token records for subgraph id ${subgraphId} and block ${block}`);
  const results = await performQuery(subgraphId, query);
  return results.data.tokenRecords;
};

const writeTokenRecords = (subgraphId: string, testMode: string, block: string, comparisonFile: ComparisonResults): void => {
  const FILENAME = `records-${testMode}.json`;
  getTokenRecords(subgraphId, block).then((tokenRecords) => {
    // Write to a JSON file
    writeFileSync(FILENAME, JSON.stringify(tokenRecords, null, 2));
    console.info(`TokenRecord results written to ${FILENAME}`);

    // Update the comparison results and write
    comparisonFile.branches[testMode].subgraphId = subgraphId;
    writeComparisonFile(comparisonFile);
  });
};

const getTokenRecordsFromFile = (filename: string): TokenRecord[] => {
  return JSON.parse(readFileSync(filename, "utf8"));
};

const calculateMarketValue = (records: TokenRecord[]): number => {
  return records.reduce((previousValue, record) => {
    return previousValue + +record.value;
  }, 0);
};

const calculateLiquidBacking = (records: TokenRecord[]): number => {
  return records.filter((record) => record.isLiquid == true).reduce((previousValue, record) => {
    return previousValue + +record.valueExcludingOhm;
  }, 0);
};

const DIFF_THRESHOLD = 1000;

/**
 * Compares the market value from two branches, and adds the results to {comparisonFile}.
 * 
 * @param baseRecords 
 * @param branchRecords 
 * @param comparisonFile 
 */
const compareMarketValue = (baseRecords: TokenRecord[], branchRecords: TokenRecord[], comparisonFile: ComparisonResults): void => {
  // Perform sums
  console.info("Comparing market value");
  const baseMarketValue = calculateMarketValue(baseRecords);
  console.info("Base = " + baseMarketValue);
  const branchMarketValue = calculateMarketValue(branchRecords);
  console.info("Branch = " + branchMarketValue);

  // Output to file
  const marketValueResults = {
    base: baseMarketValue,
    branch: branchMarketValue,
    result:
      baseMarketValue - branchMarketValue < DIFF_THRESHOLD &&
      branchMarketValue - baseMarketValue < DIFF_THRESHOLD,
  };

  comparisonFile.results.marketValue = marketValueResults;
}

/**
 * Compares the liquid backing from two branches, and adds the results to {comparisonFile}.
 * 
 * @param baseRecords 
 * @param branchRecords 
 * @param comparisonFile 
 */
 const compareLiquidBacking = (baseRecords: TokenRecord[], branchRecords: TokenRecord[], comparisonFile: ComparisonResults): void => {
  // Perform sums
  console.info("Comparing liquid backing");
  const baseLiquidBacking = calculateLiquidBacking(baseRecords);
  console.info("Base = " + baseLiquidBacking);
  const branchLiquidBacking = calculateLiquidBacking(branchRecords);
  console.info("Branch = " + branchLiquidBacking);

  // Output to file
  const liquidBackingResults = {
    base: baseLiquidBacking,
    branch: branchLiquidBacking,
    result:
      baseLiquidBacking - branchLiquidBacking < DIFF_THRESHOLD &&
      branchLiquidBacking - baseLiquidBacking < DIFF_THRESHOLD,
  };

  comparisonFile.results.liquidBacking = liquidBackingResults;
}

const compareTokenRecords = (filenameBase: string, filenameBranch: string, comparisonFile: ComparisonResults): void => {
  console.info(`Comparing token records for base file ${filenameBase} and branch file ${filenameBranch}`);

  // Read files, parse into JSON
  const baseRecords = getTokenRecordsFromFile(filenameBase);
  const branchRecords = getTokenRecordsFromFile(filenameBranch);

  compareMarketValue(baseRecords, branchRecords, comparisonFile);
  compareLiquidBacking(baseRecords, branchRecords, comparisonFile);

  writeComparisonFile(comparisonFile);
};

const parseSubgraphId = (value: string, _previous: string): string => {
  if (!value.includes("Qm")) {
    throw new InvalidArgumentError(`${value} is not a valid subgraph id`);
  }

  return value;
}

const parseBranch = (value: string, _previous: string): string => {
  const BRANCHES = ["base", "branch"];
  if (!BRANCHES.includes(value)) {
    throw new InvalidArgumentError(`The --branch argument must be one of ${BRANCHES.join(", ")}, but was: ${value}`);
  }

  return value;
}

program.name("query-test")
  .description("CLI to test subgraph queries");

program.command("latest-block")
  .description("Determines the latest block for a subgraph")
  .requiredOption("--subgraph <subgraph id>", "the subgraph id", parseSubgraphId)
  .action((options) => {
    const comparisonFile = readComparisonFile();
    writeLatestBlock(options.subgraph, comparisonFile);
  });

program.command("test")
  .description("Performs a test subgraph query")
  .requiredOption("--subgraph <subgraph id>", "the subgraph id", parseSubgraphId)
  .requiredOption("--branch <base | branch>", "the branch", parseBranch)
  .requiredOption("--block <block number>", "the block number")
  .action((options) => {
    const comparisonFile = readComparisonFile();
    writeTokenRecords(options.subgraph, options.branch, options.block, comparisonFile);
  });

program.command("compare")
  .description("Compares two TokenRecord files")
  .requiredOption("--base <filename>", "the base records file")
  .requiredOption("--branch <filename>", "the branch records file")
  .action((options) => {
    const comparisonFile = readComparisonFile();
    compareTokenRecords(options.base, options.branch, comparisonFile);
  });

program.parse();
