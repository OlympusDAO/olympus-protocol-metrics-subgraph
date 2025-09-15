import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly/index";

import { toBigInt, toDecimal } from "../../shared/src/utils/Decimals";
import { mockBalancerVault } from "../../shared/tests/price/PriceHandlerBalancer.test";
import { mockRateUniswapV3 } from "../../shared/tests/price/PriceHandlerUniswapV3.test";
import { BEX_VAULT, ERC20_HONEY, ERC20_IBERA, ERC20_IBGT, ERC20_LBGT, ERC20_WBERA, LP_BEX_LBGT_WBERA, LP_BEX_LBGT_WBERA_ID, LP_KODIAK_IBERA_WBERA, LP_KODIAK_IBGT_WBERA, LP_UNISWAP_V3_WBERA_HONEY } from "../src/contracts/Constants";
import { KODIAK_QUOTER } from "../src/contracts/LiquidityConstants";
import { getPriceFeed } from "../src/price/PriceChainlink";
import { getPrice } from "../src/price/PriceLookup";

// WBERA-HONEY pool constants
const WBERA_HONEY_SQRT_PRICE_X96 = BigInt.fromString("120931209850327059448552868543");
const WBERA_HONEY_TICK = 8458;
const WBERA_HONEY_TOKEN0_BALANCE = BigInt.fromString("1492726938963410000000000");
const WBERA_HONEY_TOKEN1_BALANCE = BigInt.fromString("2742851294419520000000000");
const WBERA_HONEY_FEE = 3000;
const WBERA_HONEY_AMOUNT_OUT = BigInt.fromString("2318690143565703750");

// IBERA-WBERA pool constants
const IBERA_WBERA_SQRT_PRICE_X96 = BigInt.fromString("78338641233207244437779001715");
const IBERA_WBERA_TICK = -226;
const IBERA_WBERA_TOKEN0_BALANCE = BigInt.fromString("402257354116930000000000");
const IBERA_WBERA_TOKEN1_BALANCE = BigInt.fromString("287178924819100000000000");
const IBERA_WBERA_FEE = 500;
const IBERA_WBERA_AMOUNT_OUT = BigInt.fromString("1022795101522250064");

// IBGT-WBERA pool constants
const IBGT_WBERA_SQRT_PRICE_X96 = BigInt.fromString("79228162514264337593543950336"); // placeholder
const IBGT_WBERA_TICK = 0; // placeholder
const IBGT_WBERA_TOKEN0_BALANCE = BigInt.fromString("1000000000000000000000"); // placeholder
const IBGT_WBERA_TOKEN1_BALANCE = BigInt.fromString("1000000000000000000000"); // placeholder
const IBGT_WBERA_FEE = 3000;
const IBGT_WBERA_AMOUNT_OUT = BigInt.fromString("1000000000000000000"); // placeholder 1:1 rate

// LBGT-WBERA Balancer pool constants
const LBGT_WBERA_BALANCE_LBGT = BigDecimal.fromString("1000000"); // placeholder
const LBGT_WBERA_BALANCE_WBERA = BigDecimal.fromString("2000000"); // placeholder - 2:1 ratio (WBERA more valuable)
const LBGT_WBERA_TOKEN_TOTAL_SUPPLY = BigDecimal.fromString("100000");
const LBGT_WBERA_WEIGHT_LBGT = BigDecimal.fromString("0.5");
const LBGT_WBERA_WEIGHT_WBERA = BigDecimal.fromString("0.5");

const mockRateUniswapV3Quoter = (
  pairAddress: string,
  sqrtPriceX96: BigInt,
  tick: i32,
  token0Address: string,
  token1Address: string,
  token0Decimals: i32,
  token1Decimals: i32,
  token0Balance: BigInt,
  token1Balance: BigInt,
  fee: i32,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigInt,
): void => {
  mockRateUniswapV3(
    pairAddress,
    sqrtPriceX96,
    tick,
    token0Address,
    token1Address,
    token0Decimals,
    token1Decimals,
    token0Balance,
    token1Balance,
  );

  // Pool Fee
  createMockedFunction(
    Address.fromString(pairAddress),
    "fee",
    "fee():(uint24)"
  ).returns([
    ethereum.Value.fromI32(fee)
  ]);

  const quoteExactInputSingleArray: Array<ethereum.Value> = [
    ethereum.Value.fromAddress(Address.fromString(tokenIn)),
    ethereum.Value.fromAddress(Address.fromString(tokenOut)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString("10").pow(18)), // TODO adjust for decimals
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(fee)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)),
  ];
  const quoteExactInputSingleTuple = changetype<ethereum.Tuple>(quoteExactInputSingleArray);

  createMockedFunction(
    Address.fromString(KODIAK_QUOTER),
    "quoteExactInputSingle",
    "quoteExactInputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
  ).withArgs([ethereum.Value.fromTuple(quoteExactInputSingleTuple)]).returns(
    [
      ethereum.Value.fromUnsignedBigInt(amountOut), ethereum.Value.fromUnsignedBigInt(BigInt.fromString("0")), ethereum.Value.fromI32(0), ethereum.Value.fromUnsignedBigInt(BigInt.fromString("0"))
    ]
  );

  // Mock the inverse direction (tokenOut -> tokenIn)
  const inverseAmountIn = BigInt.fromString("10").pow(18); // 1 unit of tokenOut
  const inverseAmountOut = BigInt.fromString("10").pow(18).times(inverseAmountIn).div(amountOut); // calculate inverse rate

  const inverseQuoteExactInputSingleArray: Array<ethereum.Value> = [
    ethereum.Value.fromAddress(Address.fromString(tokenOut)),
    ethereum.Value.fromAddress(Address.fromString(tokenIn)),
    ethereum.Value.fromUnsignedBigInt(inverseAmountIn),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(fee)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)),
  ];
  const inverseQuoteExactInputSingleTuple = changetype<ethereum.Tuple>(inverseQuoteExactInputSingleArray);

  createMockedFunction(
    Address.fromString(KODIAK_QUOTER),
    "quoteExactInputSingle",
    "quoteExactInputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
  ).withArgs([ethereum.Value.fromTuple(inverseQuoteExactInputSingleTuple)]).returns(
    [
      ethereum.Value.fromUnsignedBigInt(inverseAmountOut), ethereum.Value.fromUnsignedBigInt(BigInt.fromString("0")), ethereum.Value.fromI32(0), ethereum.Value.fromUnsignedBigInt(BigInt.fromString("0"))
    ]
  );
}

