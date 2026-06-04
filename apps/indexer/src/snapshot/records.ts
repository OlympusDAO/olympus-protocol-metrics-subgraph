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
    id: `${date}/${config.chainId}/${blockNumber}/${sourceName}/${tokenName}`,
    chainId: config.chainId,
    blockchain: config.blockchain,
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
  type: string,
  balance: BigNumber,
  blockNumber: bigint,
  multiplier = 1,
): SerializedTokenSupply {
  const date = isoDate(timestamp);
  return {
    id: `${date}/${config.chainId}/${blockNumber}/${tokenName}/${type}/${poolName ?? "Unknown Pool"}/${sourceName ?? ""}`,
    chainId: config.chainId,
    blockchain: config.blockchain,
    block: blockNumber.toString(),
    timestamp: timestamp.toString(),
    date,
    token: tokenName,
    tokenAddress,
    pool: poolName,
    poolAddress,
    source: sourceName,
    sourceAddress,
    type,
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
  const abbreviationValue = config.abbreviations[lower];
  // Skip the parenthetical when the abbreviation is just the name repeated
  // (case-insensitive). Otherwise we render "USDS (USDS)" / "OHM (OHM)" etc.
  // while legacy renders just "USDS" / "OHM". Useful abbreviations like
  // "Revenue-Locked BTRFLY (rlBTRFLY)" are preserved because they differ
  // from the name. Matches legacy `Contracts.getContractName` shape.
  const abbreviation =
    abbreviationValue && abbreviationValue.toLowerCase() !== name.toLowerCase()
      ? ` (${abbreviationValue})`
      : "";
  return `${name}${abbreviation}`;
}
