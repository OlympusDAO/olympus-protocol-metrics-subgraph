import BigNumber from "bignumber.js";

import { addr, isoDate, same } from "./math";
import type { ChainConfig, SerializedTokenRecord, SerializedTokenSupply } from "./types";

export function createTokenRecord(
  config: ChainConfig,
  timestamp: bigint,
  tokenName: string,
  tokenAddress: string,
  sourceName: string,
  sourceAddress: string,
  rate: BigNumber,
  balance: BigNumber,
  blockNumber: bigint,
  nonOhmMultiplier?: BigNumber,
  category?: string,
): SerializedTokenRecord {
  const date = isoDate(timestamp);
  const definition = getTokenDefinition(config, tokenAddress);
  const multiplier = nonOhmMultiplier ?? new BigNumber(definition?.multiplier ?? "1");
  const baseValue = balance.times(rate);
  const isLiability = definition?.isLiability ?? false;
  const value = isLiability ? baseValue.times(-1) : baseValue;
  const valueExcludingOhm = isLiability
    ? baseValue.times(multiplier).times(-1)
    : baseValue.times(multiplier);
  return {
    id: `${config.chainId}-${date}/${blockNumber}/${sourceName}/${tokenName}`,
    block: blockNumber.toString(),
    timestamp: timestamp.toString(),
    date,
    token: tokenName,
    tokenAddress,
    source: sourceName,
    sourceAddress,
    rate: rate.toString(10),
    balance: balance.toString(10),
    multiplier: multiplier.toString(10),
    value: value.toString(10),
    valueExcludingOhm: valueExcludingOhm.toString(10),
    category: category ?? definition?.category ?? "Unknown",
    isLiquid: definition?.isLiquid ?? true,
    isBluechip: definition?.isBluechip ?? false,
    blockchain: config.blockchain,
  };
}

export function createTokenSupply(
  config: ChainConfig,
  timestamp: bigint,
  tokenName: string,
  tokenAddress: string,
  poolName: string | undefined,
  poolAddress: string | undefined,
  sourceName: string | undefined,
  sourceAddress: string | undefined,
  recordType: string,
  balance: BigNumber,
  blockNumber: bigint,
  multiplier = 1,
): SerializedTokenSupply {
  const date = isoDate(timestamp);
  return {
    id: `${config.chainId}-${date}/${blockNumber}/${tokenName}/${recordType}/${poolName ?? "Unknown Pool"}/${sourceName ?? ""}`,
    block: blockNumber.toString(),
    timestamp: timestamp.toString(),
    date,
    token: tokenName,
    tokenAddress,
    pool: poolName,
    poolAddress,
    source: sourceName,
    sourceAddress,
    recordType,
    balance: balance.toString(10),
    supplyBalance: balance.times(multiplier).toString(10),
  };
}

export function getWalletAddressesForContract(config: ChainConfig, contractAddress: string) {
  const blacklist = config.treasuryBlacklist[addr(contractAddress)] ?? [];
  return config.protocolAddresses.filter(
    (address) => !blacklist.some((blocked) => same(blocked, address)),
  );
}

export function getTokenDefinition(config: ChainConfig, tokenAddress: string) {
  return config.tokens.find((value) => same(value.address, tokenAddress));
}

export function getContractName(config: ChainConfig, contractAddress: string) {
  const lower = addr(contractAddress);
  const name = config.names[lower] ?? lower;
  const abbreviation = config.abbreviations[lower] ? ` (${config.abbreviations[lower]})` : "";
  return `${name}${abbreviation}`;
}
