import type { Address } from "viem";

export type TokenCategory = "Stable" | "Volatile" | "ProtocolOwnedLiquidity";

export interface TokenDefinition {
  address: Address;
  name: string;
  category: TokenCategory;
  isLiquid: boolean;
  isBluechip: boolean;
  /** Multiplier for liquid backing calculation (default 1.0). Used for haircut pricing on illiquid assets. */
  liquidBackingMultiplier: number;
}

export type PriceHandlerType =
  | "balancer"
  | "uniswapV2"
  | "uniswapV3"
  | "uniswapV3Quoter"
  | "kodiakIsland"
  | "stablecoin"
  | "chainlink"
  | "customMapping"
  | "remapping";

export interface PriceHandlerConfig {
  type: PriceHandlerType;
  id: string;
  tokens: [string, string] | string[];
  /** Pool address or Balancer pool ID */
  pool?: Address | string;
  /** Balancer vault or UniV3 position manager or Kodiak quoter */
  auxContract?: Address;
  /** For staked LP wrappers (e.g., Beradrome reward vaults) */
  stakedWrapper?: Address;
  /** For remapping: target token address */
  remapTarget?: Address;
}

export interface ChainlinkFeed {
  token: string;
  feedAddress: Address;
}

export interface LendingDeployment {
  block: bigint;
  amount: number;
  targetAddress: Address;
}

export interface LendingMarketConfig {
  siloRepository?: Address;
  siloAddress?: Address;
  siloRepositoryBlock?: bigint;
  siloDeployments?: LendingDeployment[];
  sentimentLToken?: Address;
  sentimentBlock?: bigint;
  sentimentDeployments?: LendingDeployment[];
  olympusLender?: Address;
}

export interface StakingConfig {
  contractAddress: Address;
  poolIds: number[];
  tokenName: string;
}

export interface ChainConfig {
  chainId: number;
  blockchain: string;

  /** OHM token address on this chain */
  ohmAddress: Address;
  /** All OHM-like tokens to blacklist from treasury records (OHM, gOHM, etc.) */
  ohmTokens: Address[];

  /** Protocol wallet addresses that hold treasury assets */
  protocolAddresses: Address[];
  /** Wallets whose OHM/gOHM balances are deducted from circulating supply */
  circulatingSupplyWallets: Address[];
  /** Token address → wallet addresses where that token should be excluded from treasury records */
  treasuryBlacklist: Map<Address, Address[]>;

  /** Token definitions for this chain */
  tokenDefinitions: TokenDefinition[];
  /** Price handler configurations */
  priceHandlers: PriceHandlerConfig[];
  /** Chainlink/Redstone price feeds for base token pricing */
  chainlinkFeeds: ChainlinkFeed[];

  /** Lending market config (Arbitrum only for now) */
  lendingMarkets?: LendingMarketConfig;
  /** Staking positions to check (e.g., Jones staking, TreasureDAO) */
  stakingPositions?: StakingConfig[];

  /** Block number guards */
  startBlock: bigint;
  blockGuards?: Record<string, bigint>;
}
