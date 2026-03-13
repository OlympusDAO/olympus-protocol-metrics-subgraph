import type { ChainConfig } from "../types";
import { arbitrumConfig } from "./arbitrum";
import { baseConfig } from "./base";
import { berachainConfig } from "./berachain";
import { polygonConfig } from "./polygon";
import { fantomConfig } from "./fantom";

const chainConfigs = new Map<number, ChainConfig>([
  [42161, arbitrumConfig],
  [8453, baseConfig],
  [80094, berachainConfig],
  [137, polygonConfig],
  [250, fantomConfig],
]);

export function getChainConfig(chainId: number): ChainConfig {
  const config = chainConfigs.get(chainId);
  if (!config) {
    throw new Error(`No chain config found for chainId ${chainId}`);
  }
  return config;
}

export { arbitrumConfig, baseConfig, berachainConfig, polygonConfig, fantomConfig };
