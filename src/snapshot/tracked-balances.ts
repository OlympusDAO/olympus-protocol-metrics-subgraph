import BigNumber from "bignumber.js";
import { zeroAddress } from "viem";

import { addr, isActive } from "./math";
import { getWalletAddressesForContract } from "./records";
import type { ChainConfig, TrackedTokenBalanceInput } from "./types";

export type TrackedBalanceMap = Map<string, BigNumber>;
export type TrackedTokenWalletPair = {
  tokenAddress: string;
  walletAddress: string;
};

export function getTrackedBalanceKey(tokenAddress: string, walletAddress: string) {
  return `${addr(tokenAddress)}/${addr(walletAddress)}`;
}

export function getTrackedBalanceLookupKey(
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
) {
  return `${chainId}/${getTrackedBalanceKey(tokenAddress, walletAddress)}`;
}

export function getTrackedBalanceSnapshotId(
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  block: bigint,
  logIndex: number,
) {
  return `${getTrackedBalanceLookupKey(chainId, tokenAddress, walletAddress)}/${block.toString()}/${logIndex}`;
}

export function toTrackedBalanceMap(
  balances: TrackedTokenBalanceInput[] | undefined,
): TrackedBalanceMap | undefined {
  if (!balances) return undefined;
  return new Map(
    balances.map((balance) => [
      getTrackedBalanceKey(balance.tokenAddress, balance.walletAddress),
      new BigNumber(balance.balance),
    ]),
  );
}

export function getTrackedBalance(
  balances: TrackedBalanceMap | undefined,
  tokenAddress: string,
  walletAddress: string,
) {
  return balances?.get(getTrackedBalanceKey(tokenAddress, walletAddress));
}

export function getTrackedTokenAddresses(config: ChainConfig, blockNumber?: bigint) {
  const tokenAddresses = new Set<string>();
  tokenAddresses.add(config.ohmToken);
  for (const definition of config.tokens) {
    if (definition.category === "Protocol-Owned Liquidity") continue;
    if (definition.address === zeroAddress.toLowerCase()) continue;
    if (blockNumber !== undefined && !isActive(definition, blockNumber)) continue;
    tokenAddresses.add(definition.address);
  }
  if (
    blockNumber !== undefined &&
    config.ohmStartBlock &&
    blockNumber < BigInt(config.ohmStartBlock)
  ) {
    tokenAddresses.delete(config.ohmToken);
  }
  return [...tokenAddresses];
}

export function getTrackedTokenWalletPairs(
  config: ChainConfig,
  blockNumber?: bigint,
): TrackedTokenWalletPair[] {
  const pairs = new Map<string, TrackedTokenWalletPair>();
  const addPair = (tokenAddress: string, walletAddress: string) => {
    pairs.set(getTrackedBalanceKey(tokenAddress, walletAddress), {
      tokenAddress: addr(tokenAddress),
      walletAddress: addr(walletAddress),
    });
  };

  for (const tokenAddress of getTrackedTokenAddresses(config, blockNumber)) {
    for (const walletAddress of getWalletAddressesForContract(config, tokenAddress)) {
      addPair(tokenAddress, walletAddress);
    }
  }

  if (
    blockNumber === undefined ||
    !config.ohmStartBlock ||
    blockNumber >= BigInt(config.ohmStartBlock)
  ) {
    for (const walletAddress of config.circulatingSupplyWallets) {
      addPair(config.ohmToken, walletAddress);
    }
  }

  return [...pairs.values()];
}

export function getTokenTrackingStartBlock(config: ChainConfig, tokenAddress: string) {
  const token = config.tokens.find((definition) => definition.address === addr(tokenAddress));
  if (token?.startBlock !== undefined) return token.startBlock;
  if (addr(tokenAddress) === config.ohmToken && config.ohmStartBlock !== undefined) {
    return config.ohmStartBlock;
  }
  return config.startBlock;
}

export function getTrackedWalletAddresses(config: ChainConfig) {
  return [...new Set(getTrackedTokenWalletPairs(config).map(({ walletAddress }) => walletAddress))];
}
