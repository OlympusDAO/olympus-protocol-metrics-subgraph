#!/usr/bin/env node

import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core";
import { fetch } from "cross-fetch";
import { writeFileSync } from "fs";

const COMMANDS = ["latest-block", "test"];

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

  const results = await performQuery(subgraphId, query);
  return results.data.tokenRecords[0].block;
};

const writeLatestBlock = (subgraphId: string): void => {
  const FILENAME = "block.txt";
  getLatestBlock(subgraphId).then((latestBlock) => {
    writeFileSync(FILENAME, latestBlock);
    console.info(`Latest block written to ${FILENAME}`);
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

const writeTokenRecords = (subgraphId: string, block: string): void => {
  const FILENAME = "records.json";
  getTokenRecords(subgraphId, block).then((tokenRecords) => {
    writeFileSync(FILENAME, JSON.stringify(tokenRecords, null, 2));
    console.info(`TokenRecord results written to ${FILENAME}`);
  });
};

const getSubgraphId = (args: string[], index: number): string => {
  if (args.length < index + 1) {
    console.error(
      `Expected subgraph id to be present as argument ${
        index + 1 - 2
      }, but it was not there: ${args}`,
    );
    process.exit(1);
  }

  const subgraphId = args[index];
  if (!subgraphId.includes("Qm")) {
    console.error(`subgraph id should have the 'Qm' prefix, but was: ${subgraphId}`);
    process.exit(1);
  }

  return subgraphId;
};

const main = (cliArgs: string[]): void => {
  // ts-node,filename,command
  if (!cliArgs || cliArgs.length < 3) {
    console.error(`Please execute in the format "yarn ts-node index.ts <${COMMANDS.join(" | ")}>"`);
    process.exit(1);
  }

  const inputCommand = cliArgs[2];
  if (!COMMANDS.includes(inputCommand)) {
    console.error(`command should be one of ${COMMANDS.join(", ")}, but was ${inputCommand}`);
    process.exit(1);
  }

  switch (inputCommand) {
    case "latest-block": {
      const subgraphId = getSubgraphId(cliArgs, 3);
      writeLatestBlock(subgraphId);
      break;
    }
    case "test": {
      const subgraphId = getSubgraphId(cliArgs, 3);
      if (cliArgs.length < 5) {
        console.error(
          `The block to fetch should be specified in the format: yarn ts-node index.ts ${inputCommand} ${subgraphId} <block number>`,
        );
        process.exit(1);
      }

      const block = cliArgs[4];
      writeTokenRecords(subgraphId, block);
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
