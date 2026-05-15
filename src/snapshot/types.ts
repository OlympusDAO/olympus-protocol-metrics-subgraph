export type SerializedTokenRecord = {
  id: string;
  chainId: number;
  blockchain: string;
  block: string;
  timestamp: string;
  date: string;
  token: string;
  tokenAddress: string;
  source: string;
  sourceAddress: string;
  rate: string;
  balance: string;
  multiplier: string;
  value: string;
  valueExcludingOhm: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
};

export type SerializedTokenSupply = {
  id: string;
  chainId: number;
  blockchain: string;
  block: string;
  timestamp: string;
  date: string;
  token: string;
  tokenAddress: string;
  pool?: string;
  poolAddress?: string;
  source?: string;
  sourceAddress?: string;
  type: string;
  balance: string;
  supplyBalance: string;
};

export type Snapshot = {
  tokenRecords: SerializedTokenRecord[];
  tokenSupplies: SerializedTokenSupply[];
};

export type TrackedTokenBalanceInput = {
  tokenAddress: string;
  walletAddress: string;
  balance: string;
};

export type TokenDefinition = {
  address: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
  decimals: number;
  multiplier?: string;
  isLiability?: boolean;
  startBlock?: number;
};

export type BasePriceFeed = {
  address: string;
  startBlock?: number;
};

declare const bytes32Brand: unique symbol;
export type Bytes32 = `0x${string}` & { readonly [bytes32Brand]: true };

export type ChainId = 42161 | 80094 | 8453 | 137 | 250;

// Per-chain feature flags. `emitsTokenSupply` controls whether the snapshot
// path writes TokenSupply rows. Polygon and Fantom legacy subgraphs declare
// the entity but never emit any rows (Phase 1 decision #1 — match legacy);
// other chains emit. Default = true when the field is omitted.

export type ChainConfig = {
  chainId: ChainId;
  blockchain: string;
  startBlock: number;
  rpcUrls: string[];
  emitsTokenSupply?: boolean;
  tokens: TokenDefinition[];
  names: Record<string, string>;
  abbreviations: Record<string, string>;
  protocolAddresses: string[];
  circulatingSupplyWallets: string[];
  treasuryBlacklist: Record<string, string[]>;
  basePriceFeeds: Record<string, BasePriceFeed>;
  ohmToken: string;
  ohmStartBlock?: number;
  nativeToken?: string;
  liquidityHandlers: LiquidityHandler[];
  ownedLiquidityHandlers: LiquidityHandler[];
};

export type LiquidityHandler =
  | { kind: "stable"; id: string; tokens: string[]; startBlock?: number }
  | { kind: "remap"; id: string; tokens: string[]; target: string; startBlock?: number }
  | {
      kind: "chainlink";
      id: string; // feed (aggregator) address — also used as ChainlinkPriceState lookup key
      tokens: string[]; // exactly one token: the asset this feed prices
      decimals: number; // feed decimals (8 for USD pairs, 18 for ETH pairs)
      startBlock?: number;
    }
  | { kind: "univ2"; id: string; tokens: string[]; startBlock?: number }
  | { kind: "univ3"; id: string; tokens: string[]; startBlock?: number }
  | { kind: "univ3-quoter"; id: string; quoter: string; tokens: string[]; startBlock?: number }
  | { kind: "balancer"; id: Bytes32; vault: string; tokens: string[]; startBlock?: number }
  | {
      kind: "kodiak";
      id: string;
      pool: string;
      quoter: string;
      rewardVault?: string;
      tokens: string[];
      startBlock?: number;
    };
