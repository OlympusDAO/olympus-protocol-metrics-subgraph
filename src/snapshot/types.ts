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

export type ChainId = 1 | 42161 | 80094 | 8453 | 137 | 250;

// Per-chain feature flags. `emitsTokenSupply` controls whether the snapshot
// path writes TokenSupply rows. Polygon and Fantom legacy subgraphs declare
// the entity but never emit any rows (Phase 1 decision #1 — match legacy);
// other chains emit. Default = true when the field is omitted.

// Cooler Loans receivable source. Each clearinghouse exposes a single
// receivable value via either `principalReceivables()` (V1/V1.1/V2) or
// `totalDebt()` (MonoCooler V2). Per Phase 1 decision #5 we mirror legacy
// behavior exactly, including the quirk where MonoCooler USDS receivables
// price via the DAI Chainlink rate (inventory open question #3).
export type CoolerClearinghouse = {
  address: string;
  kind: "clearinghouse" | "monocooler";
  name: string;
  receivableToken: string; // ERC20 the receivable is denominated in (DAI for V1/V1.1/V2; USDS for MonoCooler)
  priceToken?: string; // optional override for the price lookup (MonoCooler uses DAI rate even though debt is USDS)
  startBlock?: number;
};

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
  coolerClearinghouses?: CoolerClearinghouse[];
  blvRegistry?: { address: string; startBlock: number };
  bondManager?: { address: string; startBlock: number };
  // OHM V1 → V2 migration offset. Subtracts `offsetOhm × current sOHM index`
  // OHM from supply between [startBlock, endBlock). Source: legacy
  // OhmCalculations.getMigrationOffsetRecord.
  migrationOffset?: {
    migrationContract: string;
    sOhmAddress: string; // sOHM V3 — used to look up OhmIndexState
    offsetOhm: string; // 2013 (per inventory §7); read as BigDecimal
    startBlock: number; // 14_381_564
    endBlock: number; // 24_550_660 (exclusive)
  };
  // Olympus staking contracts. Used to read the per-epoch OHM distribution
  // for the APY calculation. V1 is always tried; V2/V3 are gated on their
  // respective start blocks.
  stakingContracts?: {
    v1: string;
    v2: string;
    v2StartBlock: number;
    v3: string;
    v3StartBlock: number;
  };
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
  | {
      kind: "gohm";
      id: string; // sOHM contract address — also used as OhmIndexState lookup key
      tokens: string[]; // exactly one token: gOHM address
      ohmToken: string; // OHM address used for recursive base-price lookup
      startBlock?: number;
    }
  | {
      kind: "erc4626";
      id: string; // vault token address — also the share token tracked by TokenBalance
      tokens: string[]; // [vault address]
      underlying: string; // asset() — underlying token address used for recursive base-price lookup
      decimals: number; // share token decimals (passed as input to convertToAssets)
      underlyingDecimals: number; // underlying asset decimals (used to normalize convertToAssets result)
      startBlock?: number;
    }
  | {
      kind: "curve";
      id: string; // pool address (also the LP token for V1 pools; for V2 lpToken differs)
      tokens: string[]; // [LP token address] — what we price
      lpToken: string; // LP token address (== id for V1; lp_token() for V2)
      coins: string[]; // underlying coin addresses in pool index order
      coinDecimals: number[]; // raw decimals for each coin
      startBlock?: number;
    }
  | {
      kind: "fraxswap";
      id: string; // pool / LP token address (UniV2-like — pair *is* the LP)
      tokens: string[]; // [pool address]
      token0: string;
      token1: string;
      decimals0: number;
      decimals1: number;
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
