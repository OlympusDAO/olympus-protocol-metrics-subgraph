import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { KodiakIsland } from "../../generated/Price/KodiakIsland";
import { UniswapV3Pair } from "../../generated/Price/UniswapV3Pair";
import { UniswapV3Quoter, UniswapV3Quoter__quoteExactInputSingleInputParamsStruct } from "../../generated/Price/UniswapV3Quoter";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getERC20 } from "../contracts/ERC20";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerKodiakIsland";

export class PriceHandlerKodiakIsland implements PriceHandler {
    protected tokens: string[];
    protected quoter: string;
    protected poolAddress: string;
    protected contractLookup: ContractNameLookup;

    constructor(tokens: string[], quoter: string, poolAddress: string, contractLookup: ContractNameLookup) {
        this.tokens = tokens;
        this.quoter = quoter;
        this.poolAddress = poolAddress;
        this.contractLookup = contractLookup;
    }

    private getContract(block: BigInt): KodiakIsland | null {
        const FUNCTION = `${CLASS}: getContract:`;
        const contract = KodiakIsland.bind(Address.fromString(this.poolAddress));

        if (contract === null || contract.try_token0().reverted || contract.try_token1().reverted) {
            log.debug("{} contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return null;
        }

        return contract;
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

    getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null {
        const FUNCTION = `${CLASS}: getPrice:`;

        // Get the contract
        const contract = this.getContract(block);
        if (contract === null) {
          log.debug("{} Cannot determine value as the contract ({}) reverted at block {}", [
            FUNCTION,
            this.contractLookup(this.poolAddress),
            block.toString(),
          ]);
          return null;
        }

        // Determine orientation of the pair
        const token0 = contract.token0();
        const token1 = contract.token1();

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

        // Get the pool fee
        const poolFee = UniswapV3Pair.bind(contract.pool()).fee();

        // Get the quoter contract
        const quoter = UniswapV3Quoter.bind(Address.fromString(this.quoter));

        // Get the other token
        const desiredToken = addressesEqual(tokenAddress, token0.toHexString()) ? token0 : token1;
        const otherToken = addressesEqual(tokenAddress, token0.toHexString()) ? token1 : token0;

        const desiredTokenDecimals = getERC20(desiredToken.toHexString(), block).decimals();
        const otherTokenDecimals = getERC20(otherToken.toHexString(), block).decimals();

        // Get the quantity of the other token for 1 of this token
        const quoteSingleInputParams = new UniswapV3Quoter__quoteExactInputSingleInputParamsStruct(5);
        quoteSingleInputParams[0] = ethereum.Value.fromAddress(Address.fromString(tokenAddress));
        quoteSingleInputParams[1] = ethereum.Value.fromAddress(otherToken);
        quoteSingleInputParams[2] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10).pow(u8(desiredTokenDecimals)));
        quoteSingleInputParams[3] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(poolFee));
        quoteSingleInputParams[4] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2).pow(96)); // sqrtPriceLimitX96 max value

        const quoteOutputResult = quoter.quoteExactInputSingle(quoteSingleInputParams);
        const quoteOutputInt = quoteOutputResult.getAmountOut();
        const quoteOutput = toDecimal(quoteOutputInt, otherTokenDecimals);
        log.debug(
            "{} Determined price of {} ({}) to be valued at {} per {} ({}) tokens",
            [
                FUNCTION,
                this.contractLookup(tokenAddress),
                tokenAddress,
                quoteOutput.toString(),
                this.contractLookup(otherToken.toHexString()),
                otherToken.toHexString(),
            ]
        );

        // Determine the price of the other token
        const otherTokenPrice = priceLookup(otherToken.toHexString(), block, this.getId());
        if (!otherTokenPrice || otherTokenPrice.price.equals(BigDecimal.zero())) {
            log.warning("{} Unable to determine price of {} ({}) at block {}", [
                FUNCTION,
                this.contractLookup(otherToken.toHexString()),
                otherToken.toHexString(),
                block.toString(),
            ]);
            return null;
        }

        const desiredTokenPrice = quoteOutput.times(otherTokenPrice.price);
        log.info("{} Price of {} ({}) is {}", [
            FUNCTION,
            this.contractLookup(tokenAddress),
            tokenAddress,
            desiredTokenPrice.toString(),
        ]);

        return {
            price: desiredTokenPrice,
            liquidity: BigDecimal.zero(), // TODO set liquidity
        }
    }

    getTotalValue(excludedTokens: string[], priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        const FUNCTION = `${CLASS}: getTotalValue:`;
        const contract = this.getContract(block);
        if (!contract) {
            return null;
        }

        const token0 = contract.token0().toHexString();
        const token1 = contract.token1().toHexString();
        const reserves = contract.getUnderlyingBalances();

        const token0Rate = priceLookup(token0, block, null);
        if (!token0Rate) {
            log.warning("{} Unable to determine total value as the price of {} ({}) was null at block {}", [
                FUNCTION,
                this.contractLookup(token0),
                token0,
                block.toString(),
            ]);
            return null;
        }

        const token1Rate = priceLookup(token1, block, null);
        if (!token1Rate) {
            log.warning("{} Unable to determine total value as the price of {} ({}) was null at block {}", [
                FUNCTION,
                this.contractLookup(token1),
                token1,
                block.toString(),
            ]);
            return null;
        }

        // If the token is in {excludedTokens}, don't include its value
        const token0Value = arrayIncludesLoose(excludedTokens, token0)
            ? BigDecimal.zero()
            : toDecimal(reserves.getAmount0Current(), getERC20(token0, block).decimals()).times(token0Rate.price);
        const token1Value = arrayIncludesLoose(excludedTokens, token1)
            ? BigDecimal.zero()
            : toDecimal(reserves.getAmount1Current(), getERC20(token1, block).decimals()).times(token1Rate.price);

        return token0Value.plus(token1Value);
    }

    getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        const FUNCTION = `${CLASS}: getUnitPrice:`;
        const contract = this.getContract(block);
        if (!contract) {
            return null;
        }

        const totalSupply = toDecimal(contract.totalSupply(), contract.decimals());
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
        const FUNCTION = `${CLASS}: getBalance:`;
        const contract = this.getContract(block);
        if (!contract) {
            log.warning("{} Unable to determine balance as the contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return BigDecimal.zero();
        }

        const balance = toDecimal(contract.balanceOf(Address.fromString(walletAddress)), contract.decimals());
        log.info("{} Balance of {} ({}) in {} ({}) is {}", [
            FUNCTION,
            this.contractLookup(this.poolAddress),
            this.poolAddress,
            this.contractLookup(walletAddress),
            walletAddress,
            balance.toString(),
        ]);

        return balance;
    }

    getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
        const FUNCTION = `${CLASS}: getUnderlyingTokenBalance:`;
        const contract = this.getContract(block);
        if (!contract) {
            return BigDecimal.zero();
        }

        // Check that tokenAddress is either token0 or token1
        if (!addressesEqual(tokenAddress, contract.token0().toHexString()) && !addressesEqual(tokenAddress, contract.token1().toHexString())) {
            throw new Error(`${FUNCTION} token ${this.contractLookup(tokenAddress)} (${tokenAddress}) does not belong to LP ${this.contractLookup(this.poolAddress)} (${this.poolAddress})`);
        }

        // Get the proportional balance of the token supply
        const contractDecimals = contract.decimals();
        const walletBalance = toDecimal(contract.balanceOf(Address.fromString(walletAddress)), contractDecimals);
        const totalSupply = toDecimal(contract.totalSupply(), contractDecimals);
        const proportionalBalance: BigDecimal = walletBalance.div(totalSupply);

        // Calculate the balance of the underlying token
        const reserves = contract.getUnderlyingBalances();
        let underlyingBalanceInt: BigInt;
        if (tokenAddress == contract.token0().toHexString()) {
            underlyingBalanceInt = reserves.getAmount0Current();
        } else {
            underlyingBalanceInt = reserves.getAmount1Current();
        }

        const tokenContract = getERC20(tokenAddress, block);
        const underlyingBalance = toDecimal(underlyingBalanceInt, tokenContract.decimals());

        return proportionalBalance.times(underlyingBalance);
    }
}