import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { BalancerPoolToken } from "../../generated/Price/BalancerPoolToken";
import { BalancerVault } from "../../generated/Price/BalancerVault";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getDecimals } from "../contracts/ERC20";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerBalancer";

export class PriceHandlerBalancer implements PriceHandler {
  protected tokens: string[];
  protected vaultAddress: string;
  protected poolId: string;
  protected contractLookup: ContractNameLookup;

  constructor(
    tokens: string[],
    vaultAddress: string,
    poolId: string,
    contractLookup: ContractNameLookup,
  ) {
    this.tokens = tokens;
    this.vaultAddress = vaultAddress;
    this.poolId = poolId;
    this.contractLookup = contractLookup;
  }

  getId(): string {
    return this.poolId;
  }

  matches(tokenAddress: string): boolean {
    return arrayIncludesLoose(this.tokens, tokenAddress);
  }

  getPrice(
    tokenAddress: string,
    priceLookup: PriceLookup,
    block: BigInt,
  ): PriceLookupResult | null {
    const FUNCTION = `${CLASS}: getPrice:`;
    const vault = BalancerVault.bind(Address.fromString(this.vaultAddress));
    // Get token balances
    if (vault.try_getPoolTokens(Bytes.fromHexString(this.poolId)).reverted) {
      log.warning(
        FUNCTION +
          " Balancer vault contract reverted calling getPoolTokens with pool id {} at block {}. Skipping",
        [this.poolId, block.toString()],
      );
      return null;
    }
    const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(this.poolId));
    const addresses: Array<Address> = poolTokenWrapper.getTokens();
    const balances: Array<BigInt> = poolTokenWrapper.getBalances();

    // Get token weights
    const poolInfo = vault.getPool(Bytes.fromHexString(this.poolId));
    const poolTokenAddress = poolInfo.getValue0().toHexString();
    const poolToken = BalancerPoolToken.bind(Address.fromString(poolTokenAddress));
    if (poolToken === null) {
      log.warning(
        FUNCTION + " Balancer pool token contract reverted with pool id {} at block {}. Skipping",
        [this.poolId, block.toString()],
      );
      return null;
    }

    const tokenWeights = poolToken.getNormalizedWeights();
    // Get pair orientation
    const token0 = addresses[0];
    const token1 = addresses[1];
    const otherTokenIsToken0 = addressesEqual(tokenAddress, token1.toHexString());

    const token0Decimals = getDecimals(token0.toHexString(), block);
    const token1Decimals = getDecimals(token1.toHexString(), block);

    const token0Reserves = toDecimal(balances[0], token0Decimals);
    const token1Reserves = toDecimal(balances[1], token1Decimals);
    // If the reserves are 0, then we can't find out the price
    if (token0Reserves.equals(BigDecimal.zero()) || token1Reserves.equals(BigDecimal.zero())) {
      log.debug(FUNCTION + " reserves are 0. Skipping", []);
      return null;
    }

    const token0Weight = toDecimal(tokenWeights[0], poolToken.decimals());
    const token1Weight = toDecimal(tokenWeights[1], poolToken.decimals());

    const otherTokenPriceResult = priceLookup(
      otherTokenIsToken0 ? token0.toHexString() : token1.toHexString(),
      block,
      this.getId(),
    );
    if (!otherTokenPriceResult) {
      return null;
    }

    const numerator = otherTokenIsToken0
      ? token0Reserves.div(token0Weight)
      : token1Reserves.div(token1Weight);
    const denominator = otherTokenIsToken0
      ? token1Reserves.div(token1Weight)
      : token0Reserves.div(token0Weight);
    const rate = numerator.div(denominator).times(otherTokenPriceResult.price);
    return {
      liquidity: BigDecimal.zero(), // TODO set liquidity
      price: rate,
    };
  }
}
