#!/usr/bin/env node

import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core";
import { fetch } from "cross-fetch";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { program, InvalidArgumentError } from "commander";

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
    }
  }
};

const formatCurrency = (value: number, decimals = 0): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });
}

const formatNumber = (value: number, decimals = 0): string => {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

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

type TokenSupply = {
  id: string;
  block: string;
  date: string;
  token: string;
  source: string;
  balance: string;
  type: string;
}

/**
 * Fetches an array of TokenSupply objects from the GraphQL server.
 * 
 * @param subgraphId 
 * @param block 
 * @returns 
 */
 const getTokenSupplies = async (subgraphId: string, block: string): Promise<TokenSupply[]> => {
  const query = `
  {
    tokenSupplies(where: {block: ${block}}) {
      id
      block
      date
      token
      source
      balance
      type
    }
  }`;

  console.info(`Fetching token supplies for subgraph id ${subgraphId} and block ${block}`);
  const results = await performQuery(subgraphId, query);
  return results.data.tokenSupplies;
 };

/**
 * Fetches the OHM price from the GraphQL server.
 * 
 * @param subgraphId 
 * @param block 
 * @returns 
 */
 const getOhmPrice = async (subgraphId: string, block: string): Promise<number> => {
  const query = `
  {
    protocolMetrics(first: 1, where: {block: ${block}}) {
      ohmPrice
    }
  }`;

  console.info(`Fetching OHM price for subgraph id ${subgraphId} and block ${block}`);
  const results = await performQuery(subgraphId, query);
  return parseFloat(results.data.protocolMetrics[0].ohmPrice);
 };

const writeTokenRecords = (subgraphId: string, branch: string, block: string, comparisonFile: ComparisonResults): void => {
  const FILENAME = `records-${branch}.json`;
  getTokenRecords(subgraphId, block).then((tokenRecords) => {
    // Write to a JSON file
    writeFileSync(FILENAME, JSON.stringify(tokenRecords, null, 2));
    console.info(`TokenRecord results written to ${FILENAME}`);

    // Update the comparison results and write
    comparisonFile.branches[branch] = {
      subgraphId: subgraphId,
    };
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

const calculateMarketValueCategory = (records: TokenRecord[], category: string): number => {
  return records.filter((record) => record.category == category).reduce((previousValue, record) => {
    return previousValue + +record.value;
  }, 0);
};

const calculateLiquidBacking = (records: TokenRecord[]): number => {
  return records.filter((record) => record.isLiquid == true).reduce((previousValue, record) => {
    return previousValue + +record.valueExcludingOhm;
  }, 0);
};

const DIFF_THRESHOLD = 1000;

const valuesEqual = (value1: number, value2: number, threshold = DIFF_THRESHOLD): boolean => {
  return value1 - value2 < threshold && value2 - value1 < threshold;
}

/**
 * Compares the market value from two branches, and adds the results to {comparisonFile}.
 * 
 * Market value is calculated as: sum of the value (`value` property) of all TokenRecord objects for a given block.
 * 
 * @param baseRecords 
 * @param branchRecords 
 * @param comparisonFile 
 */
const compareMarketValueRecords = (baseRecords: TokenRecord[], branchRecords: TokenRecord[], comparisonFile: ComparisonResults): void => {
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
}

/**
 * Compares the liquid backing from two branches, and adds the results to {comparisonFile}.
 * 
 * Liquid backing is calculated as: sum of the value excluding OHM (`valueExcludingOhm` property) of all liquid TokenRecord objects (`isLiquid` = true) for a given block.
 * 
 * @param baseRecords 
 * @param branchRecords 
 * @param comparisonFile 
 */
 const compareLiquidBackingRecords = (baseRecords: TokenRecord[], branchRecords: TokenRecord[], comparisonFile: ComparisonResults): void => {
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
 }

 /**
  * Checks the market value, using the following formula:
  * 
  * Market value = market value (stable) + market value (volatile) + market value (POL)
  * 
  * @param tokenRecords 
  * @param comparisonFile 
  */
  const doMarketValueCheck = (tokenRecords: TokenRecord[], comparisonFile: ComparisonResults): void => {
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
  }

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
const doLiquidBackingCheck = (tokenRecords: TokenRecord[], supplyRecords: TokenSupply[], ohmPrice: number, comparisonFile: ComparisonResults): void => {
  console.info("Doing sanity check of market value and liquid backing");
  const marketValue = calculateMarketValue(tokenRecords);
  const liquidBacking = calculateLiquidBacking(tokenRecords);
  const ohmInLiquidity = supplyRecords.filter((tokenSupply) => tokenSupply.type == "Liquidity").reduce((previousValue, tokenSupply) => previousValue + +tokenSupply.balance, 0);
  const illiquidAssetsValue = tokenRecords.filter((tokenRecord) => tokenRecord.isLiquid == false).reduce((previousValue, tokenRecord) => previousValue + +tokenRecord.value, 0);
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
}

const compareTokenRecords = (filenameBase: string, filenameBranch: string, comparisonFile: ComparisonResults): void => {
  console.info(`Comparing token records for base file ${filenameBase} and branch file ${filenameBranch}`);

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
    })
  })
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
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .action((options) => {
    const comparisonFile = readComparisonFile();
    writeLatestBlock(options.subgraph, comparisonFile);
  });

program.command("test")
  .description("Performs a test subgraph query")
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
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
