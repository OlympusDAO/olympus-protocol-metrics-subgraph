import BigNumber from "bignumber.js";
import { describe, expect, test } from "vitest";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { createTokenRecord, getContractName } from "../../src/snapshot/records";
import type { ChainConfig } from "../../src/snapshot/types";

describe("getContractName label formatting", () => {
  test("Ethereum: known wallets render with friendly names, not raw addresses", () => {
    const ETH = CHAIN_CONFIGS[1];
    // Treasury MS / DAO Wallet — was the main source missing from the names
    // map before the labeling pass; appeared as raw `0x245cc372...`.
    expect(getContractName(ETH, "0x245cc372c84b3645bf0ffe6538620b04a217988b")).toBe(
      "Treasury MS (Formerly DAO Wallet)",
    );
    expect(getContractName(ETH, "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613")).toBe(
      "Bophades Treasury",
    );
    expect(getContractName(ETH, "0xd6a6e8d9e82534bd65821142fccd91ec9cf31880")).toBe(
      "Cooler Loans Clearinghouse V1",
    );
  });

  test("redundant abbreviation is dropped (no '(USDS)' after 'USDS')", () => {
    // Tokens whose abbreviation duplicates the name shouldn't render as
    // 'Name (Name)' — legacy treasury-subgraph renders just the name in this
    // case. Useful abbreviations like rlBTRFLY are still preserved.
    const ETH = CHAIN_CONFIGS[1];
    expect(getContractName(ETH, "0xdC035D45d973E3EC169d2276DDab16f1e407384F")).toBe("USDS");
    expect(getContractName(ETH, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe("USDC");
    expect(getContractName(ETH, "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5")).toBe("OHM");
    expect(getContractName(ETH, "0x0Ab87046fBb341D058F17CBC4c1133F25a20a52f")).toBe(
      "Governance OHM (gOHM)",
    );
  });

  test("Polygon: Cross-Chain Polygon renders by name", () => {
    const POLYGON = CHAIN_CONFIGS[137];
    expect(getContractName(POLYGON, "0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7")).toBe(
      "Cross-Chain Polygon",
    );
  });

  test("unknown address falls back to lowercased address", () => {
    const ETH = CHAIN_CONFIGS[1];
    const unknown = "0x1111111111111111111111111111111111111111";
    expect(getContractName(ETH, unknown)).toBe(unknown);
  });
});

// Guardrail: every OHM/gOHM token definition across all chain configs must
// have multiplier="0" so that `valueExcludingOhm` is zeroed for any
// TokenRecord emitted with that tokenAddress. Otherwise the multiplier
// defaults to "1" and OHM value bleeds into liquidBacking — caused the
// $763K Base OHM-USDC POL residual on PR #311 (Step ? drill-down).
describe("OHM/gOHM token defs must have multiplier='0'", () => {
  // Source of truth for "this address is OHM or gOHM" — matched
  // case-insensitively. New chains must add their OHM/gOHM addresses here.
  const OHM_ADDRESSES_PER_CHAIN: Record<number, string[]> = {
    1: [
      "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5", // OHM v2
      "0x0Ab87046fBb341D058F17CBC4c1133F25a20a52f", // gOHM
    ],
    137: [
      "0xd8cA34fd379d9ca3C6Ee3b3905678320F5b45195", // gOHM on Polygon
    ],
    250: [
      "0x91fa20244Fb509e8289CA630E5db3E9166233FDc", // gOHM on Fantom
    ],
    8453: [
      "0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0", // OHM on Base
    ],
    42161: [
      "0xf0cb2dc0db5e6c66B9a70Ac27B06b878da017028", // OHM on Arbitrum
      "0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1", // Synapse-bridged gOHM
    ],
    80094: [
      "0x18878Df23e2a36f81e820e4b47b4A40576D3159C", // OHM on Berachain
    ],
  };

  for (const [chainIdStr, ohmAddrs] of Object.entries(OHM_ADDRESSES_PER_CHAIN)) {
    const chainId = Number(chainIdStr);
    for (const ohmAddr of ohmAddrs) {
      test(`chain ${chainId}: ${ohmAddr} has multiplier "0"`, () => {
        const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
        expect(config, `no chain config for chainId ${chainId}`).toBeDefined();
        const tokenDef = config.tokens.find(
          (t) => t.address.toLowerCase() === ohmAddr.toLowerCase(),
        );
        expect(
          tokenDef,
          `OHM/gOHM token def ${ohmAddr} is not registered on chain ${chainId}; either add it or update the guardrail list`,
        ).toBeDefined();
        expect(
          tokenDef?.multiplier,
          `OHM/gOHM def ${ohmAddr} on chain ${chainId} is missing multiplier="0"; valueExcludingOhm will overstate liquidBacking`,
        ).toBe("0");
      });
    }
  }
});

// Berachain BitGo custodian wallets hold treasury assets that can't be
// deployed at will, so their records stay in market value but are illiquid
// and carry a distinct name. The frontend groups holdings by token name and
// ORs the liquid flags, so a shared "BERA" name would still read as liquid
// while the DAO MS holds BERA too.
describe("createTokenRecord illiquid wallets", () => {
  const BERACHAIN = CHAIN_CONFIGS[80094];
  const NATIVE_BERA = "0x0000000000000000000000000000000000000000";
  const INFRARED_CUSTODIAN = "0xb65e74f6b2c0633e30ba1be75db818bb9522a81a";
  const THJ_CUSTODIAN = "0x082689241b09c600b3eaf3812b1d09791e7ded5a";
  const DAO_MULTISIG = "0x91494D1BC2286343D51c55E46AE80C9356D099b5";

  function beraRecord(config: ChainConfig, wallet: string) {
    return createTokenRecord(
      config,
      1_790_000_000n,
      getContractName(config, NATIVE_BERA),
      NATIVE_BERA,
      getContractName(config, wallet),
      wallet,
      new BigNumber("0.235"),
      new BigNumber("2800000"),
      10_000_000n,
    );
  }

  test("Berachain marks both BitGo custodians illiquid and keeps them protocol wallets", () => {
    const illiquid = (BERACHAIN.illiquidWallets ?? []).map((wallet) => wallet.address);
    expect(illiquid).toEqual([INFRARED_CUSTODIAN, THJ_CUSTODIAN]);
    expect(BERACHAIN.protocolAddresses).toEqual(
      expect.arrayContaining([INFRARED_CUSTODIAN, THJ_CUSTODIAN]),
    );
  });

  test("native BERA at the Infrared custodian is illiquid with the custody name", () => {
    const record = beraRecord(BERACHAIN, INFRARED_CUSTODIAN);
    expect(record.isLiquid).toBe(false);
    expect(record.token).toBe("BERA - BitGo Custody");
    expect(record.id).toContain("/Infrared Custodian/BERA - BitGo Custody");
    // Address, rate, balance and value are untouched.
    expect(record.tokenAddress).toBe(NATIVE_BERA);
    expect(record.rate).toBe("0.235");
    expect(record.balance).toBe("2800000");
    expect(record.value).toBe("658000");
    expect(record.valueExcludingOhm).toBe("658000");
  });

  test("the wallet match ignores address case", () => {
    const record = beraRecord(BERACHAIN, "0x082689241B09C600B3EAF3812B1D09791E7DED5A");
    expect(record.isLiquid).toBe(false);
    expect(record.token).toBe("BERA - BitGo Custody");
  });

  test("native BERA at the DAO multisig keeps its liquid flag and normal name", () => {
    const record = beraRecord(BERACHAIN, DAO_MULTISIG);
    expect(record.isLiquid).toBe(true);
    expect(record.token).toBe("BERA");
    expect(record.value).toBe("658000");
  });

  test("a config without illiquidWallets behaves exactly as before", () => {
    const { illiquidWallets: _omitted, ...withoutList } = BERACHAIN;
    const absent = beraRecord(withoutList, INFRARED_CUSTODIAN);
    expect(absent.isLiquid).toBe(true);
    expect(absent.token).toBe("BERA");

    const empty = beraRecord({ ...BERACHAIN, illiquidWallets: [] }, INFRARED_CUSTODIAN);
    expect(empty).toEqual(absent);
  });
});
