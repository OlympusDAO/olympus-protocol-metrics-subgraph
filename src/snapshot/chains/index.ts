import type { ChainConfig } from "../types";
import { ARBITRUM } from "./arbitrum";
import { BASE } from "./base";
import { BERACHAIN } from "./berachain";
import { POLYGON } from "./polygon";

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  42161: ARBITRUM,
  80094: BERACHAIN,
  8453: BASE,
  137: POLYGON,
};
