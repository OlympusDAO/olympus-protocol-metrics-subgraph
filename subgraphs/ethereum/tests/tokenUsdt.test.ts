import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, log, test } from "matchstick-as/assembly/index";

import { YIELD_FARMING_MS } from "../../shared/src/Wallets";
import { ERC20_USDT } from "../src/utils/Constants";
import { getWalletAddressesForContract } from "../src/utils/ProtocolAddresses";
import { getStablecoinBalance } from "../src/utils/TokenStablecoins";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";
import { mockPriceFeed } from "./chainlink";
import { mockERC20TotalSupply } from "./erc20Helper";
import { mockWalletBalance, mockZeroWalletBalances } from "./walletHelper";

const TIMESTAMP = BigInt.fromString("1");
const BLOCK_NUMBER = BigInt.fromString("24889372");
const BEFORE_START_BLOCK = BigInt.fromString("24707146");

describe("USDT - Yield Farming MS", () => {
  beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    mockTreasuryAddressNull();
    mockClearinghouseRegistryAddressNull();

    mockERC20TotalSupply(ERC20_USDT, 6, BigInt.fromString("0"));
    mockZeroWalletBalances(
      ERC20_USDT,
      getWalletAddressesForContract(ERC20_USDT, BLOCK_NUMBER),
    );
  });

  test("getStablecoinBalance returns correct USDT balance for Yield Farming MS", () => {
    mockPriceFeed(ERC20_USDT, BigDecimal.fromString("1"));

    // balanceOf(YIELD_FARMING_MS) = 1,100,000 USDT on block 24889372
    mockWalletBalance(
      ERC20_USDT,
      YIELD_FARMING_MS,
      BigInt.fromString("1100000000000"),
    );

    const records = getStablecoinBalance(TIMESTAMP, ERC20_USDT, false, BLOCK_NUMBER);

    assert.assertTrue(records.length > 0);

    let found = false;
    for (let i = 0; i < records.length; i++) {
      if (records[i].sourceAddress.toLowerCase() == YIELD_FARMING_MS.toLowerCase()) {
        assert.stringEquals(records[i].balance.toString(), "1100000");
        assert.stringEquals(records[i].rate.toString(), "1");
        assert.stringEquals(records[i].value.toString(), "1100000");
        found = true;
      }
    }
    assert.assertTrue(found);
  });

  test("getStablecoinBalance returns records only for Yield Farming MS", () => {
    mockPriceFeed(ERC20_USDT, BigDecimal.fromString("1"));
    mockWalletBalance(
      ERC20_USDT,
      YIELD_FARMING_MS,
      BigInt.fromString("1100000000000"),
    );

    const records = getStablecoinBalance(TIMESTAMP, ERC20_USDT, false, BLOCK_NUMBER);

    assert.assertTrue(records.length > 0);

    for (let i = 0; i < records.length; i++) {
      assert.stringEquals(records[i].sourceAddress.toLowerCase(), YIELD_FARMING_MS.toLowerCase());
    }
  });

  test("getStablecoinBalance returns empty before start block", () => {
    const records = getStablecoinBalance(TIMESTAMP, ERC20_USDT, false, BEFORE_START_BLOCK);

    assert.i32Equals(0, records.length);
  });

  test("getStablecoinBalance returns no records when balance is zero", () => {
    mockPriceFeed(ERC20_USDT, BigDecimal.fromString("1"));

    const records = getStablecoinBalance(TIMESTAMP, ERC20_USDT, false, BLOCK_NUMBER);

    assert.i32Equals(0, records.length);
  });
});
