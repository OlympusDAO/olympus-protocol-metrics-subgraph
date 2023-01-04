import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { ContractNameLookup } from "../../src/contracts/ContractLookup";
import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { PriceHandlerBalancer } from "../../src/price/PriceHandlerBalancer";
import { toBigInt } from "../../src/utils/Decimals";
import { addressesEqual } from "../../src/utils/StringHelper";

export function mockBalancerVault(
  vaultAddress: string,
  poolId: string,
  poolTokenAddress: string,
  poolTokenDecimals: i32,
  poolTokenTotalSupply: BigDecimal,
  token1Address: string,
  token2Address: string,
  token3Address: string | null,
  token1Balance: BigDecimal,
  token2Balance: BigDecimal,
  token3Balance: BigDecimal | null,
  token1Decimals: i32,
  token2Decimals: i32,
  token3Decimals: i32,
  token1Weight: BigDecimal,
  token2Weight: BigDecimal,
  token3Weight: BigDecimal | null,
): void {
  const tokenAddressArray = [Address.fromString(token1Address), Address.fromString(token2Address)];
  if (token3Address !== null) tokenAddressArray.push(Address.fromString(token3Address));

  const tokenBalanceArray = [
    toBigInt(token1Balance, token1Decimals),
    toBigInt(token2Balance, token2Decimals),
  ];
  if (token3Balance !== null) tokenBalanceArray.push(toBigInt(token3Balance, token3Decimals));

  // getPoolTokens
  createMockedFunction(
    Address.fromString(vaultAddress),
    "getPoolTokens",
    "getPoolTokens(bytes32):(address[],uint256[],uint256)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddressArray(tokenAddressArray),
      ethereum.Value.fromUnsignedBigIntArray(tokenBalanceArray),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("14936424")),
    ]);

  // getPool
  createMockedFunction(
    Address.fromString(vaultAddress),
    "getPool",
    "getPool(bytes32):(address,uint8)",
  )
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(poolId))])
    .returns([
      ethereum.Value.fromAddress(Address.fromString(poolTokenAddress)),
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ]);
  // Pool token
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "decimals",
    "decimals():(uint8)",
  ).returns([ethereum.Value.fromI32(poolTokenDecimals)]);
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "totalSupply",
    "totalSupply():(uint256)",
  ).returns([ethereum.Value.fromUnsignedBigInt(toBigInt(poolTokenTotalSupply, poolTokenDecimals))]);

  // Token Decimals
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );
  createMockedFunction(Address.fromString(token2Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token2Decimals)],
  );
  if (token3Address !== null) {
    createMockedFunction(
      Address.fromString(token3Address),
      "decimals",
      "decimals():(uint8)",
    ).returns([ethereum.Value.fromI32(token3Decimals)]);
  }

  // Token weighting
  const tokenWeightArray = [
    toBigInt(token1Weight, poolTokenDecimals),
    toBigInt(token2Weight, poolTokenDecimals),
  ];
  if (token3Weight !== null) tokenWeightArray.push(toBigInt(token3Weight, poolTokenDecimals));
  createMockedFunction(
    Address.fromString(poolTokenAddress),
    "getNormalizedWeights",
    "getNormalizedWeights():(uint256[])",
  ).returns([ethereum.Value.fromUnsignedBigIntArray(tokenWeightArray)]);
}

const OHM_DAI_ETH_BALANCE_OHM = BigDecimal.fromString("221499.733846818");
const OHM_DAI_ETH_BALANCE_DAI = BigDecimal.fromString("1932155.145566782258916959");
const OHM_DAI_ETH_BALANCE_WETH = BigDecimal.fromString("1080.264364629190826870");
const OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY = BigDecimal.fromString("100");
const OHM_DAI_ETH_WEIGHT_OHM = BigDecimal.fromString("0.5");
const OHM_DAI_ETH_WEIGHT_DAI = BigDecimal.fromString("0.25");
const OHM_DAI_ETH_WEIGHT_WETH = BigDecimal.fromString("0.25");
const BALANCER_VAULT = "0xba12222222228d8ba445958a75a0704d566bf2c8".toLowerCase();
const POOL_BALANCER_OHM_DAI_WETH_ID =
  "0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e";
const ERC20_BALANCER_OHM_DAI_WETH = "0xc45D42f801105e861e86658648e3678aD7aa70f9".toLowerCase();
const ERC20_STANDARD_DECIMALS = 18;
const OHM_V2_DECIMALS = 9;
const ERC20_OHM_V2 = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5".toLowerCase();
const ERC20_DAI = "0x6b175474e89094c44da98b954eedeac495271d0f".toLowerCase();
const ERC20_WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase();

function mockBalancerVaultOhmDaiEth(
  totalSupply: BigDecimal = OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY,
  ohmBalance: BigDecimal = OHM_DAI_ETH_BALANCE_OHM,
  daiBalance: BigDecimal = OHM_DAI_ETH_BALANCE_DAI,
  wEthBalance: BigDecimal = OHM_DAI_ETH_BALANCE_WETH,
  ohmWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_OHM,
  daiWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_DAI,
  wEthWeight: BigDecimal = OHM_DAI_ETH_WEIGHT_WETH,
): void {
  mockBalancerVault(
    BALANCER_VAULT,
    POOL_BALANCER_OHM_DAI_WETH_ID,
    ERC20_BALANCER_OHM_DAI_WETH,
    ERC20_STANDARD_DECIMALS,
    totalSupply,
    ERC20_OHM_V2,
    ERC20_DAI,
    ERC20_WETH,
    ohmBalance,
    daiBalance,
    wEthBalance,
    OHM_V2_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ERC20_STANDARD_DECIMALS,
    ohmWeight,
    daiWeight,
    wEthWeight,
  );
}

