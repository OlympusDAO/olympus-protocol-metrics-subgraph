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

class TokenInfo {
  address: string;
  reserves: BigDecimal;
  weight: BigDecimal;
  price: BigDecimal;
}

function createTokenInfo(): TokenInfo {
  return {
    address: "",
    reserves: BigDecimal.zero(),
    weight: BigDecimal.zero(),
    price: BigDecimal.zero(),
  };
}

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

    log.debug(FUNCTION + " Doing price lookup for token {} ({}) in Balancer pool {} ({})", [
      this.contractLookup(tokenAddress),
      tokenAddress,
      this.contractLookup(this.poolId),
      this.poolId,
    ]);
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

    // Iterate over all tokens
    const lookupTokenInfo = createTokenInfo();
    const secondaryTokenInfo = createTokenInfo();
    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i].toHexString();

      // Exit if we have found both
      if (lookupTokenInfo.address.length > 0 && secondaryTokenInfo.address.length > 0) {
        break;
      }

      // Get details of the lookup token
      if (addressesEqual(currentAddress, tokenAddress)) {
        const decimals = getDecimals(currentAddress, block);
        const reserves = toDecimal(balances[i], decimals);
        const weight = toDecimal(tokenWeights[i], poolToken.decimals());

        lookupTokenInfo.reserves = reserves;
        lookupTokenInfo.weight = weight;
        lookupTokenInfo.address = currentAddress;

        log.debug("{} found lookup token: {} ({})", [
          FUNCTION,
          this.contractLookup(currentAddress),
          currentAddress,
        ]);
        continue;
      }

      // See if we can find the price of the current token using another method
      const price = priceLookup(currentAddress, block, this.getId());
      if (!price) {
        log.debug("{} No price found for {} ({})", [
          FUNCTION,
          this.contractLookup(currentAddress),
          currentAddress,
        ]);
        continue;
      }

      const decimals = getDecimals(currentAddress, block);
      const reserves = toDecimal(balances[i], decimals);
      const weight = toDecimal(tokenWeights[i], poolToken.decimals());

      // We can't determine the price if reserves are 0
      if (reserves.equals(BigDecimal.zero())) {
        continue;
      }

      secondaryTokenInfo.reserves = reserves;
      secondaryTokenInfo.weight = weight;
      secondaryTokenInfo.address = currentAddress;
      secondaryTokenInfo.price = price.price;

      log.debug("{} found secondary token: {} ({})", [
        FUNCTION,
        this.contractLookup(currentAddress),
        currentAddress,
      ]);
    }

    // If we didn't find tokens, skip
    if (lookupTokenInfo.address.length == 0) {
      log.warning(
        FUNCTION + " Unable to find matching lookup token in pool {} ({}) for token {} ({})",
        [
          this.contractLookup(this.poolId),
          this.poolId,
          this.contractLookup(tokenAddress),
          tokenAddress,
        ],
      );
      return null;
    }
    if (secondaryTokenInfo.address.length == 0) {
      log.warning(
        FUNCTION + " Unable to find matching secondary token in pool {} ({}) for token {} ({})",
        [
          this.contractLookup(this.poolId),
          this.poolId,
          this.contractLookup(tokenAddress),
          tokenAddress,
        ],
      );
      return null;
    }

    const numerator = secondaryTokenInfo.reserves.div(secondaryTokenInfo.weight);
    const denominator = lookupTokenInfo.reserves.div(lookupTokenInfo.weight);
    const rate = numerator.div(denominator).times(secondaryTokenInfo.price);
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

    log.debug(FUNCTION + " Calculating total value of Balancer pool {} ({})", [
      this.contractLookup(this.poolId),
      this.poolId,
    ]);
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
      log.debug("{} adding token {} ({}) with balance {}, rate {}, value {}", [
        FUNCTION,
        this.contractLookup(currentAddress),
        currentAddress,
        currentBalanceDecimal.toString(),
        rate.price.toString(),
        value.toString(),
      ]);
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

  getBalance(walletAddress: string, block: BigInt): BigDecimal {
    const poolToken = this.getPoolToken(block);
    if (!poolToken) {
      return BigDecimal.zero();
    }

    return toDecimal(poolToken.balanceOf(Address.fromString(walletAddress)), poolToken.decimals());
  }
}
