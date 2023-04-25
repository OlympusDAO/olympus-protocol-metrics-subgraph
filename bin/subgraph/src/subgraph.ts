import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core";
import { fetch } from "cross-fetch";

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

/**
 * Determines a block that can be used for testing.
 *
 * Currently, this looks for the latest block that is available, and determines
 * the latest block for the previous day. The absolute latest block
 * is likely to become out of date, as indexing would continue, leading to query errors.
 *
 * @param subgraphId
 * @returns
 * @throws Error if there are no results from the GraphQL query
 */
export const getTestBlock = async (subgraphId: string): Promise<string> => {
  // We first fetch the latest block for the query
  const latestBlockQuery = `
    {
      tokenRecords(first: 1, orderBy: block, orderDirection: desc) {
        date
        block
      }
    }
    `;
  console.info(
    `Fetching latest block for subgraph id ${subgraphId} with query: ${latestBlockQuery}`,
  );
  const results = await performQuery(subgraphId, latestBlockQuery);
  if (!results.data) {
    throw new Error("getTestBlock: latest block query returned no results");
  }

  console.info(`Received latest block ${results.data.tokenRecords[0].block}`);
  const latestBlockDate = results.data.tokenRecords[0].date;

  // We then get the day before the latest block
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayBeforeDate = new Date(latestBlockDate);
  dayBeforeDate.setTime(dayBeforeDate.getTime() - DAY_MS);
  const dayBeforeDateString = dayBeforeDate.toISOString().split("T")[0];
  const dayBeforeQuery = `
    {
      tokenRecords(first: 1, orderBy: block, orderDirection: desc, where: {date: "${dayBeforeDateString}"}) {
        block
      }
    }
    `;
  console.info(
    `Fetching latest block on date ${dayBeforeDateString} for subgraph id ${subgraphId} with query: ${dayBeforeQuery}`,
  );
  const dayBeforeResults = await performQuery(subgraphId, dayBeforeQuery);
  if (!dayBeforeResults.data) {
    throw new Error("getTestBlock: day before latest block query returned no results");
  }

  const dayBeforeLatestBlock = dayBeforeResults.data.tokenRecords[0].block;
  console.info(`Received latest block ${dayBeforeLatestBlock}`);
  return dayBeforeLatestBlock;
};

export type TokenRecord = {
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
 * @throws Error if there are no results from the GraphQL query
 */
export const getTokenRecords = async (
  subgraphId: string,
  block: string,
): Promise<TokenRecord[]> => {
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

  console.info(
    `Fetching token records for subgraph id ${subgraphId} and block ${block} with query: ${query}`,
  );
  const results = await performQuery(subgraphId, query);
  if (!results.data) {
    throw new Error("getTokenRecords: tokenRecords query returned no results");
  }

  return results.data.tokenRecords;
};

export type TokenSupply = {
  id: string;
  block: string;
  date: string;
  token: string;
  source: string;
  balance: string;
  supplyBalance: string;
  type: string;
};

/**
 * Fetches an array of TokenSupply objects from the GraphQL server.
 *
 * @param subgraphId
 * @param block
 * @returns
 * @throws Error if there are no results from the GraphQL query
 */
export const getTokenSupplies = async (
  subgraphId: string,
  block: string,
): Promise<TokenSupply[]> => {
  const query = `
    {
      tokenSupplies(where: {block: ${block}}) {
        id
        block
        date
        token
        source
        balance
        supplyBalance
        type
      }
    }`;

  console.info(
    `Fetching token supplies for subgraph id ${subgraphId} and block ${block} with query: ${query}`,
  );
  const results = await performQuery(subgraphId, query);
  if (!results.data) {
    throw new Error("getTokenSupplies: tokenSupplies query returned no results");
  }

  return results.data.tokenSupplies;
};

/**
 * Fetches the OHM price from the GraphQL server.
 *
 * @param subgraphId
 * @param block
 * @returns
 * @throws Error if there are no results from the GraphQL query
 */
export const getOhmPrice = async (subgraphId: string, block: string): Promise<number> => {
  const query = `
    {
      protocolMetrics(first: 1, where: {block: ${block}}) {
        ohmPrice
      }
    }`;

  console.info(
    `Fetching OHM price for subgraph id ${subgraphId} and block ${block} with query: ${query}`,
  );
  const results = await performQuery(subgraphId, query);
  if (!results.data) {
    throw new Error("getOhmPrice: protocolMetrics query returned no results");
  }

  return parseFloat(results.data.protocolMetrics[0].ohmPrice);
};
