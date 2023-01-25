#!/usr/bin/env node

import { exec } from "child_process";
import { InvalidArgumentError, program } from "commander";
import * as dotenv from "dotenv";
import { existsSync } from "fs";

import { getDirectories } from "./helpers/fs";
import { spawnProcess } from "./helpers/process";
import { assertConfig, readConfig } from "./helpers/subgraphConfig";
import { NetworkHandler } from "./networkHandler";

// Load variables from .env
dotenv.config();

const parseDeploymentId = (value: string, _previous: string): string => {
  if (!value.includes("Qm")) {
    throw new InvalidArgumentError(`${value} is not a valid deployment id`);
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

const SUBGRAPH_DIR = "subgraphs";

/**
 * Gets a list of directory names (excluding paths)
 * corresponding to subgraphs.
 */
const getSubgraphs = (includePath = false): string[] => {
  return getDirectories(SUBGRAPH_DIR, includePath);
}

const parseSubgraph = (value: string, _previous: string): string => {
  const subgraphs = getSubgraphs();

  if (!subgraphs.includes(value)) {
    throw new InvalidArgumentError(
      `The <subgraph> argument must be one of ${subgraphs.join(", ")}, but was ${value}`,
    );
  }

  return value;
};

/**
 * Returns the file path for the module corresponding to {subgraph}.
 *
 * Note, this string is in the format expected by `import()`, relative to this file.
 *
 * @param subgraph
 * @returns
 */
const getImportFilePath = (subgraph: string): string => {
  return `./${SUBGRAPH_DIR}/${subgraph}/index.ts`;
};

/**
 * Returns the file path for the subgraph's output file, relative to the root directory.
 *
 * @param subgraph
 * @returns
 */
const getResultsFilePath = (subgraph: string): string => {
  return `build/results-${subgraph}.json`;
};

/**
 * Returns the file path for the subgraph's build directory, relative to the root directory.
 *
 * @param subgraph
 * @returns
 */
const getBuildOutputDirectory = (subgraph: string): string => {
  return `${SUBGRAPH_DIR}/${subgraph}/build`;
};

/**
 * Returns the file path for the subgraph's manifest, relative to the root directory.
 *
 * @param subgraph
 * @returns
 */
const getSubgraphManifestFilePath = (subgraph: string): string => {
  return `${SUBGRAPH_DIR}/${subgraph}/subgraph.yaml`;
};

/**
 * Returns the file path for the subgraph's configuration file, relative to the root directory.
 *
 * @param subgraph
 * @returns
 */
const getSubgraphConfigurationFilePath = (subgraph: string): string => {
  return `${SUBGRAPH_DIR}/${subgraph}/config.json`;
};

/**
 * For the given {subgraph} value, import and instantiate the corresponding class
 * that implements the `NetworkHandler` interface.
 *
 * @param subgraph
 * @param deploymentId
 * @param branch
 * @returns
 */
const getSubgraphHandler = async (
  subgraph: string,
  deploymentId?: string,
  branch?: string,
): Promise<NetworkHandler> => {
  let subgraphFilePath = getImportFilePath(subgraph);
  // Import is ok with the output of `getImportFilePath()` but `existsSync()` needs the full path
  if (!existsSync("bin/subgraph/src/" + subgraphFilePath)) {
    console.info(
      `Subgraph-specific files do not exist at ${subgraphFilePath}. Using shared test files.`,
    );
    subgraphFilePath = `./${SUBGRAPH_DIR}/shared/index.ts`;
  }

  const module = await import(subgraphFilePath);
  return new module.default(
    subgraph,
    getResultsFilePath(subgraph),
    deploymentId,
    branch,
  ) as NetworkHandler;
};

const subgraphNames = getSubgraphs();

program
  .name("yarn subgraph")
  .description("CLI for the deployment and testing of Olympus subgraphs");

program
  .command("latest-block")
  .description("Determines the latest block for a subgraph")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .requiredOption("--deployment <deployment id>", "the deployment id (starts with 'Qm')", parseDeploymentId)
  .action(async (subgraph, options) => {
    const query = await getSubgraphHandler(subgraph, options.deployment, null);
    query.doLatestBlock();
  });

program
  .command("query")
  .description("Performs a test subgraph query")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .requiredOption("--deployment <deployment id>", "the deployment id (starts with 'Qm')", parseDeploymentId)
  .requiredOption("--branch <base | branch>", "the branch", parseBranch)
  .action(async (subgraph, options) => {
    const query = await getSubgraphHandler(subgraph, options.deployment, options.branch);
    query.doQuery();
  });

program
  .command("compare")
  .description("Compares records")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .action(async (subgraph) => {
    const query = await getSubgraphHandler(subgraph, null, null);
    query.doComparison();
  });

program
  .command("codegen")
  .description("Generate code for subgraph")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .action((subgraph) => {
    const generatedDir = `${SUBGRAPH_DIR}/${subgraph}/generated/`;
    console.info("*** Running codegen");
    spawnProcess(
      `yarn graph codegen ${getSubgraphManifestFilePath(subgraph)} --output-dir ${generatedDir}`,
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
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .action((subgraph) => {
    const childProcess = exec(
      `yarn graph build ${getSubgraphManifestFilePath(
        subgraph,
      )} --output-dir ${getBuildOutputDirectory(subgraph)}`,
    );
    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
  });

program
  .command("test")
  .description("Test subgraph")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .option("--recompile", "Recompiles all tests")
  .action((subgraph, options) => {
    console.info("*** Running mustache to generate matchstick.yaml");
    spawnProcess(
      `echo '${JSON.stringify({
        subgraph: subgraph,
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
  .command("deploy:hosted")
  .description("Deploy subgraph to the Hosted Service")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .action((subgraph: string) => {
    const config = readConfig(getSubgraphConfigurationFilePath(subgraph));
    assertConfig(config);

    const subgraphSafe = subgraph.replace("-", "_");

    console.info("*** Deploying to Hosted Service");
    spawnProcess(
      `yarn graph deploy --deploy-key ${process.env[`GRAPH_TOKEN_${subgraphSafe}`]
      } --product hosted-service --node https://api.thegraph.com/deploy/ --ipfs https://api.thegraph.com/ipfs/ --output-dir ${getBuildOutputDirectory(
        subgraph,
      )} ${config.org}/${config.name} ${getSubgraphManifestFilePath(subgraph)}`,
      (codegenExitCode: number) => {
        if (codegenExitCode > 0) {
          process.exit(codegenExitCode);
        }
      },
    );
  });

program
  .command("deploy:studio")
  .description("Deploy subgraph to Subgraph Studio")
  .argument("<subgraph>", `the subgraph to use, one of: ${subgraphNames.join(", ")}`, parseSubgraph)
  .action((subgraph) => {
    const config = readConfig(getSubgraphConfigurationFilePath(subgraph));
    assertConfig(config);

    console.info("*** Deploying to Subgraph Studio");
    spawnProcess(
      `yarn graph deploy --product subgraph-studio --version-label ${config.version
      } --output-dir ${getBuildOutputDirectory(subgraph)} ${config.name
      } ${getSubgraphManifestFilePath(subgraph)}`,
      (codegenExitCode: number) => {
        if (codegenExitCode > 0) {
          process.exit(codegenExitCode);
        }
      },
    );
  });

program.parse();
