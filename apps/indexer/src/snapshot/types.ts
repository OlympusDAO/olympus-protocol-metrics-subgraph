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
  // Last block (inclusive) the token is valued. After it the token prices at
  // zero and emits no records, e.g. UST after its collapse.
  lastActiveBlock?: number;
  // When true, snapshot-time balance is read via `balanceOf(wallet)` RPC
  // instead of the event-driven TokenBalance ledger. Required for tokens
  // that mutate balances without emitting `Transfer` events:
  //   - ERC4626 vaults like sDAI that only emit `Deposit`/`Withdraw`
  //   - WETH9-style wrappers that emit `Deposit`/`Withdrawal`
  //   - Rebasing receipts (Aave aTokens, staked tokens) where balanceOf
  //     accrues interest silently
  // For these tokens the Transfer-summation tracker drifts and can go
  // negative, polluting downstream rollups. See tasks/lessons.md
  // "2026-05-17 — Tokens that mutate balance without Transfer events".
  nonStandardBalance?: boolean;
  // Snapshot-time read for receipts whose ERC20 `balanceOf` isn't the asset
  // amount (e.g. veFXS returns decaying voting power, not the locked FXS).
  // `method` selects a fixed ABI in `readPositionAmount`; `wallets` narrows
  // the read to the holders legacy valued. Takes precedence over
  // `nonStandardBalance`.
  positionRead?: { method: PositionReadMethod; wallets?: string[] };
};

export type PositionReadMethod =
  | "veFxs.lockedAmount"
  | "erc20.balanceOf"
  | "liquity.stakes"
  | "stabilityPool.compoundedLusd"
  | "stabilityPool.ethGain"
  | "stabilityPool.lqtyGain"
  | "vlCvx.unlockable"
  | "auraLocker.total"
  | "rlBtrfly.unlockable"
  | "aura.earned"
  | "rari.hasId"
  | "rari.amountAllocated"
  | "frax.lockedLiquidity"
  | "incurDebt.totalOutstanding";

// Protocol-owned liquidity valued through a pool's price handler (see
// handlers/LiquidityPositions.ts). Each source is one way the treasury held
// the pool's LP: in a wallet (TokenBalance ledger for `lpToken`) or staked in
// a gauge / Aura / Convex / Frax farm contract read at the snapshot.
export type LiquidityPositionSource =
  | { kind: "wallet"; label: string; wallets: string[] }
  | {
      kind: "read";
      contract: string;
      method: PositionReadMethod;
      receiptToken: string; // token address the record carries (legacy parity)
      label: string;
      wallets: string[];
    };

export type LiquidityPosition = {
  pricing: LiquidityHandler; // pool handler for total value and LP unit price
  lpToken: string;
  poolLabel: string; // legacy pool name on the OHM supply rows
  // Defaults to "Protocol-Owned Liquidity". Pools without OHM (FraxBP) keep
  // legacy's Stable category.
  category?: string;
  sources: LiquidityPositionSource[];
  startBlock: number;
  lastActiveBlock?: number;
};

// OHM the treasury deployed into a lending market, recognised at the deployed
// amount rather than the market's live balance (legacy SILO_DEPLOYMENTS /
// EULER_DEPLOYMENTS).
export type LendingDeployment = {
  source: string;
  entries: { block: number; amount: string }[];
  lastActiveBlock?: number;
};

// Treasury positions held inside another protocol's contract (see
// handlers/ProtocolPositions.ts). Amounts are denominated in `token`, which
// drives price, category and liquidity through its TokenDefinition.
export type ProtocolPosition =
  | {
      kind: "read";
      contract: string;
      method: PositionReadMethod;
      token: string;
      label: string; // legacy record token name
      wallets: string[]; // holders legacy observed for this position
      startBlock: number;
      lastActiveBlock?: number;
      // Legacy kept the position in market value but zeroed its liquid
      // backing contribution from this block (e.g. bricked cvxCRV).
      writeOffFromBlock?: number;
    }
  | {
      kind: "rari";
      allocator: string;
      allocations: { id: number; token: string; label: string }[];
      startBlock: number;
      lastActiveBlock?: number;
    }
  | {
      kind: "fixed";
      source: string;
      token: string;
      label: string;
      entries: { block: number; amount: string }[];
      startBlock?: number;
      lastActiveBlock?: number;
    };

