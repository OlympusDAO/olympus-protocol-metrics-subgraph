#!/usr/bin/env node

import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core";
import { fetch } from "cross-fetch";

const COMMANDS = ["latest-block", "test"];

const performQuery = async (subgraphId: string, query: string): Promise<any> => {
  const SUBGRAPH_BASE = "https://api.thegraph.com/subgraphs/id/";
  const SUBGRAPH_URL = `${SUBGRAPH_BASE}${subgraphId}`;
  console.log(`Working with subgraph id ${subgraphId} and URL ${SUBGRAPH_URL}`);
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

  const results = await performQuery(subgraphId, query);
  console.log("results = " + JSON.stringify(results, null, 2));
  return results.data.tokenRecords[0].block;
};

type TokenRecord = {
  id: string;
  block: number;
  date: string;
  token: string;
  source: string;
  rate: number;
  balance: number;
  multiplier: number;
  value: number;
  valueExcludingOhm: number;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
};

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

  const results = await performQuery(subgraphId, query);
  return results.data.tokenRecords;
};

const main = async (cliArgs: string[]) => {
  // ts-node,filename,subgraph id,command
  if (!cliArgs || cliArgs.length < 3) {
    console.error(`Please execute in the format "yarn ts-node index.ts <${COMMANDS.join(" | ")}>"`);
    process.exit(1);
  }

  const inputCommand = cliArgs[2];
  if (!COMMANDS.includes(inputCommand)) {
    console.error(`command should be one of ${COMMANDS.join(", ")}, but was ${inputCommand}`);
    process.exit(1);
  }

  const subgraphId = cliArgs[3];
  if (!subgraphId.includes("Qm")) {
    console.error(`subgraph id should have the 'Qm' prefix, but was: ${subgraphId}`);
    process.exit(1);
  }

  switch (inputCommand) {
    case "latest-block": {
      const latestBlock = await getLatestBlock(subgraphId);
      console.log("latest block = " + latestBlock);
      break;
    }
    case "test": {
      if (cliArgs.length < 5) {
        console.error(
          `The block to fetch should be specified in the format: yarn ts-node index.ts ${inputCommand} ${subgraphId} <block number>`,
        );
        process.exit(1);
      }

      const block = cliArgs[4];
      const tokenRecords = await getTokenRecords(subgraphId, block);
      console.log("records = " + JSON.stringify(tokenRecords, null, 2));
      break;
    }
    default: {
      console.error("Unknown command");
      process.exit(1);
    }
  }

  return;
};

main(process.argv);