function mockPriceFeed(token: string, price: BigDecimal): void {
    const priceFeed = getPriceFeed(token);
    if (priceFeed == null) {
        throw new Error(`No price feed for token ${token}`);
    }

    const PRICE_FEED_DECIMALS = 8;
    const priceFeedAddress = Address.fromString(priceFeed!);

    createMockedFunction(priceFeedAddress, "decimals", "decimals():(uint8)").returns([
        ethereum.Value.fromI32(PRICE_FEED_DECIMALS),
    ]);

    log.debug("Mocking price feed value {} for token {}", [price.toString(), token]);
    createMockedFunction(priceFeedAddress, "latestAnswer", "latestAnswer():(int256)").returns([
        ethereum.Value.fromSignedBigInt(toBigInt(price, PRICE_FEED_DECIMALS)),
    ]);
}

describe("priceLookup", () => {
  beforeEach(() => {
    // Mock the HONEY Chainlink price
    mockPriceFeed(ERC20_HONEY, BigDecimal.fromString("1"));

    // Mock WBERA-HONEY pool
    mockRateUniswapV3Quoter(
      LP_UNISWAP_V3_WBERA_HONEY,
      WBERA_HONEY_SQRT_PRICE_X96,
      WBERA_HONEY_TICK,
      ERC20_WBERA,
      ERC20_HONEY,
      18,
      18,
      WBERA_HONEY_TOKEN0_BALANCE,
      WBERA_HONEY_TOKEN1_BALANCE,
      WBERA_HONEY_FEE,
      ERC20_WBERA,
      ERC20_HONEY,
      WBERA_HONEY_AMOUNT_OUT,
    );

    // Mock IBERA-WBERA pool
    mockRateUniswapV3Quoter(
      LP_KODIAK_IBERA_WBERA,
      IBERA_WBERA_SQRT_PRICE_X96,
      IBERA_WBERA_TICK,
      ERC20_WBERA,
      ERC20_IBERA,
      18,
      18,
      IBERA_WBERA_TOKEN0_BALANCE,
      IBERA_WBERA_TOKEN1_BALANCE,
      IBERA_WBERA_FEE,
      ERC20_IBERA,
      ERC20_WBERA,
      IBERA_WBERA_AMOUNT_OUT,
    );

    // Mock IBGT-WBERA pool
    mockRateUniswapV3Quoter(
      LP_KODIAK_IBGT_WBERA,
      IBGT_WBERA_SQRT_PRICE_X96,
      IBGT_WBERA_TICK,
      ERC20_IBGT,
      ERC20_WBERA,
      18,
      18,
      IBGT_WBERA_TOKEN0_BALANCE,
      IBGT_WBERA_TOKEN1_BALANCE,
      IBGT_WBERA_FEE,
      ERC20_IBGT,
      ERC20_WBERA,
      IBGT_WBERA_AMOUNT_OUT,
    );

    // Mock LBGT-WBERA Balancer pool
    mockBalancerVault(
      BEX_VAULT,
      LP_BEX_LBGT_WBERA_ID,
      LP_BEX_LBGT_WBERA,
      18, // pool token decimals
      LBGT_WBERA_TOKEN_TOTAL_SUPPLY,
      ERC20_LBGT,
      ERC20_WBERA,
      null, // no third token
      LBGT_WBERA_BALANCE_LBGT,
      LBGT_WBERA_BALANCE_WBERA,
      null, // no third token balance
      18, // LBGT decimals
      18, // WBERA decimals
      18, // unused third token decimals
      LBGT_WBERA_WEIGHT_LBGT,
      LBGT_WBERA_WEIGHT_WBERA,
      null, // no third token weight
    );
  });

  test("resolves WBERA price", () => {
    const expectedPrice = toDecimal(WBERA_HONEY_AMOUNT_OUT, 18).toString();

    const price = getPrice(ERC20_WBERA, BigInt.fromString("1"));
    assert.stringEquals(price.toString(), expectedPrice);
  });

  test("resolves IBERA price", () => {
    const expectedPrice = "2.37154492078692454299068672164254";

    const price = getPrice(ERC20_IBERA, BigInt.fromString("1"));
    assert.stringEquals(price.toString(), expectedPrice);
  });
});
