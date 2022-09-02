#!/usr/bin/env node

import { exec } from "child_process";
import { InvalidArgumentError, program } from "commander";

import { spawnProcess } from "./helpers/process";

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

const NETWORKS = ["ethereum", "arbitrum"];
const parseNetwork = (value: string, _previous: string): string => {
  if (!NETWORKS.includes(value)) {
    throw new InvalidArgumentError(
      `The <network> argument must be one of ${NETWORKS.join(", ")}, but was ${value}`,
    );
  }

  return value;
};

/**
 * Returns the file path for the module corresponding to {network}.
 *
 * Note, this string is in the format expected by `import()`, relative to this file.
 *
 * @param network
 * @returns
 */
const getImportFilePath = (network: string): string => {
  return `./networks/${network}/index`;
};

/**
 * Returns the file path for the output file, relative to the root directory.
 *
 * @param network
 * @returns
 */
const getResultsFilePath = (network: string): string => {
  return `build/${network}/results.json`;
};

program
  .name("yarn subgraph")
  .description("CLI for the deployment and testing of Olympus subgraphs");

program
  .command("latest-block")
  .description("Determines the latest block for a subgraph")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .action(async (network, options) => {
    const query = await import(getImportFilePath(network));
    query.doLatestBlock(network, options.subgraph, getResultsFilePath(network));
  });

program
  .command("query")
  .description("Performs a test subgraph query")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .requiredOption("--branch <base | branch>", "the branch", parseBranch)
  .action(async (network, options) => {
    const query = await import(getImportFilePath(network));
    query.doQuery(network, options.subgraph, options.branch, getResultsFilePath(network));
  });

program
  .command("compare")
  .description("Compares records")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action(async (network) => {
    const query = await import(getImportFilePath(network));
    query.doComparison(network, getResultsFilePath(network));
  });

program
  .command("build")
  .description("Build subgraph")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action((network) => {
    const childProcess = exec(
      `yarn graph build networks/${network}/subgraph.yaml --output-dir networks/${network}/build/`,
    );
    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
  });

program
  .command("test")
  .description("Test subgraph")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .option("--recompile", "Recompiles all tests")
  .action((network, options) => {
    console.info("*** Running mustache to generate matchstick.yaml");
    spawnProcess(
      `echo '${JSON.stringify({
        network: network,
      })}' | yarn -s mustache - matchstick.template.yaml > matchstick.yaml`,
      (mustacheExitCode: number) => {
        if (mustacheExitCode > 0) {
          process.exit(mustacheExitCode);
        }

        console.info("*** Running graph test");
        spawnProcess(
          `yarn graph test --version 0.5.3 ${options.recompile == true ? "--recompile" : ""}`,
          (testExitCode: number) => {
            if (testExitCode > 0) {
              process.exit(testExitCode);
            }
          },
        );
      },
    );
  });

program.parse();
