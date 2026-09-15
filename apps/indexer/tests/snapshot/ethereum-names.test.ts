import { describe, expect, test } from "vitest";

import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { getContractName } from "../../src/snapshot/records";

const ETHEREUM = CHAIN_CONFIGS[1];

// Source labels legacy wrote on tokenRecords / tokenSupplies for these
// holders. Without a name the record source falls back to the raw address.
const LEGACY_SOURCE_LABELS: [string, string][] = [
  ["0x75e7f7d871f4b5db0fa9b0f01b7422352ec9618f", "Convex Staking Proxy - OHM-FraxBP"],
  ["0x943c1dfa7da96e54242bd2c78dd3ef5c7b24b18c", "Convex Staking Proxy - FraxBP"],
  ["0xe3312c3f1ab30878d9686452f7205ebe11e965eb", "OTC Escrow"],
  ["0xf577c77ee3578c7f216327f41b5d7221ead2b2a3", "Bond Manager"],
  ["0x007fe70dc9797c4198528ae43d8195fff82bdc95", "Bond Fixed Expiry Teller"],
  ["0x184f3fad8618a6f458c16bae63f70c426fe784b3", "Migration Contract"],
];

describe("Ethereum source labels", () => {
  test.each(LEGACY_SOURCE_LABELS)("%s is labelled as in legacy", (address, label) => {
    expect(getContractName(ETHEREUM, address)).toBe(label);
  });
});
