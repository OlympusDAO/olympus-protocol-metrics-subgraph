import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { UniswapV3Pair } from "../../generated/Price/UniswapV3Pair";
import { UniswapV3PositionManager } from "../../generated/Price/UniswapV3PositionManager";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getDecimals, getERC20 } from "../contracts/ERC20";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerUniswapV3";
const Q96 = BigInt.fromI32(2).pow(96);

function min(a: BigInt, b: BigInt): BigInt {
  return a.lt(b) ? a : b;
}

function max(a: BigInt, b: BigInt): BigInt {
  return a.gt(b) ? a : b;
}

export class PriceHandlerUniswapV3 implements PriceHandler {
  protected positionManager: string;
  protected tokens: string[];
  protected poolAddress: string;
  protected contractLookup: ContractNameLookup;

  constructor(tokens: string[], poolAddress: string, positionManager: string, contractLookup: ContractNameLookup) {
    this.tokens = tokens;
    this.poolAddress = poolAddress;
    this.positionManager = positionManager;
    this.contractLookup = contractLookup;
  }

  public getTokens(): string[] {
    return this.tokens;
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

  private getPair(): UniswapV3Pair | null {
    const FUNCTION = `${CLASS}: getPair:`;

    const pair = UniswapV3Pair.bind(Address.fromString(this.poolAddress));
    if (pair === null || pair.try_token0().reverted || pair.try_token1().reverted) {
      return null;
    }

    return pair;
  }

  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    block: BigInt,
  ): PriceLookupResult | null {
    const FUNCTION = `${CLASS}: lookup:`;

    const pair = this.getPair();
    if (pair === null) {
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

    // Calculate liquidity depth as otherTokenPrice * otherTokenBalance
    const otherToken = otherTokenIsToken0 ? token0Contract : token1Contract;
    const otherTokenBalance = toDecimal(otherToken.balanceOf(Address.fromString(this.poolAddress)), otherToken.decimals());
    const liquidityDepth = otherTokenPriceResult.price.times(otherTokenBalance);

    log.debug("{} Liquidity depth for {} ({}) is {} (otherTokenPrice: {}, otherTokenBalance: {})", [
      FUNCTION,
      this.contractLookup(tokenAddress),
      tokenAddress,
      liquidityDepth.toString(),
      otherTokenPriceResult.price.toString(),
      otherTokenBalance.toString(),
    ]);

    return {
      price: finalUsdRate,
      liquidity: liquidityDepth,
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

  private getToken0Amount(liquidity: BigInt, sqrtPrice: BigInt, sqrtRatioA: BigInt, sqrtRatioB: BigInt): BigInt {
    const newSqrtPrice = max(min(sqrtPrice, sqrtRatioB), sqrtRatioA);

    return liquidity.times(sqrtRatioB.minus(newSqrtPrice)).div(newSqrtPrice.times(sqrtRatioB));
  }

  private getToken1Amount(liquidity: BigInt, sqrtPrice: BigInt, sqrtRatioA: BigInt, sqrtRatioB: BigInt): BigInt {
    const newSqrtPrice = max(min(sqrtPrice, sqrtRatioB), sqrtRatioA);

    return liquidity.times(newSqrtPrice.minus(sqrtRatioA));
  }

  private getSqrtRatioAtTick(tick: number): BigInt {
    const sqrtRatio = BigInt.fromU64(u64(sqrt(1.0001 ** tick)));
    log.debug("getSqrtRatioAtTick: sqrtRatio: {}", [sqrtRatio.toString()]);

    return sqrtRatio;
  }

  private getPairBalances(positionId: BigInt, block: BigInt): BigDecimal[] | null {
    const FUNCTION = `${CLASS}: getPairBalances:`;
    const pair = this.getPair();
    if (!pair) {
      return null;
    }

    const pairToken0 = pair.token0();
    const pairToken1 = pair.token1();
    const pairSlot0 = pair.slot0();
    const sqrtPriceX96 = pairSlot0.getSqrtPriceX96();
    log.debug("getPairBalances: positionId: {}, sqrtPriceX96: {}", [positionId.toString(), sqrtPriceX96.toString()]);
    const currentTick = pairSlot0.getTick();
    log.debug("getPairBalances: positionId: {}, currentTick: {}", [positionId.toString(), currentTick.toString()]);

    const positionManager = UniswapV3PositionManager.bind(Address.fromString(this.positionManager));
    const position = positionManager.positions(positionId);
    const token0 = position.getToken0();
    const token1 = position.getToken1();

    // Check that the position is for the pair we are looking for
    if (!token0.equals(pairToken0) || !token1.equals(pairToken1)) {
      log.debug("getPairBalances: Skipping position {} that does not match tokens in pair address {}", [positionId.toString(), this.poolAddress])
      return null;
    }

    // The tick calculations are based on the following: https://ethereum.stackexchange.com/a/140264

    // Ticks
    const tickLower = position.getTickLower();
    log.debug("getPairBalances: positionId: {}, tickLower: {}", [positionId.toString(), tickLower.toString()]);
    const sqrtRatioA: BigDecimal = BigDecimal.fromString(Math.sqrt(1.0001 ** tickLower).toString());
    log.debug("getPairBalances: positionId: {}, sqrtRatioA: {}", [positionId.toString(), sqrtRatioA.toString()]);

    const tickUpper = position.getTickUpper();
    log.debug("getPairBalances: positionId: {}, tickUpper: {}", [positionId.toString(), tickUpper.toString()]);
    const sqrtRatioB: BigDecimal = BigDecimal.fromString(Math.sqrt(1.0001 ** tickUpper).toString());
    log.debug("getPairBalances: positionId: {}, sqrtRatioB: {}", [positionId.toString(), sqrtRatioB.toString()]);

    // If a position has no liquidity, we don't want to record details
    const liquidity: BigInt = position.getLiquidity();
    if (liquidity.equals(BigInt.zero())) {
      log.debug("getPairBalances: Skipping position id {} with zero liquidity", [positionId.toString()]);
      return null;
    }
    log.debug("getPairBalances: positionId: {}, liquidity: {}", [positionId.toString(), liquidity.toString()]);

    const sqrtPrice: BigDecimal = sqrtPriceX96.toBigDecimal().div(Q96.toBigDecimal());
    log.debug("getPairBalances: positionId: {}, sqrtPrice: {}", [positionId.toString(), sqrtPrice.toString()]);

    let token0Amount: BigDecimal = BigDecimal.zero();
    let token1Amount: BigDecimal = BigDecimal.zero();

    if (currentTick <= tickLower) {
      token0Amount = liquidity.toBigDecimal().times(((sqrtRatioB.minus(sqrtRatioA)).div(sqrtRatioA.times(sqrtRatioB))));
    }
    else if (currentTick >= tickUpper) {
      token1Amount = liquidity.toBigDecimal().times((sqrtRatioB.minus(sqrtRatioA)));
    }
    else if (currentTick > tickLower && currentTick < tickUpper) {
      token0Amount = liquidity.toBigDecimal().times(((sqrtRatioB.minus(sqrtPrice)).div(sqrtPrice.times(sqrtRatioB))));
      token1Amount = liquidity.toBigDecimal().times(((sqrtPrice.minus(sqrtRatioA))));
    }

    const token0Decimals: i32 = i32(getDecimals(token0.toHexString(), block));
    const token1Decimals: i32 = i32(getDecimals(token1.toHexString(), block));

    const token0Balance = token0Amount.div(BigInt.fromI32(10).pow(u8(token0Decimals)).toBigDecimal());
    const token1Balance = token1Amount.div(BigInt.fromI32(10).pow(u8(token1Decimals)).toBigDecimal());
    log.debug("getPairBalances: positionId: {}, token0Balance: {}, token1Balance: {}", [positionId.toString(), token0Balance.toString(), token1Balance.toString()]);

    return [token0Balance, token1Balance];
  }

  getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
    const FUNCTION = `${CLASS}: getUnderlyingTokenBalance:`;
    const pair = this.getPair();
    if (!pair) {
      return BigDecimal.zero();
    }

    // Check that tokenAddress is either token0 or token1
    if (!addressesEqual(tokenAddress, pair.token0().toHexString()) && !addressesEqual(tokenAddress, pair.token1().toHexString())) {
      throw new Error(`${FUNCTION} token ${this.contractLookup(tokenAddress)} (${tokenAddress}) does not belong to LP ${this.contractLookup(this.poolAddress)} (${this.poolAddress})`);
    }

    const positionManager = UniswapV3PositionManager.bind(Address.fromString(this.positionManager));
    const positionCountResult = positionManager.try_balanceOf(Address.fromString(walletAddress));
    if (positionCountResult.reverted) {
      return BigDecimal.zero();
    }

    // Figure out which token to return
    const tokenIndex = addressesEqual(tokenAddress, pair.token0().toHexString()) ? 0 : 1;

    const positionCount = positionCountResult.value;
    log.debug("{} wallet {} ({}) position count: {}", [FUNCTION, this.contractLookup(walletAddress), walletAddress, positionCount.toString()]);

    let tokenBalance = BigDecimal.zero();

    for (let i: u32 = 0; i < positionCount.toU32(); i++) {
      const positionId = positionManager.tokenOfOwnerByIndex(Address.fromString(walletAddress), BigInt.fromU32(i));
      log.debug("{} positionId: {}", [FUNCTION, positionId.toString()]);

      const balances = this.getPairBalances(positionId, block);
      if (!balances) {
        continue;
      }

      if (tokenIndex === 0) {
        tokenBalance = tokenBalance.plus(balances[0]);
      } else {
        tokenBalance = tokenBalance.plus(balances[1]);
      }
    }

    return tokenBalance;
  }
}
