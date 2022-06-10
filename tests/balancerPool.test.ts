import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import {
  BALANCER_VAULT,
  ERC20_DAI,
  ERC20_OHM_V2,
  ERC20_WETH,
  POOL_BALANCER_OHM_DAI_WETH_ID,
} from "../src/utils/Constants";
import { toBigInt } from "../src/utils/Decimals";
import { getBalancerRecords } from "../src/utils/LiquidityBalancer";
import {
  ERC20_STANDARD_DECIMALS,
  getEthUsdRate,
  getOhmUsdRate,
  mockEthUsdRate,
  mockUsdOhmV2Rate,
  OHM_USD_RESERVE_BLOCK,
  OHM_V2_DECIMALS,
} from "./pairHelper";

const BALANCE_OHM = BigDecimal.fromString("221499.733846818");
const BALANCE_DAI = BigDecimal.fromString("1932155.145566782258916959");
const BALANCE_WETH = BigDecimal.fromString("1080.264364629190826870");

function mockBalancerVault(
  poolAddress: string,
  poolId: string,
  token1Address: string,
  token2Address: string,
  token3Address: string,
  token1Balance: BigDecimal,
  token2Balance: BigDecimal,
  token3Balance: BigDecimal,
  token1Decimals: i32,
  token2Decimals: i32,
  token3Decimals: i32,
): void {
  // getPoolTokens
  createMockedFunction(
    Address.fromString(poolAddress),
    "getPoolTokens",
    "getPoolTokens(bytes32):(address[],uint256[],uint256)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddressArray([
        Address.fromString(token1Address),
        Address.fromString(token2Address),
        Address.fromString(token3Address),
      ]),
      ethereum.Value.fromUnsignedBigIntArray([
        toBigInt(token1Balance, token1Decimals),
        toBigInt(token2Balance, token2Decimals),
        toBigInt(token3Balance, token3Decimals),
      ]),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("14936424")),
    ]);

  // Token Decimals
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );
  createMockedFunction(Address.fromString(token2Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token2Decimals)],
  );
  createMockedFunction(Address.fromString(token3Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token3Decimals)],
  );
}

describe("get balancer records", () => {
  test("OHM-DAI-ETH pool", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      false,
      OHM_USD_RESERVE_BLOCK,
    );

    // OHM * rate + DAI * rate + WETH * rate
    const expectedValue = BALANCE_OHM.times(getOhmUsdRate())
      .plus(BALANCE_DAI)
      .plus(BALANCE_WETH.times(getEthUsdRate()));
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });

  test("OHM-DAI-ETH pool single-sided value", () => {
    // Mock the balancer
    mockBalancerVault(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      ERC20_OHM_V2,
      ERC20_DAI,
      ERC20_WETH,
      BALANCE_OHM,
      BALANCE_DAI,
      BALANCE_WETH,
      OHM_V2_DECIMALS,
      ERC20_STANDARD_DECIMALS,
      ERC20_STANDARD_DECIMALS,
    );
    // Mock price lookup
    mockEthUsdRate();
    mockUsdOhmV2Rate();

    const records = getBalancerRecords(
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      true,
      OHM_USD_RESERVE_BLOCK,
    );

    // DAI * rate + WETH * rate (OHM excluded)
    const expectedValue = BALANCE_DAI.plus(BALANCE_WETH.times(getEthUsdRate()));
    assert.stringEquals(expectedValue.toString(), records.value.toString());
  });
});
