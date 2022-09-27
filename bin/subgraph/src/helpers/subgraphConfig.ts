import { InvalidArgumentError } from "commander";
import { existsSync, readFileSync } from "fs";

export interface SubgraphConfig {
  id: string;
  version: string;
  org: string;
  name: string;
}

/**
 * Reads the per-network configuration file at {path}.
 *
 * @param path
 * @returns
 * @throws InvalidArgumentError if the file cannot be found
 */
export const readConfig = (path: string): SubgraphConfig => {
  if (!existsSync(path)) {
    throw new InvalidArgumentError(
      `The network configuration file ${path} does not exist. Please create it.`,
    );
  }

  return JSON.parse(readFileSync(path, "utf8")) as SubgraphConfig;
};

/**
 * Asserts that the required properties are present.
 *
 * @param config
 * @throws InvalidArgumentError if a required property is not found
 */
export const assertConfig = (config: SubgraphConfig): void => {
  // if (!config.id) {
  //   throw new InvalidArgumentError("id must be set to the subgraph id ('Qm...')");
  // }

  if (!config.version) {
    throw new InvalidArgumentError("version must be set");
  }

  if (!config.org) {
    throw new InvalidArgumentError("org must be set");
  }

  if (!config.name) {
    throw new InvalidArgumentError("name must be set");
  }
};
