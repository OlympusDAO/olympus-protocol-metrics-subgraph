import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { addr, isActive, matches } from "../../src/snapshot/math";
import { getContractName } from "../../src/snapshot/records";

const ETHEREUM = CHAIN_CONFIGS[1];
type Config = {
  contracts: Array<{ name: string; events: Array<{ event: string }> }>;
  chains: Array<{ id: number; contracts: Array<{ name: string; address: string[] }> }>;
};

const CONFIG = parse(readFileSync(resolve(__dirname, "../../config.yaml"), "utf8")) as Config;
const ETHEREUM_CONTRACTS = CONFIG.chains.find((chain) => chain.id === 1)?.contracts ?? [];

function configuredEvents(address: string): string[] {
  const contractNames = ETHEREUM_CONTRACTS.filter((contract) =>
    contract.address.some((value) => addr(value) === addr(address)),
  ).map((contract) => contract.name);
  return CONFIG.contracts
    .filter((contract) => contractNames.includes(contract.name))
    .flatMap((contract) => contract.events.map(({ event }) => event.split("(")[0]));
}

// Tokens legacy valued that the Envio port had dropped. `ledger` tokens emit
// Transfer and must be registered in config.yaml; the rest are read at
// snapshot time.
const PORTED = [
  {
    symbol: "FEI",
    address: "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
    category: "Stable",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "UST",
    address: "0xa693b19d2931d498c5b318df961919bb4aee87a5",
    category: "Stable",
    decimals: 6,
    ledger: true,
  },
  {
    symbol: "wBTC",
    address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    category: "Volatile",
    decimals: 8,
    ledger: true,
  },
  {
    symbol: "TRIBE",
    address: "0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "TOKE",
    address: "0x2e9d63788249371f1dfc918a52f8d799f4a38c94",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "xSUSHI",
    address: "0x8798249c2e607446efb7ad49ec89dd1865ff4272",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "BOND",
    address: "0x0391D2021f89DC339F60Fff84546EA23E337750f",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "CVX",
    address: "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "vlCVX",
    address: "0x72a19342e8F1838460eBFCCEf09F6585e32db86E",
    category: "Volatile",
    decimals: 18,
    ledger: false,
  },
  {
    symbol: "AURA",
    address: "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "vlAURA",
    address: "0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC",
    category: "Volatile",
    decimals: 18,
    ledger: false,
  },
  {
    symbol: "auraBAL",
    address: "0x616e8BfA43F920657B3497DBf40D6b1A02D4608d",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "BAL",
    address: "0xba100000625a3754423978a60c9317c58a424e3d",
    category: "Volatile",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "bb-a-USD",
    address: "0xA13a9247ea42D743238089903570127DdA72fE44",
    category: "Stable",
    decimals: 18,
    ledger: true,
  },
  {
    symbol: "cvxFRAX3CRV",
    address: "0xbe0f6478e0e4894cfb14f32855603a083a57c7da",
    category: "Stable",
    decimals: 18,
    ledger: false,
  },
];

const PRICE_POOLS = [
  ["0xdf50fbde8180c8785842c8e316ebe06f542d3443", "Swap"], // FEI-USDC V3
  ["0xceff51756c56ceffca006cd410b03ffc46dd3a58", "Sync"], // ETH-wBTC
  ["0x7ce01885a13c652241ae02ea7369ee8d466802eb", "Sync"], // TRIBE-ETH
  ["0xd4e7a6e2d03e4e48dfc27dd3f46df1c176647e38", "Sync"], // TOKE-ETH
  ["0x36e2fcccc59e5747ff63a03ea2e5c0c2c14911e7", "Sync"], // xSUSHI-ETH
  ["0x6591c4bcd6d7a1eb4e537da8b78676c1576ba244", "Sync"], // BOND-USDC
  ["0x05767d9ef41dc40689678ffca0608878fb3de906", "Sync"], // CVX-ETH
] as const;

describe("tokens ported from legacy", () => {
  test.each(PORTED)("$symbol has a definition, a price route and a readable balance", (token) => {
    const address = addr(token.address);
    const definition = ETHEREUM.tokens.find((value) => value.address === address);
    expect(definition, "token definition").toBeDefined();
    expect(definition?.category).toBe(token.category);
    expect(definition?.decimals).toBe(token.decimals);
    expect(definition?.isLiquid).toBe(true);

    expect(ETHEREUM.liquidityHandlers.some((handler) => matches(handler, address))).toBe(true);
    expect(getContractName(ETHEREUM, address)).not.toBe(address);

    if (token.ledger) {
      expect(configuredEvents(address)).toContain("Transfer");
    }
  });

  test("price pools are registered for Sync / Swap events", () => {
    for (const [pool, event] of PRICE_POOLS) {
      expect(configuredEvents(pool), pool).toContain(event);
    }
  });

  test("BOND keeps legacy's 0.77 multiplier", () => {
    const bond = ETHEREUM.tokens.find(
      (value) => value.address === addr("0x0391D2021f89DC339F60Fff84546EA23E337750f"),
    );
    expect(bond?.multiplier).toBe("0.77");
  });

  test("UST stops being valued after its collapse", () => {
    const ust = ETHEREUM.tokens.find(
      (value) => value.address === addr("0xa693b19d2931d498c5b318df961919bb4aee87a5"),
    );
    expect(ust).toBeDefined();
    if (!ust) return;
    expect(isActive(ust, 13_408_365n)).toBe(false);
    expect(isActive(ust, 14_730_000n)).toBe(true);
    expect(isActive(ust, 14_730_001n)).toBe(false);
  });
});
