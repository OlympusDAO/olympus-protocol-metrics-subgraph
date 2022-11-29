#!/usr/bin/env node

import { exec } from "child_process";
import { InvalidArgumentError, program } from "commander";
import * as dotenv from "dotenv";
import { existsSync } from "fs";

import { spawnProcess } from "./helpers/process";
import { assertConfig, readConfig } from "./helpers/subgraphConfig";
import { NetworkHandler } from "./networkHandler";

// Load variables from .env
dotenv.config();

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

const NETWORKS = ["ethereum", "arbitrum", "polygon", "fantom", "shared"];
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
  return `./networks/${network}/index.ts`;
};

/**
 * Returns the file path for the network's output file, relative to the root directory.
 *
 * @param network
 * @returns
 */
const getResultsFilePath = (network: string): string => {
  return `build/results-${network}.json`;
};

/**
 * Returns the file path for the network's build directory, relative to the root directory.
 *
 * @param network
 * @returns
 */
const getBuildOutputDirectory = (network: string): string => {
  return `networks/${network}/build`;
};

/**
 * Returns the file path for the network's subgraph manifest, relative to the root directory.
 *
 * @param network
 * @returns
 */
const getSubgraphManifestFilePath = (network: string): string => {
  return `networks/${network}/subgraph.yaml`;
};

/**
 * Returns the file path for the network's configuration file, relative to the root directory.
 *
 * @param network
 * @returns
 */
const getSubgraphConfigurationFilePath = (network: string): string => {
  return `networks/${network}/config.json`;
};

/**
 * For the given {network} value, import and instantiate the corresponding class
 * that implements the `NetworkHandler` interface.
 *
 * @param network
 * @param subgraphId
 * @param branch
 * @returns
 */
const getNetworkHandler = async (
  network: string,
  subgraphId?: string,
  branch?: string,
): Promise<NetworkHandler> => {
  let networkFilePath = getImportFilePath(network);
  // Import is ok with the output of `getImportFilePath()` but `existsSync()` needs the full path
  if (!existsSync("bin/subgraph/src/" + networkFilePath)) {
    console.info(
      `Blockchain-specific files do not exist at ${networkFilePath}. Using shared test files.`,
    );
    networkFilePath = `./networks/shared/index.ts`;
  }

  const module = await import(networkFilePath);
  return new module.default(
    network,
    getResultsFilePath(network),
    subgraphId,
    branch,
  ) as NetworkHandler;
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
    const query = await getNetworkHandler(network, options.subgraph, null);
    query.doLatestBlock();
  });

program
  .command("query")
  .description("Performs a test subgraph query")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .requiredOption("--subgraph <subgraph id>", "the subgraph id (starts with 'Qm')", parseSubgraphId)
  .requiredOption("--branch <base | branch>", "the branch", parseBranch)
  .action(async (network, options) => {
    const query = await getNetworkHandler(network, options.subgraph, options.branch);
    query.doQuery();
  });

program
  .command("compare")
  .description("Compares records")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action(async (network) => {
    const query = await getNetworkHandler(network, null, null);
    query.doComparison();
  });

program
  .command("codegen")
  .description("Generate code for subgraph")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action((network) => {
    const generatedDir = `networks/${network}/generated/`;
    console.info("*** Running codegen");
    spawnProcess(
      `yarn graph codegen ${getSubgraphManifestFilePath(network)} --output-dir ${generatedDir}`,
      (codegenExitCode: number) => {
        if (codegenExitCode > 0) {
          process.exit(codegenExitCode);
        }

        console.info("*** Running lint");
        spawnProcess(
          `yarn eslint --config ./.eslintrc.json --fix ${generatedDir}`,
          (lintExitCode: number) => {
            if (lintExitCode > 0) {
              process.exit(lintExitCode);
            }
          },
        );
      },
    );
  });

program
  .command("build")
  .description("Build subgraph")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action((network) => {
    const childProcess = exec(
      `yarn graph build ${getSubgraphManifestFilePath(
        network,
      )} --output-dir ${getBuildOutputDirectory(network)}`,
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

program
  .command("deploy")
  .description("Deploy subgraph to production")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action((network) => {
    const config = readConfig(getSubgraphConfigurationFilePath(network));
    assertConfig(config);

    console.info("*** Running deploy");
    spawnProcess(
      `yarn graph deploy --deploy-key ${process.env[`GRAPH_TOKEN_${network}`]
      } --product hosted-service --node https://api.thegraph.com/deploy/ --ipfs https://api.thegraph.com/ipfs/ --output-dir ${getBuildOutputDirectory(
        network,
      )} ${config.org}/${config.name} ${getSubgraphManifestFilePath(network)}`,
      (codegenExitCode: number) => {
        if (codegenExitCode > 0) {
          process.exit(codegenExitCode);
        }
      },
    );
  });

program
  .command("deploy:dev")
  .description("Deploy subgraph to development")
  .argument("<network>", `the chain/network to use, one of: ${NETWORKS.join(", ")}`, parseNetwork)
  .action((network) => {
    const config = readConfig(getSubgraphConfigurationFilePath(network));
    assertConfig(config);

    console.info("*** Running deploy");
    spawnProcess(
      `yarn graph deploy --product subgraph-studio --version-label ${config.version
      } --output-dir ${getBuildOutputDirectory(network)} ${config.name
      } ${getSubgraphManifestFilePath(network)}`,
      (codegenExitCode: number) => {
        if (codegenExitCode > 0) {
          process.exit(codegenExitCode);
        }
      },
    );
  });

program.parse();
