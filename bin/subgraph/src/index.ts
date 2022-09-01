#!/usr/bin/env node

import { InvalidArgumentError, program } from "commander";

import { writeLatestBlock } from "./block";
import { compareTokenRecords } from "./compare";
import { readComparisonFile } from "./helpers/results";
import { writeTokenRecords } from "./query";

const parseSubgraphId = (value: string, _previous: string): string => {
  if (!value.includes("Qm")) {
    throw new InvalidArgumentError(`${value} is not a valid subgraph id`);
  }

  return value;
};

const parseBranch = (value: string, _previous: string): string => {
  const BRANCHES = ["base", "branch"];
  if (!BRANCHES.includes(value)) {
    throw new InvalidArgumentError(
      `The --branch argument must be one of ${BRANCHES.join(", ")}, but was: ${value}`,
    );
  }

  return value;
};

program
  .name("yarn subgraph")
  .description("CLI for the deployment and testing of Olympus subgraphs");

program
  .command("latest-block")
  .description("Determines the latest block for a subgraph")
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .action((options) => {
    const comparisonFile = readComparisonFile();
    writeLatestBlock(options.subgraph, comparisonFile);
  });

program
  .command("test")
  .description("Performs a test subgraph query")
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .requiredOption("--branch <base | branch>", "the branch", parseBranch)
  .requiredOption("--block <block number>", "the block number")
  .action((options) => {
    const comparisonFile = readComparisonFile();
    writeTokenRecords(options.subgraph, options.branch, options.block, comparisonFile);
  });

program
  .command("compare")
  .description("Compares two TokenRecord files")
  .requiredOption("--base <filename>", "the base records file")
  .requiredOption("--branch <filename>", "the branch records file")
  .action((options) => {
    const comparisonFile = readComparisonFile();
    compareTokenRecords(options.base, options.branch, comparisonFile);
  });

program.parse();
