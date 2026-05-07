export type SerializedTokenRecord = {
  id: string;
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
  blockchain: string;
};

export type SerializedTokenSupply = {
  id: string;
  block: string;
  timestamp: string;
  date: string;
  token: string;
  tokenAddress: string;
  pool?: string;
  poolAddress?: string;
  source?: string;
  sourceAddress?: string;
  recordType: string;
  balance: string;
  supplyBalance: string;
};

export type Snapshot = {
  tokenRecords: SerializedTokenRecord[];
  tokenSupplies: SerializedTokenSupply[];
};

export type TokenDefinition = {
  address: string;
  category: string;
  isLiquid: boolean;
  isBluechip: boolean;
  multiplier?: string;
  isLiability?: boolean;
};

declare const bytes32Brand: unique symbol;
export type Bytes32 = `0x${string}` & { readonly [bytes32Brand]: true };

export type ChainConfig = {
  chainId: 42161 | 80094;
  blockchain: string;
  rpcUrls: string[];
  tokens: TokenDefinition[];
  names: Record<string, string>;
  abbreviations: Record<string, string>;
  protocolAddresses: string[];
  circulatingSupplyWallets: string[];
  treasuryBlacklist: Record<string, string[]>;
  basePriceFeeds: Record<string, string>;
  ohmToken: string;
  nativeToken?: string;
  liquidityHandlers: LiquidityHandler[];
  ownedLiquidityHandlers: LiquidityHandler[];
};

export type LiquidityHandler =
  | { kind: "stable"; id: string; tokens: string[] }
  | { kind: "univ2"; id: string; tokens: string[] }
  | { kind: "univ3"; id: string; tokens: string[] }
  | { kind: "univ3-quoter"; id: string; quoter: string; tokens: string[] }
  | { kind: "balancer"; id: Bytes32; vault: string; tokens: string[] }
  | {
      kind: "kodiak";
      id: string;
      pool: string;
      quoter: string;
      rewardVault?: string;
      tokens: string[];
    };
