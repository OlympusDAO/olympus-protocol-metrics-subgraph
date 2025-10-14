import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly/index";

import { CIRCULATING_SUPPLY_WALLETS, getWalletAddressesForContract } from "../../../arbitrum/src/contracts/Constants";
import { mockZeroWalletBalances } from "../../../ethereum/tests/walletHelper";
import { ContractNameLookup } from "../../src/contracts/ContractLookup";
import { PriceLookup, PriceLookupResult } from "../../src/price/PriceHandler";
import { PriceHandlerUniswapV2 } from "../../src/price/PriceHandlerUniswapV2";
import { toDecimal } from "../../src/utils/Decimals";
import { addressesEqual } from "../../src/utils/StringHelper";
import { CROSS_CHAIN_ARBITRUM } from "../../src/Wallets";
import { mockERC20Balance, mockERC20Balances } from "../ERC20Helper";

const mockUniswapV2Pair = (
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Reserves: BigInt,
  token1Reserves: BigInt,
  totalSupply: BigInt,
  pairAddress: string,
  pairDecimals: i32,
  block: BigInt,
): void => {
  const pair = Address.fromString(pairAddress);
  createMockedFunction(pair, "getReserves", "getReserves():(uint112,uint112,uint32)").returns([
    ethereum.Value.fromUnsignedBigInt(token0Reserves),
    ethereum.Value.fromUnsignedBigInt(token1Reserves),
    ethereum.Value.fromUnsignedBigInt(block),
  ]);
  // Decimals
  createMockedFunction(pair, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromI32(pairDecimals),
  ]);
  // Total supply
  createMockedFunction(pair, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(totalSupply),
  ]);

  // Token addresses
  createMockedFunction(pair, "token0", "token0():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token0Address)),
  ]);
  createMockedFunction(pair, "token1", "token1():(address)").returns([
    ethereum.Value.fromAddress(Address.fromString(token1Address)),
  ]);

  // Token decimals
  createMockedFunction(Address.fromString(token0Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token0Decimals)],
  );
  createMockedFunction(Address.fromString(token1Address), "decimals", "decimals():(uint8)").returns(
    [ethereum.Value.fromI32(token1Decimals)],
  );
};

const TOKEN0 = "0x6b175474e89094c44da98b954eedeac495271d0f"; // DAI
const TOKEN1 = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5"; // OHM V2
const TOKEN0_DECIMALS = 18;
const TOKEN1_DECIMALS = 9;
const TOKEN0_RESERVES = BigInt.fromString("18867842715859452534935831");
const TOKEN0_RESERVES_DECIMAL = toDecimal(TOKEN0_RESERVES, TOKEN0_DECIMALS);
const TOKEN1_RESERVES = BigInt.fromString("994866147276819");
const TOKEN_SUPPLY = BigInt.fromString("133005392717808439119");
const TOKEN_SUPPLY_DECIMAL = toDecimal(TOKEN_SUPPLY, 18);
const PAIR_ADDRESS = "0x055475920a8c93cffb64d039a8205f7acc7722d3";
const BLOCK = BigInt.fromString("15000000");

const mockOhmDaiPair = (): void => {
  mockUniswapV2Pair(
    TOKEN0,
    TOKEN1,
    TOKEN0_DECIMALS,
    TOKEN1_DECIMALS,
    TOKEN0_RESERVES,
    TOKEN1_RESERVES,
    TOKEN_SUPPLY,
    PAIR_ADDRESS,
    18,
    BLOCK,
  );
};

const mockOhmDaiPairFlipped = (): void => {
  mockUniswapV2Pair(
    TOKEN1,
    TOKEN0,
    TOKEN1_DECIMALS,
    TOKEN0_DECIMALS,
    TOKEN1_RESERVES,
    TOKEN0_RESERVES,
    TOKEN_SUPPLY,
    PAIR_ADDRESS,
    18,
    BLOCK,
  );
};

/**
 * 18.9652073
 *
 * @returns
 */
export const getOhmUsdRate = (): BigDecimal => {
  return toDecimal(TOKEN0_RESERVES, TOKEN0_DECIMALS).div(
    toDecimal(TOKEN1_RESERVES, TOKEN1_DECIMALS),
  );
};