/**
 * DAI reserves             OHM reserves
 * ------           /       -------
 * DAI weight               OHM weight
 *
 * (1932155.145566782258916959/0.25)/(221499.733846818/0.5) = 17.4461170857
 */
function getMockOhmPrice(): BigDecimal {
  return OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
    OHM_DAI_ETH_BALANCE_OHM.div(OHM_DAI_ETH_WEIGHT_OHM),
  );
}

/**
 * DAI reserves             ETH reserves
 * ------           /       -------
 * DAI weight               ETH weight
 *
 * (1932155.145566782258916959/0.25)/(1080.264364629190826870/0.25) = 1,788.5947262826
 */
function getMockEthPrice(): BigDecimal {
  return OHM_DAI_ETH_BALANCE_DAI.div(OHM_DAI_ETH_WEIGHT_DAI).div(
    OHM_DAI_ETH_BALANCE_WETH.div(OHM_DAI_ETH_WEIGHT_WETH),
  );
}

const BLOCK = BigInt.fromString("1");

describe("getPrice", () => {
  test("OHM-DAI-ETH, OHM lookup", () => {
    const priceLookup: PriceLookup = (
      tokenAddress: string,
      _block: BigInt,
    ): PriceLookupResult | null => {
      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      // Mimics the result of the recursion escape hatch
      return null;
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) return "OHM V2";

      if (addressesEqual(tokenAddress, ERC20_DAI)) return "DAI";

      if (addressesEqual(tokenAddress, ERC20_WETH)) return "ETH";

      return "Unknown";
    };

    mockBalancerVaultOhmDaiEth();

    const handler = new PriceHandlerBalancer(
      [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      contractLookup,
    );

    // Should return the price of OHM
    const priceResult = handler.getPrice(ERC20_OHM_V2, priceLookup, BLOCK);
    assert.stringEquals(
      getMockOhmPrice().toString(),
      priceResult ? priceResult.price.toString() : "",
    );
  });

  test("OHM-DAI-ETH, ETH lookup", () => {
    const priceLookup: PriceLookup = (
      tokenAddress: string,
      _block: BigInt,
      _currentPool: string | null,
    ): PriceLookupResult | null => {
      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      // Mimics the result of the recursion escape hatch
      return null;
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) return "OHM V2";

      if (addressesEqual(tokenAddress, ERC20_DAI)) return "DAI";

      if (addressesEqual(tokenAddress, ERC20_WETH)) return "ETH";

      return "Unknown";
    };

    mockBalancerVaultOhmDaiEth();

    const handler = new PriceHandlerBalancer(
      [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      contractLookup,
    );

    // Should return the price of OHM
    const priceResult = handler.getPrice(ERC20_WETH, priceLookup, BLOCK);
    assert.stringEquals(
      getMockEthPrice().toString(),
      priceResult ? priceResult.price.toString() : "",
    );
  });
});

describe("getTotalValue", () => {
  test("total value is correct", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: getMockOhmPrice(),
        };
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getMockEthPrice(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return "OHM V2";
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return "DAI";
      }

      return "wETH";
    };

    mockBalancerVaultOhmDaiEth();

    const handler = new PriceHandlerBalancer(
      [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      contractLookup,
    );

    // # DAI + # OHM * OHM price + # WETH * WETH price
    const expectedValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_OHM.times(getMockOhmPrice()),
    ).plus(OHM_DAI_ETH_BALANCE_WETH.times(getMockEthPrice()));

    const totalValue = handler.getTotalValue([], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });

  test("total value is correct when excluding token1", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: getMockOhmPrice(),
        };
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getMockEthPrice(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return "OHM V2";
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return "DAI";
      }

      return "wETH";
    };

    mockBalancerVaultOhmDaiEth();

    const handler = new PriceHandlerBalancer(
      [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      contractLookup,
    );

    // # DAI + # WETH * WETH price
    const expectedValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_WETH.times(getMockEthPrice()),
    );

    const totalValue = handler.getTotalValue([ERC20_OHM_V2], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });
});

describe("getUnitPrice", () => {
  test("unit price is correct", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: getMockOhmPrice(),
        };
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getMockEthPrice(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, ERC20_OHM_V2)) {
        return "OHM V2";
      }

      if (addressesEqual(tokenAddress, ERC20_DAI)) {
        return "DAI";
      }

      return "wETH";
    };

    mockBalancerVaultOhmDaiEth();

    const handler = new PriceHandlerBalancer(
      [ERC20_OHM_V2, ERC20_DAI, ERC20_WETH],
      BALANCER_VAULT,
      POOL_BALANCER_OHM_DAI_WETH_ID,
      contractLookup,
    );

    // (# DAI + # OHM * OHM price + # WETH * WETH price)/total supply
    const expectedValue = OHM_DAI_ETH_BALANCE_DAI.plus(
      OHM_DAI_ETH_BALANCE_OHM.times(getMockOhmPrice()),
    )
      .plus(OHM_DAI_ETH_BALANCE_WETH.times(getMockEthPrice()))
      .div(OHM_DAI_ETH_TOKEN_TOTAL_SUPPLY);

    const unitPrice = handler.getUnitPrice(priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), unitPrice ? unitPrice.toString() : "");
  });
});