export type BasePriceFeed = {
  address: string;
  startBlock?: number;
};

declare const bytes32Brand: unique symbol;
export type Bytes32 = `0x${string}` & { readonly [bytes32Brand]: true };

export type ChainId = 1 | 42161 | 80094 | 8453 | 137 | 250 | 4663;

// Named chainId constants — preferred over numeric literals at call sites
// (e.g. `chainId === CHAIN_IDS.ETHEREUM` reads better than `chainId === 1`,
// and CHAIN_CONFIGS[CHAIN_IDS.ETHEREUM] avoids hard-coding the magic 1).
export const CHAIN_IDS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  POLYGON: 137,
  FANTOM: 250,
  BASE: 8453,
  BERACHAIN: 80094,
  ROBINHOOD: 4663,
} as const satisfies Record<string, ChainId>;

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

// Maker DSR (Pot) deposits. DAI in the DSR is held as normalized shares
// (`pie(wallet)`) that accrue via the rate accumulator (`chi()`), not as an
// ERC20 balance, so it needs its own snapshot read. Legacy parity:
// `getMakerDSRRecords`.
export type MakerDsrConfig = {
  pot: string;
  depositToken: string; // DAI — the token DSR balances are denominated and priced in
  startBlock: number;
};

export type ChainConfig = {
  chainId: ChainId;
  blockchain: string;
  startBlock: number;
  rpcUrls: string[];
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
  makerDsr?: MakerDsrConfig;
  protocolPositions?: ProtocolPosition[];
  liquidityPositions?: LiquidityPosition[];
  // Olympus IncurDebt: outstanding OHM debt counted as Boosted Liquidity
  // Vault supply from `startBlock`.
  incurDebt?: { address: string; startBlock: number };
  lendingDeployments?: LendingDeployment[];
  // Non-protocol wallets legacy counted as treasury OHM up to a block.
  treasuryOhmExtraWallets?: { address: string; lastActiveBlock: number }[];
  mellowVault?: {
    shares: string;
    oracle: string;
    depositQueue: string;
    redeemQueue: string;
    asset: string;
    startBlock: number;
  };
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
  // Additional OHM-equivalent tokens to count in the TREASURY supply
  // category alongside the bare `ohmToken`. Legacy treasury subgraph
  // includes gOHM / sOHM v2 / sOHM v3 held by `circulatingSupplyWallets`
  // as part of the TREASURY deduction — see
  // inventory-ethereum.md §"Treasury OHM" plus the start-block gates
  // documented under "gOHM Indexing Start" / "sOHM V2 Balance Indexing".
  // Missing this on Envio inflated historical `ohmBackedSupply` by ~12%
  // on 2024-10-01 (~2M OHM-equivalent in gOHM that legacy counted but
  // Envio didn't).
  //
  // - `convertVia: "gohm-index"`: balance is in 18-decimal gOHM-style
  //   units; multiply by the sOHM V3 rebase index to get OHM-equivalent
  // - `convertVia: "direct"`: balance is already in 9-decimal
  //   OHM-equivalent units (sOHM V3, post-rebase)
  treasuryOhmEquivalents?: Array<{
    tokenAddress: string;
    decimals: number;
    startBlock: number;
    convertVia: "gohm-index" | "direct";
  }>;
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
  // UniV3 NFT POL: NonfungiblePositionManager address. When set, each
  // protocol wallet is iterated for NFT positions per snapshot and each
  // position's amounts are derived from Univ3PoolState sqrtPriceX96.
  univ3PositionManager?: { address: string; startBlock: number };
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