describe("getPrice", () => {
  test("when secondary token = $1", () => {
    const stablecoinPriceLookup: PriceLookup = (
      _tokenAddress: string,
      _block: BigInt,
    ): PriceLookupResult => {
      return {
        liquidity: BigDecimal.fromString("1"),
        price: BigDecimal.fromString("1"),
      };
    };

    const contractLookup: ContractNameLookup = (_tokenAddress: string): string => "OHM V2";

    mockOhmDaiPair();

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    // Should return the price of OHM
    const priceResult = handler.getPrice(TOKEN1, stablecoinPriceLookup, BLOCK);
    assert.stringEquals(
      getOhmUsdRate().toString(),
      priceResult ? priceResult.price.toString() : "",
    );
  });

  test("orientation flipped", () => {
    const stablecoinPriceLookup: PriceLookup = (
      _tokenAddress: string,
      _block: BigInt,
    ): PriceLookupResult => {
      return {
        price: BigDecimal.fromString("1"),
        liquidity: BigDecimal.fromString("1"),
      };
    };

    const contractLookup: ContractNameLookup = (_tokenAddress: string): string => "OHM V2";

    mockOhmDaiPairFlipped();

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    // Should return the price of OHM
    const priceResult = handler.getPrice(TOKEN1, stablecoinPriceLookup, BLOCK);
    assert.stringEquals(
      getOhmUsdRate().toString(),
      priceResult ? priceResult.price.toString() : "",
    );
  });
});

describe("getTotalValue", () => {
  test("no exclusions", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getOhmUsdRate(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return "DAI";
      }

      return "OHM V2";
    };

    mockOhmDaiPair();

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    // # DAI + # OHM * OHM price
    const expectedValue = toDecimal(TOKEN0_RESERVES, TOKEN0_DECIMALS).plus(
      toDecimal(TOKEN1_RESERVES, TOKEN1_DECIMALS).times(getOhmUsdRate()),
    );

    const totalValue = handler.getTotalValue([], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });

  test("exclude token1", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getOhmUsdRate(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return "DAI";
      }

      return "OHM V2";
    };

    mockOhmDaiPair();

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    // # DAI
    const expectedValue = toDecimal(TOKEN0_RESERVES, TOKEN0_DECIMALS);

    const totalValue = handler.getTotalValue([TOKEN1], priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), totalValue ? totalValue.toString() : "");
  });
});

describe("getUnitPrice", () => {
  test("no exclusions", () => {
    const priceLookup: PriceLookup = (tokenAddress: string, _block: BigInt): PriceLookupResult => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return {
          liquidity: BigDecimal.fromString("1"),
          price: BigDecimal.fromString("1"),
        };
      }

      return {
        liquidity: BigDecimal.fromString("1"),
        price: getOhmUsdRate(),
      };
    };

    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return "DAI";
      }

      return "OHM V2";
    };

    mockOhmDaiPair();

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    // (# DAI + # OHM * OHM price) / total supply
    const expectedValue = toDecimal(TOKEN0_RESERVES, TOKEN0_DECIMALS)
      .plus(toDecimal(TOKEN1_RESERVES, TOKEN1_DECIMALS).times(getOhmUsdRate()))
      .div(toDecimal(TOKEN_SUPPLY, 18));

    const unitPrice = handler.getUnitPrice(priceLookup, BLOCK);
    assert.stringEquals(expectedValue.toString(), unitPrice ? unitPrice.toString() : "");
  });
});

describe("getUnderlyingTokenBalance", () => {
  beforeEach(() => {
    log.info("beforeEach: Clearing store", []);
    clearStore();

    mockZeroWalletBalances(PAIR_ADDRESS, getWalletAddressesForContract(PAIR_ADDRESS));
  });

  test("calculates the underlying token balance accurately", () => {
    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return "DAI";
      }

      return "OHM V2";
    };

    mockOhmDaiPair();
    const lpBalance = BigDecimal.fromString("10");
    mockERC20Balances(CIRCULATING_SUPPLY_WALLETS, PAIR_ADDRESS, BigDecimal.zero());
    mockERC20Balance(CROSS_CHAIN_ARBITRUM, PAIR_ADDRESS, lpBalance);

    const expectedBalance = lpBalance.times(TOKEN0_RESERVES_DECIMAL).div(TOKEN_SUPPLY_DECIMAL);

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    const balance = handler.getUnderlyingTokenBalance(CROSS_CHAIN_ARBITRUM, TOKEN0, BLOCK);
    assert.stringEquals(expectedBalance.toString(), balance.toString());
  });

  test("returns 0 if the contract reverts", () => {
    const contractLookup: ContractNameLookup = (tokenAddress: string): string => {
      if (addressesEqual(tokenAddress, TOKEN0)) {
        return "DAI";
      }

      return "OHM V2";
    };

    const handler = new PriceHandlerUniswapV2([TOKEN0, TOKEN1], PAIR_ADDRESS, contractLookup);

    const balance = handler.getUnderlyingTokenBalance(CROSS_CHAIN_ARBITRUM, TOKEN0, BLOCK);
    assert.stringEquals("0", balance.toString());
  });
});
