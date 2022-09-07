import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { getContractName } from "../../../ethereum/src/utils/Constants";
import { BalancerPoolToken } from "../../generated/Price/BalancerPoolToken";
import { BalancerVault } from "../../generated/Price/BalancerVault";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getDecimals, getERC20 } from "../contracts/ERC20";
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

  private getVault(block: BigInt): BalancerVault | null {
    const FUNCTION = `${CLASS}: getVault:`;
    const vault = BalancerVault.bind(Address.fromString(this.vaultAddress));
    if (vault.try_getPoolTokens(Bytes.fromHexString(this.poolId)).reverted) {
      log.warning(
        FUNCTION +
          " Balancer vault contract reverted calling getPoolTokens with pool {} at block {}. Skipping",
        [getContractName(this.poolId), block.toString()],
      );
      return null;
    }

    return vault;
  }

  private getPoolToken(block: BigInt): BalancerPoolToken | null {
    const FUNCTION = `${CLASS}: getPoolToken:`;
    const vault = this.getVault(block);
    if (!vault) {
      return null;
    }

    const poolInfo = vault.getPool(Bytes.fromHexString(this.poolId));
    const poolToken = poolInfo.getValue0().toHexString();

    return BalancerPoolToken.bind(Address.fromString(poolToken));
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
    const vault = this.getVault(block);
    if (!vault) {
      return null;
    }

    const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(this.poolId));
    const addresses: Array<Address> = poolTokenWrapper.getTokens();
    const balances: Array<BigInt> = poolTokenWrapper.getBalances();

    // Get token weights
    const poolToken = this.getPoolToken(block);
    if (poolToken === null) {
      log.warning(
        FUNCTION + " Balancer pool token contract reverted with pool {} at block {}. Skipping",
        [getContractName(this.poolId), block.toString()],
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

  getTotalValue(
    excludedTokens: string[],
    priceLookup: PriceLookup,
    block: BigInt,
  ): BigDecimal | null {
    const FUNCTION = `${CLASS}: getTotalValue:`;
    const vault = this.getVault(block);
    if (!vault) {
      log.warning(
        "{} Unable to determine total value as the vault was not accessible at block {}",
        [FUNCTION, block.toString()],
      );
      return null;
    }

    const poolTokenWrapper = vault.getPoolTokens(Bytes.fromHexString(this.poolId));
    const addresses: Array<Address> = poolTokenWrapper.getTokens();
    const balances: Array<BigInt> = poolTokenWrapper.getBalances();

    // Total value is sum of (rate * balance)
    let totalValue = BigDecimal.zero();

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i].toHexString();
      const currentContract = getERC20(currentAddress, block);

      if (arrayIncludesLoose(excludedTokens, currentAddress)) {
        log.debug("{} Skipping {} as it is in the excluded list", [
          FUNCTION,
          this.contractLookup(currentAddress),
        ]);
        continue;
      }

      // Add to the value: rate * balance
      const currentBalanceDecimal = toDecimal(balances[i], currentContract.decimals());
      const rate = priceLookup(currentAddress, block, null);
      if (!rate) {
        return null;
      }

      const value = currentBalanceDecimal.times(rate.price);
      totalValue = totalValue.plus(value);
    }

    return totalValue;
  }

  getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
    const FUNCTION = `${CLASS}: getUnitRate:`;
    const vault = this.getVault(block);
    if (!vault) {
      log.warning("{} Unable to determine unit rate as the vault was not accessible at block {}", [
        FUNCTION,
        block.toString(),
      ]);
      return null;
    }

    const poolToken = this.getPoolToken(block);
    if (!poolToken) {
      log.warning(
        "{} Unable to determine unit rate as the pool token was not accessible at block {}",
        [FUNCTION, block.toString()],
      );
      return null;
    }

    const totalSupply = toDecimal(poolToken.totalSupply(), poolToken.decimals());
    const totalValue = this.getTotalValue([], priceLookup, block);
    if (!totalValue) {
      log.warning("{} Unable to determine unit rate as total value was null at block {}", [
        FUNCTION,
        block.toString(),
      ]);
      return null;
    }

    return totalValue.div(totalSupply);
  }
}
