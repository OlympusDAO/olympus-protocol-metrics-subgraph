import { describe, expect, test } from "vitest";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { getContractName } from "../../src/snapshot/records";

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
