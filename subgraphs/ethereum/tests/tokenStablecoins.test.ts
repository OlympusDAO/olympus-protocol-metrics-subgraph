import { BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, log,test } from "matchstick-as/assembly/index";

import { NATIVE_ETH } from "../src/utils/Constants";
import { getStablecoinBalance } from "../src/utils/TokenStablecoins";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";
import { mockEthUsdRate } from "./pairHelper";

const TIMESTAMP = BigInt.fromString("1");

beforeEach(() => {
  log.debug("beforeEach: Clearing store", []);
  clearStore();

  // Do at the start, as it can be used by mock functions
  mockTreasuryAddressNull();
  mockClearinghouseRegistryAddressNull();
});

describe("native ETH", () => {
  test("getStablecoinBalance does not throw error", () => {
    mockEthUsdRate();

    const records = getStablecoinBalance(
      TIMESTAMP,
      NATIVE_ETH,
      false,
      BigInt.fromString("14000000"),
    );

    // Native ETH isn't an ERC20 contract, and isn't supported by TheGraph API.
    // The code shouldn't throw any errors/exceptions when it comes across native ETH.
    assert.i32Equals(0, records.length);
  });
});
