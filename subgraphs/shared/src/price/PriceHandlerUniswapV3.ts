import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";

import { UniswapV3Pair } from "../../generated/Price/UniswapV3Pair";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getERC20 } from "../contracts/ERC20";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerUniswapV3";

export class PriceHandlerUniswapV3 implements PriceHandler {
  protected tokens: string[];
  protected poolAddress: string;
  protected contractLookup: ContractNameLookup;

  constructor(tokens: string[], poolAddress: string, contractLookup: ContractNameLookup) {
    this.tokens = tokens;
    this.poolAddress = poolAddress;
    this.contractLookup = contractLookup;
  }

  private getContract(block: BigInt): UniswapV3Pair | null {
    const FUNCTION = `${CLASS}: getContract:`;
    const pair = UniswapV3Pair.bind(Address.fromString(this.poolAddress));

    if (pair === null || pair.try_token0().reverted || pair.try_token1().reverted) {
      log.debug("{} contract ({}) reverted at block {}", [
        FUNCTION,
        this.contractLookup(this.poolAddress),
        block.toString(),
      ]);
      return null;
    }

    return pair;
  }

  getId(): string {
    return this.poolAddress;
  }

  exists(): boolean {
    return this.getContract(BigInt.zero()) !== null;
  }

  matches(tokenAddress: string): boolean {
    return arrayIncludesLoose(this.tokens, tokenAddress);
  }

  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    block: BigInt,
  ): PriceLookupResult | null {
    const FUNCTION = `${CLASS}: lookup:`;

    const pair = UniswapV3Pair.bind(Address.fromString(this.poolAddress));
    if (pair === null || pair.try_token0().reverted || pair.try_token1().reverted) {
      log.debug("{} Cannot determine value as the contract ({}) reverted at block {}", [
        FUNCTION,
        this.contractLookup(this.poolAddress),
        block.toString(),
      ]);
      return null;
    }

    // Determine orientation of the pair
    const token0 = pair.token0();
    const token1 = pair.token1();

    if (
      !addressesEqual(tokenAddress, token0.toHexString()) &&
      !addressesEqual(tokenAddress, token1.toHexString())
    ) {
      throw new Error(
        `${FUNCTION} token ${this.contractLookup(
          tokenAddress,
        )} (${tokenAddress}) does not belong to LP ${this.contractLookup(this.poolAddress)} (${this.poolAddress
        })`,
      );
    }

    // slot0 = "The current price of the pool as a sqrt(token1/token0) Q64.96 value"
    // Source: https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0
    // https://docs.uniswap.org/sdk/guides/fetching-prices
    let priceETH = pair.slot0().value0.times(pair.slot0().value0).toBigDecimal();
    const priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal();
    priceETH = priceETH.div(priceDiv);

    const otherTokenIsToken0 = addressesEqual(tokenAddress, token1.toHexString());

    // Get the number of tokens denominated in ETH/OHM/USD
    const baseTokenNumerator = otherTokenIsToken0
      ? BigDecimal.fromString("1").div(priceETH)
      : priceETH;

    // Multiply by difference in decimals
    const token0Contract = getERC20(token0.toHexString(), block);
    const token1Contract = getERC20(token1.toHexString(), block);

    // If there is a difference between the decimal places of the two tokens, adjust for that
    const decimalDifference: i32 = otherTokenIsToken0
      ? token1Contract.decimals() - token0Contract.decimals()
      : token0Contract.decimals() - token1Contract.decimals();
    const decimalDifferenceAbs: u8 = u8(abs(decimalDifference));
    const decimalDifferencePow: BigDecimal = BigInt.fromI32(10)
      .pow(decimalDifferenceAbs)
      .toBigDecimal();
    const adjustedNumerator = (
      decimalDifference < 0
        ? BigDecimal.fromString("1").div(decimalDifferencePow)
        : decimalDifferencePow
    ).times(baseTokenNumerator);

    const otherTokenPriceResult = priceLookup(
      otherTokenIsToken0 ? token0.toHexString() : token1.toHexString(),
      block,
      this.getId(),
    );
    if (!otherTokenPriceResult) {
      return null;
    }

    const finalUsdRate = adjustedNumerator.times(otherTokenPriceResult.price);

    return {
      price: finalUsdRate,
      liquidity: BigDecimal.zero(), // TODO set liquidity
    };
  }

  getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    block: BigInt,
  ): BigDecimal | null {
    const FUNCTION = `${CLASS}: getTotalValue:`;
    const pair = this.getContract(block);
    if (!pair) {
      return null;
    }

    const token0 = pair.token0().toHexString();
    const token1 = pair.token1().toHexString();

    const token0Contract = getERC20(token0, block);
    const token1Contract = getERC20(token1, block);

    const token0ReservesResult = token0Contract.try_balanceOf(Address.fromString(this.poolAddress));
    const token1ReservesResult = token1Contract.try_balanceOf(Address.fromString(this.poolAddress));
    if (token0ReservesResult.reverted || token1ReservesResult.reverted) {
      return null;
    }

    const token0Reserves = toDecimal(
      token0ReservesResult.value,
      token0Contract.decimals(),
    );
    const token1Reserves = toDecimal(
      token1ReservesResult.value,
      token1Contract.decimals(),
    );

    const token0Rate = priceLookup(token0, block, null);
    if (!token0Rate) {
      log.warning(
        "{} Unable to determine total value as the price of {} ({}) was null at block {}",
        [FUNCTION, this.contractLookup(token0), token0, block.toString()],
      );
      return null;
    }
    const token1Rate = priceLookup(token1, block, null);
    if (!token1Rate) {
      log.warning(
        "{} Unable to determine total value as the price of {} ({}) was null at block {}",
        [FUNCTION, this.contractLookup(token1), token1, block.toString()],
      );
      return null;
    }

    // If the token is in {excludedTokens}, don't include its value
    const token0Value = arrayIncludesLoose(excludedTokens, token0)
      ? BigDecimal.zero()
      : token0Reserves.times(token0Rate.price);
    const token1Value = arrayIncludesLoose(excludedTokens, token1)
      ? BigDecimal.zero()
      : token1Reserves.times(token1Rate.price);

    return token0Value.plus(token1Value);
  }

  getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
    // We are unable to determine the total supply of a UniswapV3 pool, so the unit price = total value
    return this.getTotalValue([], priceLookup, block);
  }

  getBalance(walletAddress: string, block: BigInt): BigDecimal {
    // TODO determine how to get the "balance"/ownership of the pool using the V3 position NFT
    return BigDecimal.zero();
  }

  getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
    throw new Error("Method not implemented.");
  }
}
