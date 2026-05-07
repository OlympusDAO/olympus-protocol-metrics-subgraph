import type { ChainConfig } from "../types";
import { ARBITRUM } from "./arbitrum";
import { BERACHAIN } from "./berachain";

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  42161: ARBITRUM,
  80094: BERACHAIN,
};
